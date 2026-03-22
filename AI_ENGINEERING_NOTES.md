# AI Engineering Notes

This file documents the first-pass build of the LinkedIn Connections Exporter extension using Claude Code. It records what the model got right, where it drifted or hallucinated, what fixture gaps caused problems, and what changes fixed behavior. Intended as a living reference for future iterations and for anyone evaluating AI-assisted extension development.

---

## Human–AI collaboration map

This section tracks which parts of the project required human input, which were fully AI-generated, and how the boundary between them might evolve. The goal is to make the collaboration visible so it can be reasoned about and gradually improved.

### What the human supplied

**The HTML fixtures.**
Both fixture files — `tests/fixtures/connection-card-basic.html` and `tests/fixtures/connections-list-basic.html` — were provided directly by the human. The human navigated to their own LinkedIn connections page, captured the live DOM output, sanitised it, and placed the files in the repository.

This was the single most critical human contribution to the project. Without real fixture HTML, the AI had no ground truth for:
- which DOM elements actually exist on the page
- what the class names, attributes, and nesting structure look like
- what field values are realistic (name, headline, date format)

The AI could not have produced these fixtures itself. LinkedIn is a closed, login-gated platform. The AI has no browser, no LinkedIn account, and no way to observe the live DOM. It can reason about what LinkedIn's markup *might* look like based on training data, but that knowledge is stale and partial. The fixtures are the bridge between AI reasoning and live reality.

**The live validation run.**
The human also performed the only live test of the extension — loading it unpacked in Chrome, navigating to their real connections page, and clicking Export. This produced the first real signal: 10 connections downloaded correctly, and the "Receiving end does not exist" error was discovered and reported. The AI cannot perform browser-based testing and depends entirely on the human for this feedback loop.

**Scope and constraints.**
The CLAUDE.md and REVIEW.md files that defined the v1 scope, architecture constraints, and done criteria were human-authored. The AI built within those boundaries but did not set them.

### What the AI supplied

- All TypeScript source code (`src/`)
- All test logic (`tests/`)
- Build configuration, manifest, popup HTML
- Selector strategy and parser design (informed by the human-provided fixtures)
- Documentation: TESTING.md, STATUS.md, AI_ENGINEERING_NOTES.md, LINKEDIN_EXPORT_HOWTO.md
- CI workflow, hook scripts
- Identification of the double-registration problem and the idempotency fix

### Where the boundary is fragile today

| Dependency | Why it requires the human today | Risk if not maintained |
|-----------|--------------------------------|----------------------|
| Fixtures | LinkedIn DOM is login-gated and changes without notice | Selectors break silently; tests stay green against stale HTML |
| Live validation | No automated browser test against real LinkedIn | Regressions only discovered by manual use |
| Fixture updates | When LinkedIn ships a new frontend, someone must re-capture the DOM | AI cannot self-update fixtures; tests diverge from reality |

### How this boundary could evolve

**Near term — human-assisted fixture refresh.**
When LinkedIn updates its DOM and exports break, the workflow is: human captures a new page snippet → saves to `tests/fixtures/` → AI updates selectors and tests. This is already the intended maintenance path; it just needs to be practiced.

**Medium term — semi-automated fixture capture.**
A browser automation script (Playwright, Puppeteer) run by a logged-in human could capture a fresh fixture on demand and write it to `tests/fixtures/connections-list-basic.html`. The human still needs to trigger it and be logged in, but the DOM capture and file write are automated. The AI could author this script.

**Longer term — snapshot-diff alerting.**
A scheduled run of the capture script could diff the new fixture against the committed one and open a GitHub issue if the structure has changed. The human is notified rather than having to discover it through a broken export. The AI could author both the script and the issue template.

**What cannot be automated away.**
LinkedIn authentication will always require a human. Any fixture-capture pipeline depends on a logged-in session. This is a hard dependency that cannot be engineered around without storing credentials — which is outside the v1 scope and a deliberate security boundary.

---

## What Claude got right immediately

**Selector isolation.**
The very first design placed all LinkedIn-specific DOM selectors in a single file (`src/content/selectors.ts`). No class strings leaked into the parser or any other module. This is the highest-fragility part of the codebase, and isolating it requires deliberate architectural intent — the model did it without prompting.

