import { useRef, useState, useEffect, useCallback } from 'react';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import useTimelineStore from '../../../store/useTimelineStore';
import TimeRuler from './TimeRuler';
import Track from './Track';
import Playhead from './Playhead';

const TRACK_HEIGHT = 52;
const RULER_HEIGHT = 28;
const MIN_ZOOM = 10;
const MAX_ZOOM = 500;

interface TimelineProps {
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
}

export default function Timeline({ selectedClipId, onSelectClip }: TimelineProps) {
  const tracks = useTimelineStore((s) => s.tracks);
  const zoom = useTimelineStore((s) => s.zoom);
  const duration = useTimelineStore((s) => s.duration);
  const playhead_position = useTimelineStore((s) => s.playhead_position);
  const setZoom = useTimelineStore((s) => s.setZoom);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const moveClip = useTimelineStore((s) => s.moveClip);
  const splitClip = useTimelineStore((s) => s.splitClip);
  const deleteClip = useTimelineStore((s) => s.deleteClip);
  const undo = useTimelineStore((s) => s.undo);
  const redo = useTimelineStore((s) => s.redo);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);

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
    if (e.key === 'Delete' && selectedClipId) { deleteClip(selectedClipId); onSelectClip(null); }
    if (e.key === 's' && !e.ctrlKey && selectedClipId) { splitClip(selectedClipId, playhead_position); }
  }, [undo, redo, deleteClip, splitClip, selectedClipId, playhead_position, onSelectClip]);

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
  const totalHeight = Math.max(tracks.length * TRACK_HEIGHT, 1); // guard: never 0

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="timeline" onWheel={handleWheel} ref={containerRef}>

        {/* Toolbar */}
        <div className="timeline__toolbar">
          <span className="timeline__toolbar-title">Timeline</span>
          <button
            className="timeline__tool-btn"
            onClick={() => setZoom(Math.max(MIN_ZOOM, zoom * 0.8))}
            title="Zoom out"
          >−</button>
          <span className="timeline__zoom-label">{Math.round(zoom)}px</span>
          <button
            className="timeline__tool-btn"
            onClick={() => setZoom(Math.min(MAX_ZOOM, zoom * 1.25))}
            title="Zoom in"
          >+</button>
        </div>

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
                onSelectClip={onSelectClip}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
