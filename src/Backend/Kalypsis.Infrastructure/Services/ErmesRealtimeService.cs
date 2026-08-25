using System.Collections.Concurrent;
using Kalypsis.Application.Abstractions;

namespace Kalypsis.Infrastructure.Services;

/// <summary>
/// In-memory pub/sub for ΕΡΜΗΣ real-time notifications. Keyed by
/// (tenantId, userId) so a fan-out to «recipients» hits every open tab
/// of every recipient without leaking events across tenants. Multi-
/// instance deploys need this replaced with a shared bus (Redis/RabbitMQ)
/// — the interface stays the same, only the implementation changes.
/// </summary>
public sealed class ErmesRealtimeService : IErmesRealtimeService
{
    private sealed record Listener(Guid Id, Func<ErmesRealtimeEvent, Task> Handler);

    // (tenantId, userId) → set of listeners. Each browser tab is one listener.
    private readonly ConcurrentDictionary<(Guid Tenant, Guid User), ConcurrentDictionary<Guid, Listener>> _listeners = new();

    public void NotifyNewMessage(Guid tenantId, IEnumerable<Guid> recipientUserIds, Guid threadId, Guid messageId)
    {
        var evt = new ErmesRealtimeEvent("message", threadId, messageId, DateTime.UtcNow);
        foreach (var uid in recipientUserIds.Distinct())
        {
            if (!_listeners.TryGetValue((tenantId, uid), out var subs)) continue;
            foreach (var sub in subs.Values)
            {
                // Fire and forget — SSE endpoint disposes stale subs itself.
                _ = FireSafeAsync(sub.Handler, evt);
            }
        }
    }

    public IErmesRealtimeSubscription Subscribe(Guid tenantId, Guid userId, Func<ErmesRealtimeEvent, Task> onEvent)
    {
        var key = (tenantId, userId);
        var bucket = _listeners.GetOrAdd(key, _ => new ConcurrentDictionary<Guid, Listener>());
        var id = Guid.NewGuid();
        bucket[id] = new Listener(id, onEvent);
        return new Subscription(this, key, id);
    }

    private static async Task FireSafeAsync(Func<ErmesRealtimeEvent, Task> h, ErmesRealtimeEvent e)
    {
        try { await h(e); } catch { /* dead listener — cleanup happens on next dispose */ }
    }

    private sealed class Subscription : IErmesRealtimeSubscription
    {
        private readonly ErmesRealtimeService _svc;
        private readonly (Guid, Guid) _key;
        private readonly Guid _id;
        public Subscription(ErmesRealtimeService svc, (Guid, Guid) key, Guid id)
        { _svc = svc; _key = key; _id = id; }

        public ValueTask DisposeAsync()
        {
            if (_svc._listeners.TryGetValue(_key, out var bucket))
            {
                bucket.TryRemove(_id, out _);
                if (bucket.IsEmpty) _svc._listeners.TryRemove(_key, out _);
            }
            return ValueTask.CompletedTask;
        }
    }
}
