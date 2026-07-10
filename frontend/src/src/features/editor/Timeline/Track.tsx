import { useDroppable } from '@dnd-kit/core';
import type { Track as TrackType } from '../../../types';
import useTimelineStore from '../../../store/useTimelineStore';
import ClipComponent from './Clip';

interface Props {
  track: TrackType;
  zoom: number;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
}

function hasOverlap(clips: TrackType['clips'], clipId: string): boolean {
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return false;
  return clips.some(
    (c) => c.id !== clipId && c.timeline_start < clip.timeline_end && c.timeline_end > clip.timeline_start,
  );
}

export default function Track({ track, zoom, selectedClipId, onSelectClip }: Props) {
  const { trimClip } = useTimelineStore((s) => ({ trimClip: s.trimClip }));

  const { setNodeRef, isOver } = useDroppable({ id: track.id, data: { trackId: track.id } });

  function handleTrimStart(clipId: string, delta: number) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const newStart = Math.max(0, clip.timeline_start + delta);
    const newSourceIn = Math.max(0, clip.source_in + delta);
    if (newStart >= clip.timeline_end - 0.1) return;
    trimClip(clipId, newSourceIn, clip.source_out, newStart, clip.timeline_end);
  }

  function handleTrimEnd(clipId: string, delta: number) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const newEnd = clip.timeline_end + delta;
    const newSourceOut = clip.source_out + delta;
    if (newEnd <= clip.timeline_start + 0.1) return;
    trimClip(clipId, clip.source_in, newSourceOut, clip.timeline_start, newEnd);
  }

  return (
    <div
      ref={setNodeRef}
      className={['track', isOver ? 'track--over' : ''].filter(Boolean).join(' ')}
      style={{ position: 'relative', height: 48 }}
    >
      <div className="track__label">{track.type}</div>
      {track.clips.map((clip) => (
        <ClipComponent
          key={clip.id}
          clip={clip}
          zoom={zoom}
          trackId={track.id}
          selected={clip.id === selectedClipId}
          overlapping={hasOverlap(track.clips, clip.id)}
          onSelect={onSelectClip}
          onTrimStart={handleTrimStart}
          onTrimEnd={handleTrimEnd}
        />
      ))}
    </div>
  );
}
