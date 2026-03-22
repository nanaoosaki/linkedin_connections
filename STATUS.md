# Project Status

**Last updated:** 2026-03-22 (v2 auto-scroll)
**Extension:** LinkedIn Connections Exporter (Manifest V3, TypeScript)

---

## Build / test status

| Check | Result |
|-------|--------|
| `npm run lint` | ✓ zero errors |
| `npm run typecheck` | ✓ zero errors |
| `npm test` | ✓ 26/26 pass (3 suites) |
| `npm run build` | ✓ `dist/` produced cleanly |

Run all four at once: `npm run check`

---

## What has been delivered

| Artifact | Purpose |
|----------|---------|
| `src/content/scroll.ts` | Auto-scroll loop with injectable deps — fully unit-tested |
| `src/domain/connection.ts` | `Connection` interface — single schema definition |
| `src/content/selectors.ts` | All LinkedIn DOM selectors in one file; zero obfuscated class names |
| `src/content/parser.ts` | Extracts cards using structural and text-pattern selectors |
| `src/export/csv.ts` | RFC 4180 CSV builder with formula-injection safety |
| `src/content/index.ts` | Content script — listens for `EXPORT` message, triggers download |
| `src/popup/index.ts` + `popup.html` | Extension popup with Export button and status feedback |
| `manifest.json` | MV3 manifest, minimal permissions (`activeTab`, `scripting`) |
| `tests/csv.test.ts` | 5 unit tests: header, quoting, formula-injection prefix |
| `tests/parser.test.ts` | 12 fixture-based tests: exact values (single card) + invariants (list) |
| `tests/fixtures/connection-card-basic.html` | Single card wrapped in correct lazy-column ancestry |
| `tests/fixtures/connections-list-basic.html` | Real multi-card list — primary parser regression fixture |
| `.claude/agents/extension-reviewer.md` | Reviewer subagent with MV3/security/selector checklist |
| `TESTING.md` | Two-layer test guide (automated + manual Chrome unpacked) |
| `.github/workflows/ci.yml` | GitHub Actions CI: lint → typecheck → test → build → artifact check |
| `scripts/check.sh` | Local quality gate script |
| `scripts/install-hooks.sh` | Installs git pre-commit hook that runs the full gate |
| `AI_ENGINEERING_NOTES.md` | Engineering log: decisions, drift, human interventions |

---

## Live validation result

Tested on a real LinkedIn connections page on 2026-03-22. Downloaded **10 connections** successfully. CSV contained correct name, profileUrl, headline, connectedOn, and messageUrl fields.

Initial attempt produced `"Could not establish connection. Receiving end does not exist."` — caused by the connections page being open before the extension was loaded. Refreshing the page resolved it under the original design. The injection fix below removes this requirement permanently.

---

## What changed in the latest iteration

**Auto-scroll with progress indicator (2026-03-22 v2)**

One-click full export. The content script now scrolls the page to the bottom incrementally, waits 900ms per cycle for LinkedIn to render new cards, and repeats until the card count is stable for 2 consecutive cycles. The popup shows a live count (`Loading connections… N found`) via 800ms polling, an indeterminate progress bar, and a disabled Export button during the run.

The scroll loop lives in `src/content/scroll.ts` with all browser side-effects injected as dependencies, enabling full unit test coverage without a browser. 8 new tests added; test count 17 → 25.

The `END_OF_LIST` selector in `selectors.ts` is a placeholder pending live validation — the stable-count stop condition works correctly without it.

**Robust injection (2026-03-22)**

The popup now programmatically injects `content.js` via `chrome.scripting.executeScript` before sending the Export message. This means Export works regardless of whether the connections page was open before or after the extension was loaded. A `window.__liExporterLoaded` flag prevents double-registration of the message listener if the script is injected into a tab where it was already running.

The manifest `content_scripts` entry is kept as a first-pass optimisation (pre-injects on navigation) but is no longer the sole injection path.

**Fixture fix**
`tests/fixtures/connection-card-basic.html` was previously a bare card element with no ancestor structure. It is now wrapped in the full `[data-testid="lazy-column"] > [data-display-contents="true"] > [componentkey]` ancestry that the card selector requires.

**Selector strategy — obfuscated class names removed**
All three fragile class-based selectors (`p[class*="b21f8722"]`, `p[class*="b3be7b7c"]`, `p[class*="_7dc1e841"]`) were deleted from `selectors.ts`. Replaced with:

| Field | Old approach | New approach |
|-------|-------------|--------------|
| Name | `p[class*="b21f8722"]` | First `<p>` inside `PROFILE_TEXT_LINK` |
| Headline | `p[class*="b3be7b7c"]` | Second `<p>` inside `PROFILE_TEXT_LINK` |
| Connected date | `p[class*="_7dc1e841"]` | Text-pattern: `p` whose content starts with `"Connected on"` |

`PROFILE_TEXT_LINK` = `a[href*="linkedin.com/in/"]:not([style])` — distinguishes the text link (name + headline) from the photo thumbnail link, which always carries an inline `style` attribute.

**Parser strategy**
`parseCard` no longer references any class name. Name and headline are extracted positionally from `querySelectorAll('p')` inside the text link. Connected date is found by text prefix, not by class.

**Tests strengthened**
The vacuous `expect(connections.length).toBeGreaterThanOrEqual(0)` assertion was replaced with:
- 6 exact-value assertions on the single-card fixture (name, profileUrl, headline, connectedOn, messageUrl, count)
- 6 invariant assertions on the list fixture (multiple cards found, no null/undefined fields, all `connectedOn` values start with `"Connected on"`, all `profileUrl` values contain `linkedin.com/in/`, first card name matches known value)

Test count: **10 → 17**

---

## Known limitations

| Limitation | Severity | Notes |
|-----------|----------|-------|
| Virtual list — only rendered cards export | Medium | By v1 design; user must scroll before exporting |
| `PROFILE_TEXT_LINK` uses `:not([style])` | Medium | If LinkedIn adds inline style to the text link, name/headline extraction silently breaks |
| No test for cards with missing headline or messageUrl | Low | Empty-field graceful-degradation path is implemented but untested |
| `ts-jest` deprecation warning (`globals` config) | Low | Cosmetic; does not affect correctness |
| ~~Selectors not validated against live LinkedIn~~ | ~~High~~ | **Validated 2026-03-22 — 10 connections exported correctly** |

---

## Next recommended steps

- `npm run build` → reload extension in Chrome → test auto-scroll on live connections page
- Confirm scroll triggers LinkedIn's lazy renderer (900ms wait may need tuning)
- Identify LinkedIn's end-of-list DOM element and update `SELECTORS.END_OF_LIST`
- Test with a large list (100+ connections) to validate stop condition and timing

---

## ~~Next required manual validation step~~ (completed 2026-03-22)

1. `npm run build`
2. Load `dist/` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked)
3. Sign in to LinkedIn
4. Navigate to `https://www.linkedin.com/mynetwork/invite-connect/connections/`
5. Scroll the page to render connections
6. Click the extension popup → **Export Connections**
7. Open the downloaded `linkedin-connections.csv` and verify:
   - Row count matches visible connections
   - Name, headline, profileUrl, connectedOn, messageUrl all populated
   - No `null`/`undefined` literals
   - No broken CSV quoting
8. If 0 results: open DevTools console and run `document.querySelectorAll('[data-testid="lazy-column"] [data-display-contents="true"] > [componentkey]').length` to confirm the card selector still matches live DOM

See `TESTING.md` → Layer 2 for the full checklist.