**CSV formula-injection safety.**
The `escapeCell` function in `src/export/csv.ts` correctly identifies the five dangerous prefix characters (`=`, `+`, `-`, `@`, tab/CR) and prepends a tab to neutralize them before quoting. This is a non-obvious requirement that many implementations miss. It was included in the first draft.

**RFC 4180 quoting.**
CRLF line endings, double-quote escaping (`""` inside quoted fields), and conditional quoting (only when needed) were all correct on the first attempt. The test suite confirmed this.

**MV3 manifest structure.**
`manifest_version: 3`, `service_worker`-free background (no background script at all for v1), minimal permissions (`activeTab`, `scripting`), and tightly scoped `host_permissions` were all correct without iteration.

**Graceful degradation.**
The parser returns an empty string (not `null` or `undefined`) for every missing field, and skips cards where the name cannot be found. No `null` literals appear in CSV output.

---

## Where Claude hallucinated or overfit

**The single-card fixture test was vacuous.**
The test for `connection-card-basic.html` asserted `connections.length >= 0` — always true. The reason: the single-card fixture has no `[data-testid="lazy-column"]` wrapper, so the card selector matches nothing, and the test passes vacuously. Claude wrote a comment acknowledging this but still accepted the tautological assertion. This is a test that gives false confidence.

*Fix needed:* The single-card fixture test should either (a) wrap the fixture HTML in the expected list structure before parsing, or (b) use a separate `parseCard` export that accepts a single card element directly.

**`tsconfig.json` `types` array was incomplete.**
The initial `tsconfig.json` only listed `"chrome"` in the `types` field. This caused jest globals (`test`, `expect`, `describe`) to be invisible to `tsc`. The model required one correction cycle to add `"jest"` and `"node"`. This is a recurring pattern: Chrome extension TypeScript configs and Jest TypeScript configs have conflicting type requirements that are easy to misconfigure.

**`TextEncoder` polyfill was not anticipated.**
jest-jsdom does not expose `TextEncoder`/`TextDecoder` from Node's `util` by default. The model had to add a `tests/setup.ts` polyfill after the first test run failed. This is a known jest-jsdom friction point but was not pre-empted.

**No `npm run check` script in first draft.**
The REVIEW.md instructions said "run lint, typecheck, test, and build" but the first `package.json` had no combined `check` script. The model wrote them as four separate scripts. A composite `check` script was only added when the user explicitly asked for enforced gates.

---

## Fixture gaps that caused failures

**The connections-list-basic.html file was at the project root, not in `tests/fixtures/`.**
The fixture was delivered at `D:/AI/linkedin_connections/connections-list-basic.html` but the parser test expected it at `tests/fixtures/connections-list-basic.html`. A `cp` command was required. The model handled this correctly once the discrepancy was noticed, but it could have been caught earlier by checking the fixture directory before writing tests.

**The single-card fixture lacks the list wrapper.**
`tests/fixtures/connection-card-basic.html` is a bare card element — no `<section>`, no `[data-testid="lazy-column"]`, no `[data-display-contents]` wrapper. The CARD selector requires all three ancestors. As a result, `parseConnections` returns 0 results on the single-card fixture, making the existing test nearly useless for catching regressions in single-card parsing.

*What a better fixture would look like:*
```html
<section>
  <div data-testid="lazy-column">
    <div data-display-contents="true">
      <!-- card HTML here -->
    </div>
  </div>
</section>
```

---

## Prompt and file-rule changes that improved behavior

**Providing the full selector ancestry in the prompt.**
The initial prompt described the card selector as `div[componentkey]`. After the agent read the actual fixture, it inferred the full three-level path `[data-testid="lazy-column"] [data-display-contents="true"] > [componentkey]`. Explicitly stating the full selector ancestry in the task prompt would have saved one inference cycle.

**Specifying "empty string, not null" for missing fields.**
This was stated explicitly in the task description: "Handle missing fields gracefully (return empty string, not null/undefined)". Without this constraint, the model would likely have returned `null` from the parser and written `"null"` into CSV cells.

**Telling the model to use `data-testid` and `componentkey` over class names where available.**
The model weighted `data-testid` as "more stable than obfuscated classes" when this was explicitly called out. Without the guidance, it might have relied entirely on class selectors.

---

