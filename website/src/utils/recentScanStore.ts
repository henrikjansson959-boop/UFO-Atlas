import type { ScanResult } from '../types';

const RECENT_SCANS_STORAGE_KEY = 'ufo-atlas-recent-scans';
const MAX_RECENT_SCANS = 50;

export type RecentScanEntry = {
  scanJobId: string;
  searchTimestamp: string;
  promptText: string;
  durationMs: number;
  queriesUsed: string[];
  discoveredUrls: string[];
  keywordsUsed: string[];
  aiAssistRequested: boolean;
  aiAssistApplied: boolean;
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getRecentScans(): RecentScanEntry[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_SCANS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RecentScanEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentScan(result: ScanResult, promptText: string): void {
  if (!canUseStorage()) {
    return;
  }

  const nextEntry: RecentScanEntry = {
    scanJobId: result.scanJobId,
    searchTimestamp: result.searchTimestamp,
    promptText,
    durationMs: result.durationMs,
    queriesUsed: result.queriesUsed,
    discoveredUrls: result.discoveredUrls,
    keywordsUsed: result.keywordsUsed,
    aiAssistRequested: result.aiAssistRequested,
    aiAssistApplied: result.aiAssistApplied,
  };

  const nextEntries = [
    nextEntry,
    ...getRecentScans().filter((entry) => entry.scanJobId !== result.scanJobId),
  ].slice(0, MAX_RECENT_SCANS);

  window.localStorage.setItem(RECENT_SCANS_STORAGE_KEY, JSON.stringify(nextEntries));
}

export function getRecentScanByJobId(scanJobId: string): RecentScanEntry | null {
  return getRecentScans().find((entry) => entry.scanJobId === scanJobId) ?? null;
}
