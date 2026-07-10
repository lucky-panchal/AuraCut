import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

export type WsStatus = 'connecting' | 'open' | 'closed' | 'failed';

interface Options<T> {
  url: string;
  onMessage: (msg: T) => void;
  onStatusChange?: (status: WsStatus) => void;
  enabled?: boolean;
}

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

export default function useWebSocket<TIn, TOut = unknown>({
  url,
  onMessage,
  onStatusChange,
  enabled = true,
}: Options<TIn>) {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const onStatusRef = useRef(onStatusChange);

  // Keep refs current without re-running the effect
  onMessageRef.current = onMessage;
  onStatusRef.current = onStatusChange;

  const connect = useCallback(() => {
    if (!enabled) return;

    onStatusRef.current?.('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
      onStatusRef.current?.('open');
    };

    ws.onmessage = (ev) => {
      try {
        onMessageRef.current(JSON.parse(ev.data) as TIn);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      onStatusRef.current?.('closed');
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        onStatusRef.current?.('failed');
        toast.error('WebSocket connection lost. Please refresh.');
        return;
      }
      const delay = BASE_DELAY_MS * 2 ** attemptsRef.current;
      attemptsRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, enabled]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
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
