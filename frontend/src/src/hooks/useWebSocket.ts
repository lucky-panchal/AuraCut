import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

export type WsStatus = 'connecting' | 'open' | 'closed' | 'failed';

interface Options<T> {
  url: string;
  onMessage: (msg: T) => void;
  onStatusChange?: (status: WsStatus) => void;
  /** Set false to completely skip connecting (e.g. feature disabled) */
  enabled?: boolean;
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1500;

export default function useWebSocket<TIn, TOut = unknown>({
  url,
  onMessage,
  onStatusChange,
  enabled = true,
}: Options<TIn>) {
  const wsRef       = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef  = useRef(false);  // guards against cleanup-triggered onclose
  const failedRef   = useRef(false);  // permanently disabled after 1006 / max attempts

  // Keep callbacks in refs so they never stale-close over old values
  const onMessageRef = useRef(onMessage);
  const onStatusRef  = useRef(onStatusChange);
  onMessageRef.current = onMessage;
  onStatusRef.current  = onStatusChange;

  const connect = useCallback(() => {
    if (!mountedRef.current || failedRef.current || !enabled) return;

    onStatusRef.current?.('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      attemptsRef.current = 0;
      onStatusRef.current?.('open');
    };

    ws.onmessage = (ev) => {
      if (!mountedRef.current) return;
      try {
        onMessageRef.current(JSON.parse(ev.data) as TIn);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = (ev) => {
      // Ignore if we already unmounted — this is the cleanup close, not a real failure
      if (!mountedRef.current) return;

      onStatusRef.current?.('closed');

      // Code 1006 = abnormal closure = server rejected WS handshake (e.g. 403,
      // Redis/Channels not running locally). No point retrying — mark permanently failed.
      const isServerReject = ev.code === 1006;
      const isExhausted    = attemptsRef.current >= MAX_ATTEMPTS;

      if (isServerReject || isExhausted) {
        failedRef.current = true;
        onStatusRef.current?.('failed');
        if (isExhausted) {
          toast.error('Live connection lost. Please refresh the page.');
        }
        return;
      }

      const delay = BASE_DELAY_MS * 2 ** attemptsRef.current;
      attemptsRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle the logic
      ws.close();
    };
  }, [url, enabled]);

  useEffect(() => {
    if (!enabled) {
      onStatusRef.current?.('failed');
      return;
    }

    mountedRef.current  = true;
    failedRef.current   = false;
    attemptsRef.current = 0;
    connect();

    return () => {
      mountedRef.current = false; // set BEFORE closing so onclose ignores the event
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect, enabled]);

  const send = useCallback((msg: TOut) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send };
}
