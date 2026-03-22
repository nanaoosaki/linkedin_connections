/**
 * Load-more orchestration for full-list export.
 *
 * LinkedIn's connections page uses a "Load more" button, not infinite scroll.
 * Programmatic scrolling does not trigger card loading. The correct approach
 * is to find the button, click it, wait for new cards to render, and repeat
 * until the button disappears (all connections loaded) or no new unique
 * connections appear for STABLE_THRESHOLD consecutive cycles.
 *
 * LinkedIn also virtualises the list: cards that scroll out of view are
 * removed from the DOM. Cards are collected on every cycle and deduplicated
 * by profileUrl so nothing is lost when the DOM window slides.
 *
 * All side-effectful operations are injected as dependencies so this module
 * is fully unit-testable without a real browser.
 */

import { Connection } from '../domain/connection';

export interface ScrollDeps {
  /** Returns all connection cards currently visible in the DOM. */
  getCards: () => Connection[];
  /**
   * Finds the "Load more" button and clicks it.
   * Returns true if the button was found and clicked.
   * Returns false if the button is absent — signals all connections are loaded.
   */
  triggerNextLoad: () => boolean;
  /** Resolves after the given number of milliseconds. */
  wait: (ms: number) => Promise<void>;
  /** Called after each cycle with the total unique connections collected so far. */
  onProgress: (count: number) => void;
}

/**
 * Clicks "Load more" repeatedly, collecting and deduplicating connection cards
 * on every cycle. Stops when the button disappears or no new unique connections
 * appear for STABLE_THRESHOLD consecutive cycles.
 *
 * Returns the full deduplicated collection.
 */
export async function scrollAndCollect(deps: ScrollDeps): Promise<Connection[]> {
  const { getCards, triggerNextLoad, wait, onProgress } = deps;

  const STABLE_THRESHOLD = 2;
  const WAIT_MS = 1200; // button click + LinkedIn render is slower than a scroll event

  const collected = new Map<string, Connection>();

  function ingest(cards: Connection[]): number {
    const before = collected.size;
    for (const card of cards) {
      const key = card.profileUrl || card.name;
      if (key && !collected.has(key)) collected.set(key, card);
    }
    return collected.size - before;
  }

  // Collect whatever is already visible before the first click
  ingest(getCards());
  onProgress(collected.size);

  let stableChecks = 0;

  while (stableChecks < STABLE_THRESHOLD) {
    const hasMore = triggerNextLoad();
    if (!hasMore) break; // button gone — all connections loaded

    await wait(WAIT_MS);

    const newCards = ingest(getCards());
    onProgress(collected.size);

    if (newCards > 0) {
      stableChecks = 0;
    } else {
      stableChecks++;
    }
  }

  return Array.from(collected.values());
}
