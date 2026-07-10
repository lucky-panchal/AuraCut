import { useRef } from 'react';
import useTimelineStore from '../../../store/useTimelineStore';

interface Props {
  zoom: number;
  scrollLeft: number;
  height: number;
}

export default function Playhead({ zoom, scrollLeft, height }: Props) {
  const { playhead_position, duration, setPlayhead } = useTimelineStore((s) => ({
    playhead_position: s.playhead_position,
    duration: s.duration,
    setPlayhead: s.setPlayhead,
  }));

  const dragRef = useRef<{ startX: number; startPos: number } | null>(null);
  const x = playhead_position * zoom - scrollLeft;

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startPos: playhead_position };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (ev.clientX - dragRef.current.startX) / zoom;
      const next = Math.max(0, Math.min(duration, dragRef.current.startPos + delta));
      setPlayhead(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      className="playhead"
      style={{ left: x, height, position: 'absolute', top: 0, zIndex: 10 }}
      onMouseDown={handleMouseDown}
    >
      <div className="playhead__head" />
      <div className="playhead__line" style={{ height }} />
    </div>
  );
}
