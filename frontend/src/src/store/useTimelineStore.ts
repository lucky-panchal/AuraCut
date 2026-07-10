import { create } from 'zustand';
import type { TimelineState, Track, Clip, Effect, Transition } from '../types';

const MAX_HISTORY = 50;

interface TimelineStore {
  tracks: Track[];
  playhead_position: number;
  zoom: number;
  duration: number;
  isDirty: boolean;
  past: TimelineState[];
  future: TimelineState[];

  // snapshot helpers
  _snapshot: () => TimelineState;
  _pushHistory: (prev: TimelineState) => void;

  // playhead
  setPlayhead: (position: number) => void;
  setZoom: (zoom: number) => void;

  // clip actions
  addClip: (trackId: string, clip: Clip) => void;
  moveClip: (clipId: string, toTrackId: string, timelineStart: number) => void;
  trimClip: (clipId: string, sourceIn: number, sourceOut: number, timelineStart: number, timelineEnd: number) => void;
  splitClip: (clipId: string, atPosition: number) => void;
  deleteClip: (clipId: string) => void;
  addEffect: (clipId: string, effect: Effect) => void;
  addTransition: (clipId: string, side: 'in' | 'out', transition: Transition) => void;

  // undo / redo
  undo: () => void;
  redo: () => void;

  // hydrate from API
  loadTimeline: (state: TimelineState) => void;
  markClean: () => void;
}

function cloneState(s: Pick<TimelineStore, 'tracks' | 'playhead_position' | 'zoom' | 'duration'>): TimelineState {
  return {
    tracks: JSON.parse(JSON.stringify(s.tracks)),
    playhead_position: s.playhead_position,
    zoom: s.zoom,
    duration: s.duration,
  };
}

const useTimelineStore = create<TimelineStore>((set, get) => ({
  tracks: [],
  playhead_position: 0,
  zoom: 100,
  duration: 0,
  isDirty: false,
  past: [],
  future: [],

  _snapshot: () => cloneState(get()),

  _pushHistory: (prev) => {
    set((s) => ({
      past: [...s.past.slice(-MAX_HISTORY + 1), prev],
      future: [],
    }));
  },

  setPlayhead: (position) => set({ playhead_position: position }),
  setZoom: (zoom) => set({ zoom }),

  addClip: (trackId, clip) => {
    const prev = get()._snapshot();
    get()._pushHistory(prev);
    set((s) => ({
      isDirty: true,
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
      ),
    }));
  },

  moveClip: (clipId, toTrackId, timelineStart) => {
    const prev = get()._snapshot();
    get()._pushHistory(prev);
    set((s) => {
      let moving: Clip | null = null;
      const tracks = s.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => {
          if (c.id === clipId) { moving = c; return false; }
          return true;
        }),
      }));
      if (!moving) return {};
      const clip = moving as Clip;
      const len = clip.timeline_end - clip.timeline_start;
      return {
        isDirty: true,
        tracks: tracks.map((t) =>
          t.id === toTrackId
            ? { ...t, clips: [...t.clips, { ...clip, track_id: toTrackId, timeline_start: timelineStart, timeline_end: timelineStart + len }] }
            : t,
        ),
      };
    });
  },

  trimClip: (clipId, sourceIn, sourceOut, timelineStart, timelineEnd) => {
    const prev = get()._snapshot();
    get()._pushHistory(prev);
    set((s) => ({
      isDirty: true,
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, source_in: sourceIn, source_out: sourceOut, timeline_start: timelineStart, timeline_end: timelineEnd } : c,
        ),
      })),
    }));
  },

  splitClip: (clipId, atPosition) => {
    const prev = get()._snapshot();
    get()._pushHistory(prev);
    set((s) => ({
      isDirty: true,
      tracks: s.tracks.map((t) => {
        const clip = t.clips.find((c) => c.id === clipId);
        if (!clip || atPosition <= clip.timeline_start || atPosition >= clip.timeline_end) return t;
        const ratio = (atPosition - clip.timeline_start) / (clip.timeline_end - clip.timeline_start);
        const splitSource = clip.source_in + ratio * (clip.source_out - clip.source_in);
        const left: Clip = { ...clip, timeline_end: atPosition, source_out: splitSource, effects: [], transition_out: null };
        const right: Clip = {
          ...clip,
          id: crypto.randomUUID(),
          timeline_start: atPosition,
          source_in: splitSource,
          effects: [],
          transition_in: null,
        };
        return { ...t, clips: t.clips.filter((c) => c.id !== clipId).concat(left, right) };
      }),
    }));
  },

  deleteClip: (clipId) => {
    const prev = get()._snapshot();
    get()._pushHistory(prev);
    set((s) => ({
      isDirty: true,
      tracks: s.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) })),
    }));
  },

  addEffect: (clipId, effect) => {
    const prev = get()._snapshot();
    get()._pushHistory(prev);
    set((s) => ({
      isDirty: true,
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, effects: [...c.effects, effect] } : c,
        ),
      })),
    }));
  },

  addTransition: (clipId, side, transition) => {
    const prev = get()._snapshot();
    get()._pushHistory(prev);
    set((s) => ({
      isDirty: true,
      tracks: s.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId
            ? { ...c, transition_in: side === 'in' ? transition : c.transition_in, transition_out: side === 'out' ? transition : c.transition_out }
            : c,
        ),
      })),
    }));
  },

  undo: () => {
    const { past, _snapshot } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const current = _snapshot();
    set((s) => ({
      ...prev,
      isDirty: true,
      past: s.past.slice(0, -1),
      future: [current, ...s.future],
    }));
  },

  redo: () => {
    const { future, _snapshot } = get();
    if (future.length === 0) return;
    const next = future[0];
    const current = _snapshot();
    set((s) => ({
      ...next,
      isDirty: true,
      past: [...s.past, current],
      future: s.future.slice(1),
    }));
  },

  loadTimeline: (state) => {
    set({ ...state, isDirty: false, past: [], future: [] });
  },

  markClean: () => set({ isDirty: false }),
}));

export default useTimelineStore;