## What required human intervention

1. **Requesting the reviewer subagent file.** The REVIEW.md instructed Claude to "review your own changes using the extension-reviewer subagent," but no subagent definition file existed. The model completed the build but did not self-review because there was nothing to invoke. The reviewer agent was only created when the user explicitly asked for it.

2. **Requesting enforced CI gates.** The model wrote `npm run lint`, `npm run typecheck`, etc., but did not create a CI workflow, pre-commit hook, or combined `check` script until asked. These are mechanical enforcement mechanisms, not code correctness issues — the model treated them as optional scaffolding.

3. **Requesting this engineering log.** The model produced working code, passing tests, and TESTING.md, but did not record its own decision trail. A request to document "what Claude got right, where it hallucinated, what fixtures caused failures" was needed to produce this file.

---

## Risks and ongoing concerns

| Concern | Severity | Owner |
|---------|----------|-------|
| Obfuscated class selectors will break on LinkedIn deploy | High | Update `selectors.ts` after each breakage |
| Single-card fixture test is vacuous | Medium | Refactor to wrap card in list structure |
| No selector change detection (no automated alert when selectors stop working) | Medium | Consider a canary test that runs against a locally saved full page snapshot |
| Virtual list — large connection lists require manual scrolling | Low (by design) | Document in TESTING.md, consider future scroll helper |
| `downloadCsv` uses `document.createElement` — untestable without a real DOM | Low | Unit test `buildCsv` only; manual test `downloadCsv` |

---

## Session metadata

- Date: 2026-03-19
- Model: Claude Sonnet 4.6 (claude-sonnet-4-6)
- Tools used: Write, Edit, Read, Bash, Glob, Grep, Agent (general-purpose subagent for full build)
- Automated check results at handoff: lint ✓, typecheck ✓, test ✓ (10/10), build ✓
- Human interventions: 3 (reviewer agent file, CI enforcement, this log)

---

## Update — 2026-03-21: Fixture hardening, selector strategy, parser refactor

### Fixture improvements

The single-card fixture (`tests/fixtures/connection-card-basic.html`) was delivered as a bare `<div componentkey="...">` element at the document root. The card selector requires three ancestor levels — `[data-testid="lazy-column"]`, `[data-display-contents="true"]`, and then the card itself as a direct child. Without the wrapper, `querySelectorAll(SELECTORS.CARD)` returned nothing on the single-card fixture, and the existing test passed only because it asserted `length >= 0`.

Fix: the fixture was wrapped in the correct ancestry:
```html
<section>
  <div data-testid="lazy-column">
    <div data-display-contents="true">
      <div componentkey="auto-component-..."> ... </div>
    </div>
  </div>
</section>
```

The rule going forward: every fixture must match the structural contract the selectors expect, not just contain the raw card HTML. `connections-list-basic.html` is the source of truth for the list structure; `connection-card-basic.html` must mirror that ancestry to be useful.

### Selector strategy: obfuscated class names removed

The first-pass `selectors.ts` contained three selectors that depended on LinkedIn's obfuscated build-time class names:
- `p[class*="b21f8722"]` for name
- `p[class*="b3be7b7c"]` for headline
- `p[class*="_7dc1e841"]` for connected date

These are high-fragility: LinkedIn can rotate them with any frontend deploy. All three were deleted.

Replaced with:

**`PROFILE_TEXT_LINK`**: `a[href*="linkedin.com/in/"]:not([style])`
The card contains two profile links with identical `href` values — one wraps the photo thumbnail (and carries `style="height:7.2rem;width:7.2rem"`), the other wraps the name and headline text (no inline style). The `:not([style])` distinction is semi-stable: it depends on LinkedIn continuing to apply the inline dimension style only to the photo link. This is structural, not class-based, and tied to how the thumbnail is sized rather than to an obfuscated identifier.

**Connected date by text prefix**
CSS has no `:contains` selector. Rather than fall back to a class name, the parser now walks all `<p>` elements in the card and finds the one whose trimmed text content starts with `"Connected on"`. LinkedIn's user-facing label text is far more stable than a build-time class name — changing it would be a UX-visible regression on their side.

No obfuscated class names remain anywhere in `src/`.

### Parser strategy changes

`parseCard` was simplified to three extraction patterns:

