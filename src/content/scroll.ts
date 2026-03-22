/**
 * Scroll orchestration for full-list export.
 *
 * All side-effectful operations are injected as dependencies so this module
 * is fully unit-testable without a real browser. The real implementations are
 * wired in src/content/index.ts; tests inject mocks.
 */

export interface ScrollDeps {
  /** Returns the number of connection cards currently in the DOM. */
  getCardCount: () => number;
  /** Scrolls the page to the bottom of current content. */
  scrollToBottom: () => void;
  /** Resolves after the given number of milliseconds. */
  wait: (ms: number) => Promise<void>;
  /** Returns true if LinkedIn has rendered its end-of-list indicator. */
  isEndOfList: () => boolean;
  /** Called after each scroll+wait cycle with the current card count. */
  onProgress: (count: number) => void;
}

/**
 * Scrolls incrementally until no new cards appear for STABLE_THRESHOLD
 * consecutive cycles, or until the end-of-list indicator is detected.
 *
 * Returns the final card count.
 */
export async function scrollUntilStable(deps: ScrollDeps): Promise<number> {
  const { getCardCount, scrollToBottom, wait, isEndOfList, onProgress } = deps;

  const STABLE_THRESHOLD = 2; // consecutive no-growth cycles before stopping
  const WAIT_MS = 900;        // ms to wait after each scroll for LinkedIn to render

  let stableChecks = 0;

  while (stableChecks < STABLE_THRESHOLD) {
    const before = getCardCount();
    scrollToBottom();
    await wait(WAIT_MS);
    const after = getCardCount();
    onProgress(after);

    if (isEndOfList()) break;

    if (after > before) {
      stableChecks = 0; // growth observed — reset and keep scrolling
    } else {
      stableChecks++;   // no growth — count toward stop condition
    }
  }

  return getCardCount();
}
