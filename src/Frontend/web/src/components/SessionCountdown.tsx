import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chip, Tooltip } from "@mui/material";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 5_000;
const STORAGE_PREFIX = "kalypsis.session.deadline.";

function formatRemaining(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function readDeadline(key: string): number | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SessionCountdown() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const storageKey = useMemo(() => user ? `${STORAGE_PREFIX}${user.userId}` : null, [user]);
  const [remainingMs, setRemainingMs] = useState(SESSION_TIMEOUT_MS);
  const expiredRef = useRef(false);
  const lastActivityRef = useRef(0);

  const expireSession = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    // Drop the deadline so the next successful login (same user, same browser)
    // doesn't see a stale past timestamp and immediately log out again. Other
    // tabs notice the removal via the storage event below.
    if (storageKey) localStorage.removeItem(storageKey);
    signOut();
    navigate("/", { replace: true });
  }, [navigate, signOut, storageKey]);

  const refreshDeadline = useCallback((force = false) => {
    if (!storageKey || expiredRef.current) return;
    const now = Date.now();
    const current = readDeadline(storageKey);
    if (current !== null && current <= now) {
      expireSession();
      return;
    }
    if (!force && now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
    lastActivityRef.current = now;
    const next = now + SESSION_TIMEOUT_MS;
    localStorage.setItem(storageKey, String(next));
    setRemainingMs(SESSION_TIMEOUT_MS);
  }, [expireSession, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    expiredRef.current = false;
    const current = readDeadline(storageKey);
    if (current !== null && current <= Date.now()) {
      expireSession();
      return;
    }
    // A valid page load/refresh counts as fresh activity.
    refreshDeadline(true);
  }, [expireSession, refreshDeadline, storageKey, user?.userId]);

  useEffect(() => {
    if (!storageKey) return;
    refreshDeadline(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!storageKey) return;
    const update = () => {
      const deadline = readDeadline(storageKey);
      if (deadline === null) {
        setRemainingMs(SESSION_TIMEOUT_MS);
        return;
      }
      const next = deadline - Date.now();
      setRemainingMs(Math.max(0, next));
      if (next <= 0) expireSession();
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [expireSession, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    const onActivity = () => refreshDeadline(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshDeadline(false);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      // Another tab removed the deadline → it expired the session there. Mirror it here.
      if (event.newValue === null) {
        expireSession();
        return;
      }
      const next = Number(event.newValue) - Date.now();
      setRemainingMs(Math.max(0, next));
      if (next <= 0) expireSession();
    };

    const options: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("pointerdown", onActivity, options);
    window.addEventListener("keydown", onActivity, options);
    window.addEventListener("touchstart", onActivity, options);
    window.addEventListener("scroll", onActivity, options);
    window.addEventListener("focus", onActivity, options);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", onActivity, options);
      window.removeEventListener("keydown", onActivity, options);
      window.removeEventListener("touchstart", onActivity, options);
      window.removeEventListener("scroll", onActivity, options);
      window.removeEventListener("focus", onActivity, options);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [expireSession, refreshDeadline, storageKey]);

  if (!user || !storageKey) return null;

  const severity = remainingMs <= 60_000 ? "error" : remainingMs <= 5 * 60_000 ? "warning" : "default";
  const label = formatRemaining(remainingMs);

  return (
    <Tooltip
      arrow
      title={`Αυτόματη αποσύνδεση σε ${label}. Πατήστε για ανανέωση στα 30 λεπτά.`}
    >
      <Chip
        clickable
        icon={<TimerOutlinedIcon />}
        label={label}
        color={severity}
        variant={severity === "default" ? "outlined" : "filled"}
        onClick={() => refreshDeadline(true)}
        sx={{
          height: 34,
          minWidth: { xs: 78, sm: 88 },
          borderRadius: 999,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          bgcolor: severity === "default" ? "rgba(11,37,69,0.04)" : undefined,
          "& .MuiChip-icon": { ml: 1, fontSize: 18 },
          "& .MuiChip-label": { px: 1 }
        }}
      />
    </Tooltip>
  );
}
