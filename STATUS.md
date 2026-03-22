# Project Status

**Last updated:** 2026-03-22 (v3 — adaptive wait + time estimation, 28 tests)
**Extension:** LinkedIn Connections Exporter (Manifest V3, TypeScript)

---

## Build / test status

| Check | Result |
|-------|--------|
| `npm run lint` | ✓ zero errors |
| `npm run typecheck` | ✓ zero errors |
| `npm test` | ✓ 28/28 pass (3 suites) |
| `npm run build` | ✓ `dist/` produced cleanly |

Run all four at once: `npm run check`

---

## Live validation results

| Date | Test | Result |
|------|------|--------|
| 2026-03-22 | Basic export — 10 visible connections | ✓ CSV correct, all fields populated |
| 2026-03-22 | Full export — 535 connections via Load More loop | ✓ All connections exported in one click |

---

## What has been delivered

| Artifact | Purpose |
|----------|---------|
| `src/content/selectors.ts` | All LinkedIn DOM strings; zero obfuscated class names; stability-annotated |
| `src/domain/connection.ts` | `Connection` interface — single schema definition |
| `src/content/parser.ts` | Extracts cards using structural and text-pattern selectors |
| `src/content/scroll.ts` | `scrollAndCollect()` — Load More loop with injectable deps, fully unit-tested |
| `src/content/index.ts` | Content script — wires real deps, handles EXPORT + PROGRESS messages |
| `src/export/csv.ts` | RFC 4180 CSV builder with formula-injection safety |
| `src/popup/index.ts` | Popup — injects script, polls progress, determinate/indeterminate bar, time-remaining estimate |
| `popup.html` | Export button + progress bar + ETA line (`#eta`) |
| `manifest.json` | MV3, minimal permissions (`activeTab`, `scripting`) |
| `tests/csv.test.ts` | 5 tests: header, quoting, formula-injection |
| `tests/parser.test.ts` | 12 fixture-based tests: exact values + invariants across all cards |
| `tests/scroll.test.ts` | 11 tests: Load More loop, adaptive wait, dedup, ProgressInfo, virtual list simulation |
| `tests/fixtures/connection-card-basic.html` | Single card in correct lazy-column ancestry |
| `tests/fixtures/connections-list-basic.html` | Real multi-card list — parser regression fixture |
| `tests/fixtures/connections-load-more-button.html` | Load More button outerHTML — selector reference |
| `.claude/agents/extension-reviewer.md` | Reviewer subagent with MV3/security/selector checklist |
| `TESTING.md` | Two-layer guide: automated fixture checks + manual Chrome unpacked steps |
| `.github/workflows/ci.yml` | CI: lint → typecheck → test → build → artifact verification |
| `scripts/check.sh` + `scripts/install-hooks.sh` | Local gate + pre-commit hook |
| `AI_ENGINEERING_NOTES.md` | Full engineering log: decisions, discoveries, design principles |
| `LINKEDIN_EXPORT_HOWTO.md` | Plain-language end-user install and usage guide |

---

## Iteration history

| Version | Date | Key change |
|---------|------|------------|
| v1 | 2026-03-19 | Basic export of visible connections only |
| v1.1 | 2026-03-21 | Fixture hardening; obfuscated class selectors removed; 10→17 tests |
| v1.2 | 2026-03-22 | Robust injection via scripting API; `window.__liExporterLoaded` guard |
| v2.0 | 2026-03-22 | Auto-scroll loop + progress indicator (scroll approach — pre-discovery) |
| v2.1 | 2026-03-22 | Virtual list fix: collect-while-scrolling with Map deduplication |
| v2.2 | 2026-03-22 | **Load More button click loop** — scroll was wrong mechanism entirely; 27 tests; 535 connections validated |
| v3.0 | 2026-03-22 | **Adaptive wait + time estimation** — replaces fixed 1200ms wait; `ProgressInfo` with ETA; 28 tests |

---

## What changed in v3.0 (current)

**Adaptive wait replaces fixed 1200ms delay.** The inner polling loop (150ms interval, 2000ms ceiling) watches `getRenderedCardCount()` and proceeds as soon as new DOM cards appear, rather than waiting a fixed duration. Random jitter (100–300ms) is added after each click so the click pattern is not mechanically regular.

**Time estimation added to progress bar.** When LinkedIn's total count element is found, the popup shows a determinate progress bar (`X / total`) and a projected time-remaining line (`~Nm Ns remaining`). When total is unavailable, the bar remains indeterminate and no ETA is shown.

**`ProgressInfo` replaces bare count.** `onProgress` now receives `{ found, total, elapsedMs, remainingMs }`. The PROGRESS poll in the popup reads all four fields and renders accordingly.

**`ScrollConfig` interface** allows timing constants (`pollIntervalMs`, `maxWaitMs`, `jitterBaseMs`, `jitterRangeMs`, `stableThreshold`) to be injected. Tests use `FAST` config (1ms intervals) and an alternating `makeDomCounter()` mock so the adaptive inner loop exits on the first poll — no real timeouts needed.

**`popup.html`** gained an `#eta` div for the time-remaining line; popup width increased to 260px.

---

## What changed in v2.2

**Root cause discovered through live testing:** LinkedIn's connections page uses a **"Load more" button**, not infinite scroll. Programmatic scrolling (`scrollTop = scrollHeight`) had no effect on card loading regardless of which scroll container was targeted. The `<main id="workspace">` element is the page scroll container but clicking the Load More button is the only mechanism that loads new cards.

**The Load More button** has no `data-testid`, `id`, or `aria-label` — only obfuscated class names. It is located by text content `"Load more"` (same pattern used for "Connected on" date detection).

**`scrollAndCollect` redesign:**
- `scrollToBottom` + `isEndOfList` deps replaced by single `triggerNextLoad(): boolean`
- Clicks the button; returns `false` when button absent (natural end-of-list signal)
- Wait increased from 900ms → 1200ms (button click + render is slower than scroll)
- Stop condition: button absent OR 2 consecutive cycles with no new unique connections

**Fixtures added:** `tests/fixtures/connections-load-more-button.html` — outerHTML of the Load More button for selector reference.

---

## Known limitations

| Limitation | Severity | Notes |
|-----------|----------|-------|
| `PROFILE_TEXT_LINK` uses `:not([style])` | Medium | If LinkedIn adds inline style to the text anchor, name/headline silently breaks |
| `LOAD_MORE_BUTTON_TEXT` matched by text content | Medium | If LinkedIn translates or renames the button, loop stops immediately with 0 new loads |
| `CONNECTIONS_TOTAL` selector needs live validation | Medium | Best-guess selector — returns null gracefully if not found; shows indeterminate bar |
| No test for missing headline or messageUrl | Low | Empty-field degradation path implemented but not explicitly tested |
| `ts-jest` deprecation warning | Low | Cosmetic; does not affect correctness |

---

## Next recommended steps

- Capture updated fixture if LinkedIn changes DOM structure (run DevTools snippet in REVIEW.md to check)
- Consider making the 1200ms wait configurable via popup UI (power user option)
- Add `connections-load-more-button.html` fixture into a parser/selector regression test
