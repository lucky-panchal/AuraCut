import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Clip as ClipType } from '../../../types';

interface Props {
  clip: ClipType;
  zoom: number;           // pixels per second
  trackId: string;
  selected: boolean;
  overlapping: boolean;
  onSelect: (id: string) => void;
  onTrimStart: (clipId: string, deltaSeconds: number) => void;
  onTrimEnd: (clipId: string, deltaSeconds: number) => void;
}

const TRIM_HANDLE_PX = 8;

export default function Clip({
  clip, zoom, selected, overlapping, onSelect, onTrimStart, onTrimEnd,
}: Props) {
  const left = clip.timeline_start * zoom;
  const width = Math.max(2, (clip.timeline_end - clip.timeline_start) * zoom);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: clip.id,
    data: { clipId: clip.id, type: 'clip' },
  });

  // Trim left handle
  const trimLeftRef = useRef<{ startX: number } | null>(null);
  function handleTrimLeftMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    trimLeftRef.current = { startX: e.clientX };
    const onMove = (ev: MouseEvent) => {
      if (!trimLeftRef.current) return;
      const delta = (ev.clientX - trimLeftRef.current.startX) / zoom;
      onTrimStart(clip.id, delta);
      trimLeftRef.current.startX = ev.clientX;
    };
    const onUp = () => {
      trimLeftRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Trim right handle
  const trimRightRef = useRef<{ startX: number } | null>(null);
  function handleTrimRightMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    trimRightRef.current = { startX: e.clientX };
    const onMove = (ev: MouseEvent) => {
      if (!trimRightRef.current) return;
      const delta = (ev.clientX - trimRightRef.current.startX) / zoom;
      onTrimEnd(clip.id, delta);
      trimRightRef.current.startX = ev.clientX;
    };
    const onUp = () => {
      trimRightRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      ref={setNodeRef}
      className={[
        'clip',
        selected ? 'clip--selected' : '',
        overlapping ? 'clip--overlap' : '',
        isDragging ? 'clip--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{ left, width, position: 'absolute', top: 4, bottom: 4 }}
      onClick={(e) => { e.stopPropagation(); onSelect(clip.id); }}
      {...listeners}
      {...attributes}
    >
      {/* Left trim handle */}
      <div
        className="clip__trim clip__trim--left"
        style={{ width: TRIM_HANDLE_PX }}
        onMouseDown={handleTrimLeftMouseDown}
      />

      <span className="clip__label">{clip.asset_id}</span>

      {/* Right trim handle */}
      <div
        className="clip__trim clip__trim--right"
        style={{ width: TRIM_HANDLE_PX }}
        onMouseDown={handleTrimRightMouseDown}
      />
    </div>
  );
}
