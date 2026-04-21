import { useSyncExternalStore } from "react";

export interface Settings {
  apiUrl: string;
  threshold: number;
  alertSound: boolean;
  fps: number; // for live mode
}

const KEY = "wd_settings_v2";
const DEFAULTS: Settings = {
  apiUrl: "https://murtazamajid-sentinel.hf.space",
  threshold: 0.5,
  alertSound: true,
  fps: 3,
};

let state: Settings = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
})();

const listeners = new Set<() => void>();

function emit() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export const settingsStore = {
  get: () => state,
  set(patch: Partial<Settings>) {
    state = { ...state, ...patch };
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useSettings() {
  return useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.get,
    settingsStore.get
  );
}
