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
    getCards:        jest.fn().mockReturnValue([]),
    triggerNextLoad: jest.fn().mockReturnValue(true),
    wait:            jest.fn().mockResolvedValue(undefined),
    onProgress:      jest.fn(),
    ...overrides,
  };
}

describe('scrollAndCollect', () => {

  test('returns cards visible before first click even if no new cards appear', async () => {
    const deps = makeDeps({
      getCards:        jest.fn().mockReturnValue([makeConn(1)]),
      triggerNextLoad: jest.fn().mockReturnValue(false), // button absent immediately
    });
    const result = await scrollAndCollect(deps);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Person 1');
  });

  test('stops immediately when Load More button is absent', async () => {
    const deps = makeDeps({
      triggerNextLoad: jest.fn().mockReturnValue(false),
    });
    await scrollAndCollect(deps);
    expect(deps.wait).not.toHaveBeenCalled();
    expect(deps.triggerNextLoad).toHaveBeenCalledTimes(1);
  });

  test('stops after 2 stable cycles when button is present but no new cards appear', async () => {
    // button always present, but same cards every time
    const deps = makeDeps({
      getCards:        jest.fn().mockReturnValue([makeConn(1)]),
      triggerNextLoad: jest.fn().mockReturnValue(true),
    });
    await scrollAndCollect(deps);
    // click 1: no new → stableChecks=1
    // click 2: no new → stableChecks=2 → stop
    expect(deps.triggerNextLoad).toHaveBeenCalledTimes(2);
  });

  test('collects cards across cycles and deduplicates by profileUrl', async () => {
    // Pre-click: [1,2] — Click 1: [2,3] — Click 2: [3] (no new) — Click 3: [3] → stop
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
    const result = await scrollAndCollect(deps);
    expect(result).toHaveLength(3);
    expect(result.map(c => c.name)).toEqual(
      expect.arrayContaining(['Person 1', 'Person 2', 'Person 3'])
    );
  });

  test('resets stable counter when new cards are found', async () => {
    // Pre-click: [1]
    // Click 1: [2] new → stableChecks=0
    // Click 2: [2] none → stableChecks=1
    // Click 3: [2] none → stableChecks=2 → stop
    const rounds = [[makeConn(1)], [makeConn(2)], [makeConn(2)], [makeConn(2)]];
    let i = 0;
    const deps = makeDeps({
      getCards:        jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
      triggerNextLoad: jest.fn().mockReturnValue(true),
    });
    await scrollAndCollect(deps);
    expect(deps.triggerNextLoad).toHaveBeenCalledTimes(3);
  });

  test('stops when button disappears mid-run', async () => {
    // Button present for first 2 clicks, then gone
    const rounds = [[makeConn(1)], [makeConn(2)], [makeConn(3)]];
    let i = 0;
    let clickCount = 0;
    const deps = makeDeps({
      getCards:        jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
      triggerNextLoad: jest.fn(() => { clickCount++; return clickCount <= 2; }),
    });
    const result = await scrollAndCollect(deps);
    expect(deps.triggerNextLoad).toHaveBeenCalledTimes(3); // 2 true + 1 false
    expect(result).toHaveLength(3);
  });

  test('calls onProgress with cumulative count after each cycle', async () => {
    // Pre-click: [1] → progress(1)
    // Click 1: [2] → progress(2)
    // Click 2: []  → progress(2), stableChecks=1
    // Click 3: []  → progress(2), stableChecks=2 → stop
    const rounds = [[makeConn(1)], [makeConn(2)], [], []];
    let i = 0;
    const deps = makeDeps({
      getCards:        jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
      triggerNextLoad: jest.fn().mockReturnValue(true),
    });
    await scrollAndCollect(deps);
    expect(deps.onProgress).toHaveBeenNthCalledWith(1, 1);
    expect(deps.onProgress).toHaveBeenNthCalledWith(2, 2);
    expect(deps.onProgress).toHaveBeenNthCalledWith(3, 2);
  });

  test('calls wait with 1200ms on every click cycle', async () => {
    const deps = makeDeps({ getCards: jest.fn().mockReturnValue([]) });
    await scrollAndCollect(deps);
    expect(deps.wait).toHaveBeenCalledTimes(2);
    expect(deps.wait).toHaveBeenCalledWith(1200);
  });

  test('handles empty page gracefully', async () => {
    const deps = makeDeps({
      getCards:        jest.fn().mockReturnValue([]),
      triggerNextLoad: jest.fn().mockReturnValue(false),
    });
    const result = await scrollAndCollect(deps);
    expect(result).toHaveLength(0);
  });

  test('simulates virtual list — collects all cards across recycled DOM windows', async () => {
    // Each round is a different DOM window; old cards are removed as new ones are added.
    // Button disappears after window4 (all loaded).
    const window1 = Array.from({ length: 10 }, (_, i) => makeConn(i + 1));
    const window2 = Array.from({ length: 10 }, (_, i) => makeConn(i + 6));
    const window3 = Array.from({ length: 10 }, (_, i) => makeConn(i + 11));
    const window4 = Array.from({ length: 5  }, (_, i) => makeConn(i + 16));
    const rounds  = [window1, window2, window3, window4];
    let i = 0;
    let clicks = 0;
    const deps = makeDeps({
      getCards:        jest.fn(() => rounds[Math.min(i++, rounds.length - 1)]),
      // Button disappears after 3 clicks (window4 is last batch)
      triggerNextLoad: jest.fn(() => { clicks++; return clicks <= 3; }),
    });
    const result = await scrollAndCollect(deps);
    expect(result).toHaveLength(20);
  });

});
