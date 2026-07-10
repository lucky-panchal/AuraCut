import { useRef, useState, useEffect, useCallback } from 'react';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import useTimelineStore from '../../../store/useTimelineStore';
import TimeRuler from './TimeRuler';
import Track from './Track';
import Playhead from './Playhead';

const TRACK_HEIGHT = 48;
const RULER_HEIGHT = 24;
const MIN_ZOOM = 10;
const MAX_ZOOM = 500;

export default function Timeline() {
  const {
    tracks, zoom, duration, playhead_position,
    setZoom, setPlayhead, moveClip, splitClip, deleteClip, undo, redo,
  } = useTimelineStore((s) => ({
    tracks: s.tracks,
    zoom: s.zoom,
    duration: s.duration,
    playhead_position: s.playhead_position,
    setZoom: s.setZoom,
    setPlayhead: s.setPlayhead,
    moveClip: s.moveClip,
    splitClip: s.splitClip,
    deleteClip: s.deleteClip,
    undo: s.undo,
    redo: s.redo,
  }));

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Observe container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl+Scroll → zoom
  function handleWheel(e: React.WheelEvent) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor)));
  }

  // Horizontal scroll sync
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    setScrollLeft((e.target as HTMLDivElement).scrollLeft);
  }

  // Click on ruler → set playhead
  function handleRulerClick(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const sec = (e.clientX - rect.left + scrollLeft) / zoom;
    setPlayhead(Math.max(0, Math.min(duration, sec)));
  }

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    if (e.key === 'Delete' && selectedClipId) { deleteClip(selectedClipId); setSelectedClipId(null); }
    if (e.key === 's' && !e.ctrlKey && selectedClipId) { splitClip(selectedClipId, playhead_position); }
  }, [undo, redo, deleteClip, splitClip, selectedClipId, playhead_position]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over, delta } = event;
    if (!over) return;
    const clipId = active.id as string;
    const toTrackId = over.data.current?.trackId as string;
    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip || !toTrackId) return;
    const deltaSeconds = delta.x / zoom;
    const newStart = Math.max(0, clip.timeline_start + deltaSeconds);
    moveClip(clipId, toTrackId, newStart);
  }

  const totalWidth = Math.max(containerWidth, duration * zoom + 200);
  const totalHeight = tracks.length * TRACK_HEIGHT;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="timeline" onWheel={handleWheel} ref={containerRef}>
        {/* Ruler */}
        <div className="timeline__ruler" style={{ height: RULER_HEIGHT }} onClick={handleRulerClick}>
          <TimeRuler
            duration={duration}
            zoom={zoom}
            scrollLeft={scrollLeft}
            width={containerWidth}
          />
        </div>

        {/* Tracks + Playhead */}
        <div
          className="timeline__body"
          style={{ overflowX: 'auto', position: 'relative' }}
          onScroll={handleScroll}
        >
          <div style={{ width: totalWidth, position: 'relative' }}>
            <Playhead zoom={zoom} scrollLeft={scrollLeft} height={totalHeight} />
            {tracks.map((track) => (
              <Track
                key={track.id}
                track={track}
                zoom={zoom}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
