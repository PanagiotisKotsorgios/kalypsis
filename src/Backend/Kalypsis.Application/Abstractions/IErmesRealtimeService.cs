namespace Kalypsis.Application.Abstractions;

/// <summary>
/// In-process pub/sub for ΕΡΜΗΣ real-time notifications. Send-handlers
/// call NotifyNewMessage after a message lands in the DB; the SSE endpoint
/// in ErmesController subscribes per (tenantId, userId) and streams the
/// events to any open browser tab so recipients see the new message
/// instantly instead of on their next refetch.
///
/// Implementation is a singleton with a ConcurrentDictionary of Channels
/// so there's no ordering-of-DI-registration surprise. Multi-instance
/// deploys still need a shared bus (Redis/RabbitMQ) — noted as a follow-up.
/// </summary>
public interface IErmesRealtimeService
{
    /// <summary>Fan-out a new-message notification to every listed user.</summary>
    void NotifyNewMessage(Guid tenantId, IEnumerable<Guid> recipientUserIds, Guid threadId, Guid messageId);

    /// <summary>Register a listener; returns a disposable that removes it.</summary>
    IErmesRealtimeSubscription Subscribe(Guid tenantId, Guid userId, Func<ErmesRealtimeEvent, Task> onEvent);
}

public sealed record ErmesRealtimeEvent(string Kind, Guid ThreadId, Guid MessageId, DateTime OccurredAt);

public interface IErmesRealtimeSubscription : IAsyncDisposable { }
