import { create } from 'zustand';

export type ExcitationMode = 'hold' | 'sine' | 'step' | 'sineAll';

export interface SimUIState {
  kp: number;
  kd: number;
  mode: ExcitationMode;
  paused: boolean;
  status: string;
  loading: boolean;
  setKp: (v: number) => void;
  setKd: (v: number) => void;
  setMode: (m: ExcitationMode) => void;
  setPaused: (v: boolean) => void;
  setStatus: (s: string) => void;
  setLoading: (v: boolean) => void;
}

export const useSimStore = create<SimUIState>((set) => ({
  kp: 200,
  kd: 10,
  mode: 'sine',
  paused: false,
  status: 'Initializing...',
  loading: true,
  setKp: (v) => set({ kp: v }),
  setKd: (v) => set({ kd: v }),
  setMode: (m) => set({ mode: m }),
  setPaused: (v) => set({ paused: v }),
  setStatus: (s) => set({ status: s }),
  setLoading: (v) => set({ loading: v }),
}));
