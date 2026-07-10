import { useDraggable } from '@dnd-kit/core';
import type { MediaAsset } from '../../../types';
import Spinner from '../../../components/Spinner';

interface Props {
  asset: MediaAsset;
}

function fmtDuration(sec: number | null) {
  if (sec === null) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return m > 0 ? `${m}:${s}` : `0:${s}`;
}

const STATUS_ICON: Record<MediaAsset['status'], React.ReactNode> = {
  uploading: <Spinner size={14} />,
  processing: <Spinner size={14} />,
  ready: null,
  error: <span className="asset-item__error-icon" title="Processing failed">⚠️</span>,
};

export default function AssetItem({ asset }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: asset.id,
    data: { assetId: asset.id, type: 'asset' },
    disabled: asset.status !== 'ready',
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'asset-item',
        asset.status !== 'ready' ? 'asset-item--not-ready' : '',
        isDragging ? 'asset-item--dragging' : '',
      ].filter(Boolean).join(' ')}
      {...listeners}
      {...attributes}
    >
      <div className="asset-item__thumb">
        {asset.thumbnail_url
          ? <img src={asset.thumbnail_url} alt={asset.filename} />
          : <span className="asset-item__thumb-placeholder">
              {asset.asset_type === 'audio' ? '🎵' : '🎬'}
            </span>}
        {STATUS_ICON[asset.status]}
      </div>

      <div className="asset-item__info">
        <span className="asset-item__name" title={asset.filename}>{asset.filename}</span>
        {asset.duration !== null && (
          <span className="asset-item__duration">{fmtDuration(asset.duration)}</span>
        )}
      </div>
    </div>
  );
}
