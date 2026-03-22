import { scrollAndCollect, ScrollDeps, ScrollConfig } from '../src/content/scroll';
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

/**
 * Fast config eliminates real delays in tests.
 * pollIntervalMs=1 + maxWaitMs=1 → inner poll loop executes at most once per cycle.
 * jitterRangeMs=1 → jitter is always 0 (Math.floor(Math.random() * 1) === 0).
 */
const FAST: ScrollConfig = {
  pollIntervalMs:  1,
  maxWaitMs:       1,
  jitterBaseMs:    0,
  jitterRangeMs:   1,
  stableThreshold: 2,
};

/**
 * Returns a mock for getRenderedCardCount that alternates between two values.
 * This makes the adaptive-wait inner loop break after the very first poll
 * (rawBefore !== current → break), keeping tests fast without real timeouts.
 */
function makeDomCounter(base = 0): jest.Mock {
  let call = 0;
  return jest.fn(() => (call++ % 2 === 0 ? base : base + 1));
}

function makeDeps(overrides: Partial<ScrollDeps> = {}): ScrollDeps {
  return {
    getCards:             jest.fn().mockReturnValue([]),
    triggerNextLoad:      jest.fn().mockReturnValue(true),
    wait:                 jest.fn().mockResolvedValue(undefined),
    getRenderedCardCount: makeDomCounter(),
    getTotalCount:        jest.fn().mockReturnValue(null),
    onProgress:           jest.fn(),
    ...overrides,
  };
}

