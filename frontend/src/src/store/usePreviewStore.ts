import { create } from 'zustand';

export type WsStatus = 'connecting' | 'open' | 'closed' | 'failed';

interface PreviewState {
  isPlaying: boolean;
  currentFrame: number;   // seconds
  wsStatus: WsStatus;
  lastServerFrame: string | null;  // base64 encoded frame from server

  play: () => void;
  pause: () => void;
  stop: () => void;
  setCurrentFrame: (frame: number) => void;
  setWsStatus: (status: WsStatus) => void;
  setServerFrame: (data: string) => void;
}

const usePreviewStore = create<PreviewState>((set) => ({
  isPlaying: false,
  currentFrame: 0,
  wsStatus: 'closed',
  lastServerFrame: null,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, currentFrame: 0 }),
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setServerFrame: (data) => set({ lastServerFrame: data }),
}));

export default usePreviewStore;
