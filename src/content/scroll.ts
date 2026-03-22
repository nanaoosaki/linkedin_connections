/**
 * Load-more orchestration for full-list export.
 *
 * LinkedIn's connections page uses a "Load more" button, not infinite scroll.
 * Cards are collected on every cycle and deduplicated by profileUrl (virtual
 * list removes old cards from the DOM as new ones are added).
 *
 * Performance: adaptive wait polls every POLL_INTERVAL_MS until new DOM cards
 * appear (or MAX_WAIT_MS elapses), then adds a small random jitter so the
 * click pattern does not look mechanically regular.
 *
 * All side-effectful operations are injected as dependencies so this module
 * is fully unit-testable without a real browser.
 * Timing constants are exposed via ScrollConfig so tests can override them
 * without real delays.
 */

import { Connection } from '../domain/connection';

export interface ProgressInfo {
  found:        number;         // unique connections collected so far
  total:        number | null;  // total from page element (null if unavailable)
  elapsedMs:    number;         // ms since export started
  remainingMs:  number | null;  // projected ms remaining (null if insufficient data)
}

export interface ScrollDeps {
  /** Returns all connection cards currently visible in the DOM. */
  getCards: () => Connection[];
  /**
   * Clicks the "Load more" button.
   * Returns true if found and clicked, false if absent (all loaded).
   */
  triggerNextLoad: () => boolean;
  /** Resolves after the given number of milliseconds. */
  wait: (ms: number) => Promise<void>;
  /** Raw count of card elements currently in the DOM (for adaptive wait polling). */
  getRenderedCardCount: () => number;
  /** Total connections shown on the page (e.g. "535 connections"). Null if unavailable. */
  getTotalCount: () => number | null;
  /** Called after each cycle with progress info for the UI. */
  onProgress: (info: ProgressInfo) => void;
}

export interface ScrollConfig {
  pollIntervalMs?: number;  // how often to check for new DOM cards (default 150)
  maxWaitMs?:      number;  // give up polling and proceed after this long (default 2000)
  jitterBaseMs?:   number;  // minimum extra pause after each load (default 100)
  jitterRangeMs?:  number;  // random extra on top of jitterBase (default 200)
  stableThreshold?: number; // consecutive no-growth cycles before stopping (default 2)
}

/**
 * Clicks "Load more" repeatedly, collecting and deduplicating connection cards
 * on every cycle. Uses adaptive polling to proceed as soon as new DOM cards
 * appear rather than waiting a fixed duration.
 *
 * Returns the full deduplicated collection.
 */
export async function scrollAndCollect(
  deps: ScrollDeps,
  config: ScrollConfig = {},
): Promise<Connection[]> {
  const {
    getCards, triggerNextLoad, wait,
    getRenderedCardCount, getTotalCount, onProgress,
  } = deps;

  const POLL_INTERVAL_MS  = config.pollIntervalMs  ?? 150;
  const MAX_WAIT_MS       = config.maxWaitMs       ?? 2000;
  const JITTER_BASE_MS    = config.jitterBaseMs    ?? 100;
  const JITTER_RANGE_MS   = config.jitterRangeMs   ?? 200;
  const STABLE_THRESHOLD  = config.stableThreshold ?? 2;

  const collected = new Map<string, Connection>();
  const startTime = Date.now();

  function ingest(cards: Connection[]): number {
    const before = collected.size;
    for (const card of cards) {
      const key = card.profileUrl || card.name;
      if (key && !collected.has(key)) collected.set(key, card);
    }
    return collected.size - before;
  }

  function buildProgress(): ProgressInfo {
    const elapsedMs   = Date.now() - startTime;
    const total       = getTotalCount();
    const found       = collected.size;
    const rate        = elapsedMs > 0 ? found / elapsedMs : 0; // connections per ms
    const remainingMs = rate > 0 && total !== null && total > found
      ? Math.round((total - found) / rate)
      : null;
    return { found, total, elapsedMs, remainingMs };
  }

  // Collect whatever is already visible before the first click
  ingest(getCards());
  onProgress(buildProgress());

  let stableChecks = 0;

  while (stableChecks < STABLE_THRESHOLD) {
    const hasMore = triggerNextLoad();
    if (!hasMore) break; // button gone — all connections loaded

    // Adaptive wait: poll until DOM card count changes or MAX_WAIT_MS elapses.
    // Uses an elapsed counter (not Date.now) so test mocks work without real delays.
    const rawBefore = getRenderedCardCount();
    let waited = 0;
    while (waited < MAX_WAIT_MS) {
      await wait(POLL_INTERVAL_MS);
      waited += POLL_INTERVAL_MS;
      if (getRenderedCardCount() !== rawBefore) break;
    }

    // Jitter: vary the pause between clicks so the pattern is not mechanically regular
    await wait(JITTER_BASE_MS + Math.floor(Math.random() * JITTER_RANGE_MS));

    const newCards = ingest(getCards());
    onProgress(buildProgress());

    if (newCards > 0) {
      stableChecks = 0;
    } else {
      stableChecks++;
    }
  }

  return Array.from(collected.values());
}
