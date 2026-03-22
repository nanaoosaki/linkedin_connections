import { scrollUntilStable, ScrollDeps } from '../src/content/scroll';

/** Build a deps object with sensible defaults; override per test. */
function makeDeps(overrides: Partial<ScrollDeps> = {}): ScrollDeps {
  return {
    getCardCount:  jest.fn().mockReturnValue(0),
    scrollToBottom: jest.fn(),
    wait:          jest.fn().mockResolvedValue(undefined),
    isEndOfList:   jest.fn().mockReturnValue(false),
    onProgress:    jest.fn(),
    ...overrides,
  };
}

describe('scrollUntilStable', () => {

  test('stops after 2 consecutive stable checks when count never grows', async () => {
    const deps = makeDeps({ getCardCount: jest.fn().mockReturnValue(10) });
    await scrollUntilStable(deps);
    expect(deps.scrollToBottom).toHaveBeenCalledTimes(2);
  });

  test('resets stable counter when cards grow, then stops once growth plateaus', async () => {
    // getCardCount is called TWICE per iteration (before + after).
    // Growth is only visible when the count changes between those two calls.
    // counts: before1=10, after1=20 → growth (stable=0)
    //         before2=20, after2=20 → stable=1
    //         before3=20, after3=20 → stable=2 → stop
    const counts = [10, 20, 20, 20, 20];
    let i = 0;
    const deps = makeDeps({
      getCardCount: jest.fn(() => counts[Math.min(i++, counts.length - 1)]),
    });
    await scrollUntilStable(deps);
    expect(deps.scrollToBottom).toHaveBeenCalledTimes(3);
  });

  test('stops immediately when isEndOfList returns true', async () => {
    const deps = makeDeps({
      getCardCount:  jest.fn().mockReturnValue(40),
      isEndOfList:   jest.fn().mockReturnValue(true),
    });
    await scrollUntilStable(deps);
    expect(deps.scrollToBottom).toHaveBeenCalledTimes(1);
  });

  test('calls onProgress after every scroll+wait cycle', async () => {
    const counts = [5, 5, 5]; // stops after 2 stable checks
    let i = 0;
    const deps = makeDeps({
      getCardCount: jest.fn(() => counts[Math.min(i++, counts.length - 1)]),
    });
    await scrollUntilStable(deps);
    expect(deps.onProgress).toHaveBeenCalledTimes(2);
    expect(deps.onProgress).toHaveBeenCalledWith(5);
  });

  test('calls wait once per scroll cycle', async () => {
    const deps = makeDeps({ getCardCount: jest.fn().mockReturnValue(0) });
    await scrollUntilStable(deps);
    expect(deps.wait).toHaveBeenCalledTimes(2);
    expect(deps.wait).toHaveBeenCalledWith(900);
  });

  test('returns final card count', async () => {
    const deps = makeDeps({ getCardCount: jest.fn().mockReturnValue(137) });
    const result = await scrollUntilStable(deps);
    expect(result).toBe(137);
  });

  test('handles zero cards gracefully — stops after 2 stable checks', async () => {
    const deps = makeDeps({ getCardCount: jest.fn().mockReturnValue(0) });
    const result = await scrollUntilStable(deps);
    expect(result).toBe(0);
    expect(deps.scrollToBottom).toHaveBeenCalledTimes(2);
  });

  test('continuously growing list keeps scrolling until stable', async () => {
    // Two growth events (each resets the stable counter), then plateau.
    // before1=10, after1=20 → growth (stable=0)
    // before2=20, after2=30 → growth (stable=0)
    // before3=30, after3=30 → stable=1
    // before4=30, after4=30 → stable=2 → stop
    const counts = [10, 20, 20, 30, 30, 30, 30];
    let i = 0;
    const deps = makeDeps({
      getCardCount: jest.fn(() => counts[Math.min(i++, counts.length - 1)]),
    });
    await scrollUntilStable(deps);
    expect(deps.scrollToBottom).toHaveBeenCalledTimes(4);
  });

});
