import { useEffect, useRef } from 'react';
import useTimelineStore from '../store/useTimelineStore';
import useProjectStore from '../store/useProjectStore';
import { saveTimelineState } from '../api/projects';

const DEBOUNCE_MS = 5000;
const MAX_RETRIES = 3;

export default function useAutoSave(projectId: string) {
  const isDirty = useTimelineStore((s) => s.isDirty);
  const markClean = useTimelineStore((s) => s.markClean);
  const setSaveStatus = useProjectStore((s) => s.setSaveStatus);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const snapshot = useTimelineStore.getState();
      const state = {
        tracks: snapshot.tracks,
        playhead_position: snapshot.playhead_position,
        zoom: snapshot.zoom,
        duration: snapshot.duration,
      };

      setSaveStatus('saving');

      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        try {
          await saveTimelineState(projectId, state);
          markClean();
          setSaveStatus('saved');
          return;
        } catch {
          attempt++;
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      }

      setSaveStatus('error');
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, projectId, markClean, setSaveStatus]);
}
