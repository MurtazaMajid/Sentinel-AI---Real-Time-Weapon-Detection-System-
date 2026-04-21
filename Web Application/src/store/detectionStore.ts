import { useSyncExternalStore } from "react";
import type { DetectionEvent } from "@/types/detection";

const KEY = "wd_history";
const MAX = 100;

let events: DetectionEvent[] = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DetectionEvent[]) : [];
  } catch {
    return [];
  }
})();

const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(events.slice(0, MAX)));
  } catch {
    /* ignore quota */
  }
  listeners.forEach((l) => l());
}

export const detectionStore = {
  add(ev: DetectionEvent) {
    events = [ev, ...events].slice(0, MAX);
    emit();
  },
  clear() {
    events = [];
    emit();
  },
  getAll() {
    return events;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useDetectionHistory() {
  return useSyncExternalStore(
    detectionStore.subscribe,
    detectionStore.getAll,
    detectionStore.getAll
  );
}
