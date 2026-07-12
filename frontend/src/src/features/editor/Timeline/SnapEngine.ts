import type { Clip } from '../../../types';

export interface SnapPoint {
  position: number;
  source: 'clip_start' | 'clip_end' | 'playhead';
}

/**
 * Returns the nearest snap target within `threshold` seconds of `position`,
 * or null if nothing is close enough.
 */
export function findSnapPoint(
  position: number,
  clips: Clip[],
  playhead: number,
  threshold: number,
): SnapPoint | null {
  const candidates: SnapPoint[] = [
    { position: playhead, source: 'playhead' },
    ...clips.flatMap((c) => [
      { position: c.timeline_start, source: 'clip_start' as const },
      { position: c.timeline_end, source: 'clip_end' as const },
    ]),
  ];

  let best: SnapPoint | null = null;
  let bestDist = threshold;

  for (const candidate of candidates) {
    const dist = Math.abs(candidate.position - position);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  return best;
}
