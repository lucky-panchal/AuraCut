import { useMemo } from 'react';

interface Props {
  duration: number;   // seconds
  zoom: number;       // pixels per second
  scrollLeft: number;
  width: number;
}

export default function TimeRuler({ duration, zoom, scrollLeft, width }: Props) {
  const markers = useMemo(() => {
    // Pick a tick interval that keeps markers ~80px apart
    const secondsPerPixel = 1 / zoom;
    const rawInterval = (80 * secondsPerPixel);
    const nice = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const interval = nice.find((n) => n >= rawInterval) ?? 300;

    const startSec = scrollLeft / zoom;
    const endSec = startSec + width / zoom;
    const first = Math.floor(startSec / interval) * interval;

    const result: { sec: number; x: number }[] = [];
    for (let s = first; s <= Math.min(endSec, duration); s += interval) {
      result.push({ sec: s, x: s * zoom - scrollLeft });
    }
    return result;
  }, [duration, zoom, scrollLeft, width]);

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(sec < 10 ? 1 : 0);
    return m > 0 ? `${m}:${String(s).padStart(4, '0')}` : `${s}s`;
  }

  return (
    <div className="time-ruler" style={{ width, position: 'relative', overflow: 'hidden' }}>
      {markers.map(({ sec, x }) => (
        <div key={sec} className="time-ruler__tick" style={{ left: x }}>
          <span className="time-ruler__label">{fmt(sec)}</span>
        </div>
      ))}
    </div>
  );
}
