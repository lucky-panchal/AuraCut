import useWebSocket from '../../../hooks/useWebSocket';
import ProgressBar from '../../../components/ProgressBar';
import type { WsStatus } from '../../../store/usePreviewStore';
import { useState } from 'react';

interface ExportProgressMsg {
  type: 'export_progress' | 'export_completed' | 'export_failed';
  value?: number;
  download_url?: string;
  error?: string;
}

interface ExportOutMsg {
  type: 'cancel';
}

interface Props {
  jobId: string;
  onClose: () => void;
}

export default function ExportProgress({ jobId, onClose }: Props) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>('processing');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { send } = useWebSocket<ExportProgressMsg, ExportOutMsg>({
    url: `/ws/export/${jobId}/`,
    onMessage: (msg) => {
      if (msg.type === 'export_progress' && msg.value !== undefined) {
        setProgress(msg.value);
      } else if (msg.type === 'export_completed' && msg.download_url) {
        setProgress(100);
        setStatus('completed');
        setDownloadUrl(msg.download_url);
      } else if (msg.type === 'export_failed') {
        setStatus('failed');
        setErrorMsg(msg.error ?? 'Export failed');
      }
    },
    onStatusChange: (_s) => void (_s as WsStatus),
  });

  function handleCancel() {
    send({ type: 'cancel' });
    onClose();
  }

  const statusLabel: Record<typeof status, string> = {
    processing: `Exporting… ${progress}%`,
    completed: 'Export complete',
    failed: errorMsg ?? 'Export failed',
  };

  return (
    <div className="export-progress">
      <p className="export-progress__status">{statusLabel[status]}</p>

      <ProgressBar value={progress} />

      <div className="export-progress__actions">
        {status === 'processing' && (
          <button className="btn btn--danger" onClick={handleCancel}>Cancel</button>
        )}
        {status === 'completed' && downloadUrl && (
          <a className="btn btn--primary" href={downloadUrl} download>
            Download
          </a>
        )}
        {(status === 'completed' || status === 'failed') && (
          <button className="btn btn--secondary" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  );
}
