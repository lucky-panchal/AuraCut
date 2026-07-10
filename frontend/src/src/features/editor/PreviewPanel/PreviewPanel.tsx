import usePreviewStore from '../../../store/usePreviewStore';
import useTimelineStore from '../../../store/useTimelineStore';
import useWebSocket from '../../../hooks/useWebSocket';
import PreviewCanvas from './PreviewCanvas';
import type { WsStatus } from '../../../store/usePreviewStore';

interface PreviewFrameMsg {
  type: 'preview_frame';
  data: string;
}

interface PreviewOutMsg {
  type: 'preview_request';
  timeline_segment: unknown;
  effects: unknown;
}

interface Props {
  projectId: string;
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  const ms = Math.floor((sec % 1) * 100).toString().padStart(2, '0');
  return `${m}:${s}.${ms}`;
}

export default function PreviewPanel({ projectId }: Props) {
  const isPlaying = usePreviewStore((s) => s.isPlaying);
  const currentFrame = usePreviewStore((s) => s.currentFrame);
  const wsStatus = usePreviewStore((s) => s.wsStatus);
  const play = usePreviewStore((s) => s.play);
  const pause = usePreviewStore((s) => s.pause);
  const stop = usePreviewStore((s) => s.stop);
  const setWsStatus = usePreviewStore((s) => s.setWsStatus);
  const setServerFrame = usePreviewStore((s) => s.setServerFrame);

  const duration = useTimelineStore((s) => s.duration);

  const { send } = useWebSocket<PreviewFrameMsg, PreviewOutMsg>({
    url: `/ws/preview/${projectId}/`,
    onMessage: (msg) => {
      if (msg.type === 'preview_frame') setServerFrame(msg.data);
    },
    onStatusChange: (status) => setWsStatus(status as WsStatus),
  });

  function handleEffectChange(segment: unknown, effects: unknown) {
    send({ type: 'preview_request', timeline_segment: segment, effects });
  }

  // Expose for parent use
  void handleEffectChange;

  const wsIndicator: Record<WsStatus, string> = {
    connecting: '🟡',
    open: '🟢',
    closed: '🔴',
    failed: '🔴',
  };

  return (
    <div className="preview-panel">
      <div className="preview-panel__canvas-wrap">
        <PreviewCanvas />
      </div>

      <div className="preview-panel__controls">
        <button onClick={stop} title="Stop">⏹</button>
        <button onClick={isPlaying ? pause : play} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>

        <span className="preview-panel__timecode">
          {fmtTime(currentFrame)} / {fmtTime(duration)}
        </span>

        <span className="preview-panel__ws" title={`WebSocket: ${wsStatus}`}>
          {wsIndicator[wsStatus]}
        </span>
      </div>
    </div>
  );
}