1. **Name + headline** — `querySelectorAll('p')` on the text profile link. The first `<p>` is always the name; the second is always the headline. This relies on document order within the anchor element, which is a layout guarantee rather than a class-based one.

2. **Profile URL** — `card.querySelector(SELECTORS.PROFILE_LINK).href`. Both profile links share the same href; the first match is correct.

3. **Connected date** — text-prefix search over all `<p>` elements in the card. Returns empty string if not found.

The parser now has zero references to class names. Selector changes are confined entirely to `selectors.ts`.

### Removal of vacuous tests

The original single-card test suite contained one test:
```typescript
expect(connections.length).toBeGreaterThanOrEqual(0);
```
This is always true regardless of parser behaviour and provides no regression protection. It was replaced with six tests that assert exact known values from the fixture:
- `connections.length === 1`
- `name === 'Siba Prasad'`
- `profileUrl` matches `/linkedin\.com\/in\/sibaps\//`
- `headline` matches `/Talent Acquisition Lead/`
- `connectedOn === 'Connected on March 19, 2026'`
- `messageUrl` matches `/\/messaging\/compose\//`

The list fixture tests were also strengthened from `toBeTruthy()` / `toMatch` on the first card only to invariant assertions across every parsed card (no null fields anywhere, all `connectedOn` values start with `"Connected on"`, all profile URLs contain `linkedin.com/in/`).

### Test count: 10 → 17

| Suite | Before | After |
|-------|--------|-------|
| `csv.test.ts` | 5 | 5 (unchanged) |
| `parser.test.ts` | 5 | 12 |
| **Total** | **10** | **17** |

All 17 pass. `npm run check` (lint + typecheck + test + build) is green.

### Remaining risks before live LinkedIn validation

| Risk | Notes |
|------|-------|
| `:not([style])` selector | If LinkedIn ever adds a style attribute to the text profile link (e.g. for layout reasons), name and headline extraction silently returns empty strings. The card would be dropped (`name` is the null-guard). Mitigation: monitor for 0-result exports after LinkedIn deploys. |
| Positional `p` extraction | Name is `ps[0]`, headline is `ps[1]`. If LinkedIn inserts an additional `<p>` before the name inside the text link (e.g. a badge or notification), the extraction would shift. Mitigation: the exact-value test on the single-card fixture would catch this on the next fixture update. |
| `data-display-contents` wrapper | The card selector requires `[data-display-contents="true"]` as an intermediate ancestor. This attribute is used by LinkedIn for CSS `display: contents` layout. It is structural/functional rather than a class name, making it more stable, but it is not a public contract. |
| No live DOM validation yet | All passing tests are against saved fixtures. The selectors have not been confirmed to work against the current production LinkedIn DOM. **Live validation is the next required step.** |

---

## Update — 2026-03-22: Robust injection, live validation result, design retrospective

### What happened in live testing

The extension was loaded unpacked and tested against a real LinkedIn connections page. First attempt produced the error:

```
Error: Could not establish connection. Receiving end does not exist.
```

Refreshing the connections page and clicking Export again produced a successful download of 10 connections. The extension was functionally correct — the problem was purely an injection timing issue, not a logic or selector defect.

### Why the original declarative-only design failed in practice

The original design registered the content script exclusively through the `content_scripts` entry in `manifest.json`. This is the "declarative" injection model: Chrome reads the manifest at extension load time and injects the script automatically into any matching tab that **navigates** after that point.

The failure mode: if the user has the connections page open in a tab before they load (or reload) the extension, Chrome never injects the content script into that tab. The tab was already past the navigation event. When the popup fires `chrome.tabs.sendMessage`, there is no listener on the other end — hence "Receiving end does not exist."

A second, related failure mode: the original manifest pattern was `connections/*`, which requires a trailing slash followed by any path. The URL `https://…/connections` (no trailing slash) does not match. LinkedIn sometimes serves the page at the slash-less URL.

Both failures are **silent** — the extension loads without error, the popup opens, and the failure only appears when the user clicks Export.

### Why we designed it the declarative way first

Declarative injection (`content_scripts` in the manifest) is the canonical, textbook approach for Chrome extensions. It is how every tutorial and the official Chrome documentation introduces content scripts. It is also conceptually clean: the manifest declares intent, Chrome handles execution. There is no code in the popup that needs to know anything about injection.

