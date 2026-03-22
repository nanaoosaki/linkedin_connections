import { scrollAndCollect, ScrollDeps } from '../src/content/scroll';
import { Connection } from '../src/domain/connection';

function makeConn(n: number): Connection {
  return {
    name: `Person ${n}`,
    profileUrl: `https://www.linkedin.com/in/person-${n}/`,
    headline: `Headline ${n}`,
    connectedOn: 'Connected on Jan 1, 2025',
    messageUrl: '',
  };
}

/** Build a deps object with sensible defaults; override per test. */
function makeDeps(overrides: Partial<ScrollDeps> = {}): ScrollDeps {
  return {
    getCards:      jest.fn().mockReturnValue([]),
    scrollToBottom: jest.fn(),
    wait:          jest.fn().mockResolvedValue(undefined),
    isEndOfList:   jest.fn().mockReturnValue(false),
    onProgress:    jest.fn(),
    ...overrides,
  };
}

describe('scrollAndCollect', () => {

  test('returns cards visible before first scroll even if no new cards appear', async () => {
    const deps = makeDeps({
      getCards: jest.fn().mockReturnValue([makeConn(1)]),
    });
    const result = await scrollAndCollect(deps);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Person 1');
  });

  test('stops after 2 stable cycles when no new cards appear', async () => {
    const deps = makeDeps({
      getCards: jest.fn().mockReturnValue([makeConn(1)]), // same card every call
    });
    await scrollAndCollect(deps);
    expect(deps.scrollToBottom).toHaveBeenCalledTimes(2);
  });

  test('collects cards across cycles — deduplicates by profileUrl', async () => {
    // Cycle 0 (pre-scroll): cards 1-2
    // Cycle 1: cards 2-3  (card 2 is a duplicate)
    // Cycle 2: cards 3    (no new)
    // Cycle 3: cards 3    (no new) → stop
    const rounds = [
      [makeConn(1), makeConn(2)],
      [makeConn(2), makeConn(3)],
      [makeConn(3)],
      [makeConn(3)],
    ];
    let i = 0;
    const deps = makeDeps({
      getCards: jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
    });
    const result = await scrollAndCollect(deps);
    expect(result).toHaveLength(3);
    expect(result.map(c => c.name)).toEqual(
      expect.arrayContaining(['Person 1', 'Person 2', 'Person 3'])
    );
  });

  test('resets stable counter when new cards are found', async () => {
    // Pre-scroll: [1], scroll1: [2] (new→reset), scroll2: [2] (none), scroll3: [2] (none→stop)
    const rounds = [[makeConn(1)], [makeConn(2)], [makeConn(2)], [makeConn(2)]];
    let i = 0;
    const deps = makeDeps({
      getCards: jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
    });
    await scrollAndCollect(deps);
    expect(deps.scrollToBottom).toHaveBeenCalledTimes(3);
  });

  test('stops immediately when isEndOfList returns true — skips scroll', async () => {
    // isEndOfList is checked before scrollToBottom, so the loop breaks
    // without scrolling when the end-of-list sentinel is already present.
    const deps = makeDeps({
      getCards:    jest.fn().mockReturnValue([makeConn(1)]),
      isEndOfList: jest.fn().mockReturnValue(true),
    });
    await scrollAndCollect(deps);
    expect(deps.scrollToBottom).toHaveBeenCalledTimes(0);
  });

  test('calls onProgress with cumulative count after each cycle', async () => {
    // Pre-scroll: [1] → progress(1)
    // Scroll 1: [2] → progress(2)
    // Scroll 2: []  → progress(2), stableChecks=1
    // Scroll 3: []  → progress(2), stableChecks=2 → stop
    const rounds = [[makeConn(1)], [makeConn(2)], [], []];
    let i = 0;
    const deps = makeDeps({
      getCards: jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
    });
    await scrollAndCollect(deps);
    expect(deps.onProgress).toHaveBeenNthCalledWith(1, 1); // pre-scroll
    expect(deps.onProgress).toHaveBeenNthCalledWith(2, 2); // after scroll 1
    expect(deps.onProgress).toHaveBeenNthCalledWith(3, 2); // after scroll 2
  });

  test('calls wait with 900ms on every scroll cycle', async () => {
    const deps = makeDeps({ getCards: jest.fn().mockReturnValue([]) });
    await scrollAndCollect(deps);
    expect(deps.wait).toHaveBeenCalledTimes(2);
    expect(deps.wait).toHaveBeenCalledWith(900);
  });

  test('handles empty page gracefully', async () => {
    const deps = makeDeps({ getCards: jest.fn().mockReturnValue([]) });
    const result = await scrollAndCollect(deps);
    expect(result).toHaveLength(0);
  });

  test('simulates virtual list — collects all cards even when old ones leave the DOM', async () => {
    // Each round represents the current DOM window (old cards removed, new cards added)
    // Round 0 (pre-scroll): connections 1-10
    // Round 1: connections 6-15 (5 recycled, 5 new)
    // Round 2: connections 11-20 (5 more recycled, 5 new)
    // Round 3: connections 16-20 (no new vs round 2) → stableChecks=1
    // Round 4: connections 16-20 (no new)             → stableChecks=2 → stop
    const window1  = Array.from({ length: 10 }, (_, i) => makeConn(i + 1));
    const window2  = Array.from({ length: 10 }, (_, i) => makeConn(i + 6));
    const window3  = Array.from({ length: 10 }, (_, i) => makeConn(i + 11));
    const window4  = Array.from({ length: 5  }, (_, i) => makeConn(i + 16));
    const rounds   = [window1, window2, window3, window4, window4];
    let i = 0;
    const deps = makeDeps({
      getCards: jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
    });
    const result = await scrollAndCollect(deps);
    // Should have collected all 20 unique connections despite virtual recycling
    expect(result).toHaveLength(20);
  });

});
