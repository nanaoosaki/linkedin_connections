/**
 * Scroll orchestration for full-list export.
 *
 * LinkedIn renders its connections list as a true virtual list: cards are
 * added to the DOM as you scroll down AND removed from the DOM as they
 * scroll out of view. Parsing after scrolling only captures the final
 * visible window. The correct approach is to collect cards on every cycle
 * and deduplicate by profileUrl across the entire run.
 *
 * All side-effectful operations are injected as dependencies so this module
 * is fully unit-testable without a real browser.
 */

import { Connection } from '../domain/connection';

export interface ScrollDeps {
  /** Returns all connection cards currently visible in the DOM. */
  getCards: () => Connection[];
  /** Scrolls the page to the bottom of current content. */
  scrollToBottom: () => void;
  /** Resolves after the given number of milliseconds. */
  wait: (ms: number) => Promise<void>;
  /** Returns true if LinkedIn has rendered its end-of-list indicator. */
  isEndOfList: () => boolean;
  /** Called after each cycle with the total number of unique connections collected so far. */
  onProgress: (count: number) => void;
}

/**
 * Scrolls the page incrementally, collecting and deduplicating connection
 * cards on every cycle. Stops when no new unique connections are found for
 * STABLE_THRESHOLD consecutive cycles, or when the end-of-list indicator
 * is detected.
 *
 * Returns the full deduplicated collection.
 */
export async function scrollAndCollect(deps: ScrollDeps): Promise<Connection[]> {
  const { getCards, scrollToBottom, wait, isEndOfList, onProgress } = deps;

  const STABLE_THRESHOLD = 2;
  const WAIT_MS = 900;

  // profileUrl is the dedup key; fall back to name for cards without a URL
  const collected = new Map<string, Connection>();

  function ingest(cards: Connection[]): number {
    const before = collected.size;
    for (const card of cards) {
      const key = card.profileUrl || card.name;
      if (key && !collected.has(key)) collected.set(key, card);
    }
    return collected.size - before; // returns number of newly added cards
  }

  // Collect whatever is already visible before the first scroll
  ingest(getCards());
  onProgress(collected.size);

  let stableChecks = 0;

  while (stableChecks < STABLE_THRESHOLD) {
    if (isEndOfList()) break;

    scrollToBottom();
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
