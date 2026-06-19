'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

type PerfEntry = {
  renders: number;
  commits: number;
  totalActualDuration: number;
  maxActualDuration: number;
  lastActualDuration: number;
  lastPhase: 'mount' | 'update' | 'nested-update' | null;
};

type PerfStore = {
  entries: Record<string, PerfEntry>;
  sequence: number;
};

type PerfSnapshot = Record<string, PerfEntry>;

declare global {
  interface Window {
    __PVX_PERF__?: {
      getSnapshot: () => PerfSnapshot;
      reset: () => void;
      mark: (label: string) => void;
      getMarks: () => string[];
    };
  }
}

const subscribers = new Set<() => void>();
const marks: string[] = [];

const store: PerfStore = {
  entries: {},
  sequence: 0,
};

function notify() {
  subscribers.forEach((subscriber) => subscriber());
}

function getEntry(id: string): PerfEntry {
  if (!store.entries[id]) {
    store.entries[id] = {
      renders: 0,
      commits: 0,
      totalActualDuration: 0,
      maxActualDuration: 0,
      lastActualDuration: 0,
      lastPhase: null,
    };
  }
  return store.entries[id];
}

export function resetPerfMetrics() {
  store.entries = {};
  store.sequence += 1;
  marks.length = 0;
  notify();
}

export function markPerf(label: string) {
  marks.push(`${new Date().toISOString()} ${label}`);
}

export function getPerfSnapshot(): PerfSnapshot {
  return JSON.parse(JSON.stringify(store.entries)) as PerfSnapshot;
}

export function ensurePerfWindow() {
  if (typeof window === 'undefined') return;
  window.__PVX_PERF__ = {
    getSnapshot: getPerfSnapshot,
    reset: resetPerfMetrics,
    mark: markPerf,
    getMarks: () => [...marks],
  };
}

function getExternalSnapshot() {
  return store.sequence;
}

export function usePerfSnapshot() {
  useSyncExternalStore(
    (subscriber) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    getExternalSnapshot,
    () => 0,
  );

  return useMemo(() => getPerfSnapshot(), [store.sequence]);
}

export function useRenderTracker(id: string) {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  useEffect(() => {
    const entry = getEntry(id);
    if (entry.renders !== renderCountRef.current) {
      entry.renders = renderCountRef.current;
      store.sequence += 1;
      notify();
    }
  });
}

export function trackProfilerCommit(
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
) {
  const entry = getEntry(id);
  entry.commits += 1;
  entry.totalActualDuration += actualDuration;
  entry.maxActualDuration = Math.max(entry.maxActualDuration, actualDuration);
  entry.lastActualDuration = actualDuration;
  entry.lastPhase = phase;
  store.sequence += 1;
  notify();
}
