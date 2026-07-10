import { useEffect, useRef, useState, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { listAssets, uploadAsset } from '../../../api/assets';
import useWebSocket from '../../../hooks/useWebSocket';
import type { MediaAsset } from '../../../types';
import AssetItem from './AssetItem';
import ProgressBar from '../../../components/ProgressBar';

interface AssetReadyMsg {
  type: 'asset_ready';
  asset: MediaAsset;
}

interface UploadEntry {
  name: string;
  progress: number;
}

interface Props {
  projectId: string;
}

export default function MediaPanel({ projectId }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadEntry>>({});
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load existing assets
  useEffect(() => {
    listAssets(projectId)
      .then(({ data }) => setAssets(data))
      .catch(() => toast.error('Failed to load assets'));
  }, [projectId]);

  // WebSocket — receive asset_ready updates
  useWebSocket<AssetReadyMsg>({
    url: `/ws/project/${projectId}/`,
    onMessage: (msg) => {
      if (msg.type !== 'asset_ready') return;
      setAssets((prev) => {
        const exists = prev.find((a) => a.id === msg.asset.id);
        return exists
          ? prev.map((a) => (a.id === msg.asset.id ? msg.asset : a))
          : [msg.asset, ...prev];
      });
    },
  });

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      const key = `${file.name}-${Date.now()}`;
      setUploads((u) => ({ ...u, [key]: { name: file.name, progress: 0 } }));
      try {
        const { data } = await uploadAsset(projectId, file, (pct) => {
          setUploads((u) => ({ ...u, [key]: { name: file.name, progress: pct } }));
        });
        setAssets((prev) => [data, ...prev]);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setUploads((u) => { const next = { ...u }; delete next[key]; return next; });
      }
    }
  }, [projectId]);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = '';
  }

  return (
    <div className="media-panel">
      {/* Dropzone */}
      <div
        className={['media-panel__dropzone', dragOver ? 'media-panel__dropzone--over' : ''].filter(Boolean).join(' ')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <span>Drop files here or click to upload</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />
      </div>

      {/* Upload progress */}
      {Object.entries(uploads).map(([key, entry]) => (
        <div key={key} className="media-panel__upload-progress">
          <span className="media-panel__upload-name">{entry.name}</span>
          <ProgressBar value={entry.progress} label={`${entry.progress}%`} />
        </div>
      ))}

      {/* Asset list */}
      <div className="media-panel__list">
        {assets.length === 0 && (
          <p className="media-panel__empty">No assets yet. Upload a file to get started.</p>
        )}
        {assets.map((asset) => (
          <AssetItem key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}