The problem is that the textbook approach implicitly assumes a clean workflow: install extension → navigate to page → use it. It does not account for the more realistic workflow of a developer or power user who already has the target page open, or who reloads the extension mid-session. The declarative model is correct in theory but brittle in any workflow where the extension lifecycle and the page lifecycle are not perfectly sequenced.

### Why the programmatic approach is more robust

The updated design adds a single `chrome.scripting.executeScript` call in the popup handler, immediately before sending the message:

```typescript
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['content.js'],
});
const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXPORT' });
```

This has three properties the declarative-only design lacks:

**1. Self-healing injection.** If the content script was never injected (page was open before extension loaded), the popup injects it on demand. If it was already injected, the `window.__liExporterLoaded` guard prevents a second listener from being registered. Either way the message send that follows is guaranteed to find a listener.

**2. URL-pattern independence.** Programmatic injection uses the `activeTab` permission, not a URL pattern match. It works on any tab the user is actively on, including URL variants LinkedIn might use.

**3. Explicit sequencing.** `executeScript` is `async`/`await` — the popup awaits injection completion before sending the message. The ordering constraint (script must be running before message arrives) is encoded in the code, not in a verbal instruction to the user.

The tradeoff is a small amount of coupling: the popup now knows it is responsible for injection, rather than delegating that entirely to the manifest. This is acceptable because the popup is the only entry point for the user action anyway.

### The double-registration problem and its solution

Naively calling `executeScript` on a tab that already has the content script running would call `chrome.runtime.onMessage.addListener` a second time. Both listeners would receive the next message and both would call `sendResponse` — the second call throws "The message channel closed before a response was received."

The fix is a module-level flag on the page's `window` object:

```typescript
if (!window.__liExporterLoaded) {
  window.__liExporterLoaded = true;
  chrome.runtime.onMessage.addListener(...);
}
```

This is idempotent: however many times the script is injected, the listener is registered exactly once. The flag persists for the lifetime of the page, not the lifetime of the script execution.

---

## Abstracted engineering design principles

These are patterns that emerged from building this small extension and are broadly applicable.

### 1. Design for realistic workflows, not ideal ones

The declarative injection model works in the idealized sequence: fresh browser, load extension, navigate, use. Real users don't follow idealized sequences. They have six tabs open, reload the extension mid-session, and navigate back to pages they left open.

Before finalising any design that depends on sequencing between two independent lifecycles (here: extension load vs. page navigation), ask: what happens if the user is already on this page? What happens if they reload the extension? If the answer is "it silently breaks," the design is fragile.

### 2. Silent failures are worse than loud ones

Both failure modes here (wrong URL pattern, page pre-dated extension) produced a confusing error message rather than no feedback at all — which is good. But neither failure was catchable from the extension code itself before the user clicked Export. A more defensive design would check at popup-open time whether the content script is reachable (e.g., send a lightweight ping message) and show a warning before the user even clicks the button.

### 3. Coupling can reduce fragility

A common instinct in software design is to decouple components — and the declarative model maximises decoupling between the popup and the injection mechanism. But decoupling has a cost: when something goes wrong at the boundary, neither component knows or can recover. The programmatic injection approach introduces deliberate coupling (popup is responsible for injection), which allows the popup to ensure preconditions are met before proceeding. Sometimes explicit ownership of a dependency is more reliable than delegating it to an implicit mechanism.

### 4. Idempotency as a design constraint

Any operation that might be called multiple times — injection, registration, initialisation — should be designed to be idempotent from the start. The `window.__liExporterLoaded` guard is the simplest possible idempotency mechanism. The cost of adding it is two lines; the cost of not having it is a subtle, hard-to-diagnose double-listener bug. Default to idempotent operations wherever an action might be repeated.

### 5. The gap between "it works on my machine in the right order" and "it works reliably"

This extension worked correctly when the user followed the exact steps in the manual: build → load → navigate → export. The failure only appeared when the page was already open — a one-step deviation from the documented workflow. This gap between "works in documented order" and "works reliably in realistic use" is a common source of production bugs. Any time a design requires the user to follow a specific sequence of steps to avoid an error, treat that as a code smell and consider whether the sequence can be enforced in code instead.