describe('scrollAndCollect', () => {

  test('returns cards visible before first click even if no new cards appear', async () => {
    const deps = makeDeps({
      getCards:        jest.fn().mockReturnValue([makeConn(1)]),
      triggerNextLoad: jest.fn().mockReturnValue(false), // button absent immediately
    });
    const result = await scrollAndCollect(deps, FAST);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Person 1');
  });

  test('stops immediately when Load More button is absent', async () => {
    const deps = makeDeps({
      triggerNextLoad: jest.fn().mockReturnValue(false),
    });
    await scrollAndCollect(deps, FAST);
    expect(deps.wait).not.toHaveBeenCalled();
    expect(deps.triggerNextLoad).toHaveBeenCalledTimes(1);
  });

  test('stops after 2 stable cycles when button present but no new cards appear', async () => {
    // Pre-click: [1] already seen.  Click 1→no new (stableChecks=1).  Click 2→no new (stableChecks=2 → stop).
    const deps = makeDeps({
      getCards:        jest.fn().mockReturnValue([makeConn(1)]),
      triggerNextLoad: jest.fn().mockReturnValue(true),
    });
    await scrollAndCollect(deps, FAST);
    expect(deps.triggerNextLoad).toHaveBeenCalledTimes(2);
  });

  test('collects cards across cycles and deduplicates by profileUrl', async () => {
    // Pre-click: [1,2]  Click 1: [2,3]  Click 2: [3] (no new)  Click 3: [3] (no new) → stop
    const rounds = [
      [makeConn(1), makeConn(2)],
      [makeConn(2), makeConn(3)],
      [makeConn(3)],
      [makeConn(3)],
    ];
    let i = 0;
    const deps = makeDeps({
      getCards:        jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
      triggerNextLoad: jest.fn().mockReturnValue(true),
    });
    const result = await scrollAndCollect(deps, FAST);
    expect(result).toHaveLength(3);
    expect(result.map(c => c.name)).toEqual(
      expect.arrayContaining(['Person 1', 'Person 2', 'Person 3'])
    );
  });

  test('resets stable counter when new cards are found', async () => {
    // Pre-click: [1].  Click 1: [2] new → stableChecks=0.
    // Click 2: [2] none → stableChecks=1.  Click 3: [2] none → stableChecks=2 → stop.
    const rounds = [[makeConn(1)], [makeConn(2)], [makeConn(2)], [makeConn(2)]];
    let i = 0;
    const deps = makeDeps({
      getCards:        jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
      triggerNextLoad: jest.fn().mockReturnValue(true),
    });
    await scrollAndCollect(deps, FAST);
    expect(deps.triggerNextLoad).toHaveBeenCalledTimes(3);
  });

  test('stops when Load More button disappears mid-run', async () => {
    // Button present for first 2 clicks, then gone.
    const rounds = [[makeConn(1)], [makeConn(2)], [makeConn(3)]];
    let i = 0;
    let clickCount = 0;
    const deps = makeDeps({
      getCards:        jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
      triggerNextLoad: jest.fn(() => { clickCount++; return clickCount <= 2; }),
    });
    const result = await scrollAndCollect(deps, FAST);
    expect(deps.triggerNextLoad).toHaveBeenCalledTimes(3); // 2 true + 1 false
    expect(result).toHaveLength(3);
  });

  test('onProgress receives ProgressInfo with found and total after each cycle', async () => {
    // Pre-click: [1] → progress {found:1, total:5}
    // Click 1: [2] new → progress {found:2, total:5}
    // Clicks 2,3: no new → progress {found:2, total:5}  (stable threshold reached)
    const rounds = [[makeConn(1)], [makeConn(2)], [], []];
    let i = 0;
    const deps = makeDeps({
      getCards:      jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
      triggerNextLoad: jest.fn().mockReturnValue(true),
      getTotalCount: jest.fn().mockReturnValue(5),
    });
    await scrollAndCollect(deps, FAST);
    const calls = (deps.onProgress as jest.Mock).mock.calls;
    expect(calls[0][0]).toMatchObject({ found: 1, total: 5 });
    expect(calls[1][0]).toMatchObject({ found: 2, total: 5 });
    expect(calls[2][0]).toMatchObject({ found: 2, total: 5 });
  });

  test('onProgress receives null total and null remainingMs when count element absent', async () => {
    const deps = makeDeps({
      getCards:        jest.fn().mockReturnValue([makeConn(1)]),
      triggerNextLoad: jest.fn().mockReturnValue(false),
      getTotalCount:   jest.fn().mockReturnValue(null),
    });
    await scrollAndCollect(deps, FAST);
    const info = (deps.onProgress as jest.Mock).mock.calls[0][0];
    expect(info.total).toBeNull();
    expect(info.remainingMs).toBeNull();
  });

  test('handles empty page gracefully', async () => {
    const deps = makeDeps({
      getCards:        jest.fn().mockReturnValue([]),
      triggerNextLoad: jest.fn().mockReturnValue(false),
    });
    const result = await scrollAndCollect(deps, FAST);
    expect(result).toHaveLength(0);
  });

  test('simulates virtual list — collects all cards across recycled DOM windows', async () => {
    // Each round is a sliding DOM window (old cards removed, new ones added).
    // Button disappears after 3rd click (all loaded at that point).
    const window1 = Array.from({ length: 10 }, (_, i) => makeConn(i + 1));  // 1–10
    const window2 = Array.from({ length: 10 }, (_, i) => makeConn(i + 6));  // 6–15
    const window3 = Array.from({ length: 10 }, (_, i) => makeConn(i + 11)); // 11–20
    const window4 = Array.from({ length: 5  }, (_, i) => makeConn(i + 16)); // 16–20 (tail)
    const rounds  = [window1, window2, window3, window4];
    let i = 0;
    let clicks = 0;
    const deps = makeDeps({
      getCards:        jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
      triggerNextLoad: jest.fn(() => { clicks++; return clicks <= 3; }),
    });
    const result = await scrollAndCollect(deps, FAST);
    // window1 → 10 unique; window2 adds 5 (11–15); window3 adds 5 (16–20); window4 → 0 new
    expect(result).toHaveLength(20);
  });

  test('uses ScrollConfig values to override default timing', async () => {
    // stableThreshold: 1 → stops after a single no-growth cycle instead of two
    const deps = makeDeps({
      getCards:        jest.fn().mockReturnValue([makeConn(1)]),
      triggerNextLoad: jest.fn().mockReturnValue(true),
    });
    await scrollAndCollect(deps, { ...FAST, stableThreshold: 1 });
    expect(deps.triggerNextLoad).toHaveBeenCalledTimes(1);
  });

});
