import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import Modal from '../../../components/Modal';
import { createExportJob, type CreateExportPayload } from '../../../api/export';
import ExportProgress from './ExportProgress';

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

const DEFAULTS: CreateExportPayload = {
  resolution: '1080p',
  format: 'mp4',
  bitrate: 'medium',
  fps: 30,
  subtitle_burn_in: false,
};

export default function ExportModal({ projectId, open, onClose }: Props) {
  const [settings, setSettings] = useState<CreateExportPayload>(DEFAULTS);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof CreateExportPayload>(key: K, value: CreateExportPayload[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await createExportJob(projectId, settings);
      setJobId(data.job_id);
    } catch {
      toast.error('Failed to start export');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setJobId(null);
    setSettings(DEFAULTS);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Export">
      {jobId ? (
        <ExportProgress jobId={jobId} onClose={handleClose} />
      ) : (
        <form className="effects-form" onSubmit={handleSubmit}>
          <label>
            Resolution
            <select value={settings.resolution} onChange={(e) => update('resolution', e.target.value as CreateExportPayload['resolution'])}>
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>

          <label>
            Format
            <select value={settings.format} onChange={(e) => update('format', e.target.value as CreateExportPayload['format'])}>
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
            </select>
          </label>

          <label>
            Bitrate
            <select value={settings.bitrate} onChange={(e) => update('bitrate', e.target.value as CreateExportPayload['bitrate'])}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label>
            FPS
            <select value={settings.fps} onChange={(e) => update('fps', Number(e.target.value) as CreateExportPayload['fps'])}>
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </label>

          <label className="effects-form__checkbox">
            <input
              type="checkbox"
              checked={settings.subtitle_burn_in}
              onChange={(e) => update('subtitle_burn_in', e.target.checked)}
            />
            Burn in subtitles
          </label>

          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Starting…' : 'Export'}
          </button>
        </form>
      )}
    </Modal>
  );
}
