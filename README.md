# LinkedIn Connections Exporter

A Manifest V3 Chrome extension that exports all your LinkedIn connections to a CSV file in one click.

---

## What it does

- Navigates to your LinkedIn connections page and clicks **Load more** repeatedly until all connections are loaded
- Collects name, profile URL, headline, connected date, and message URL for every connection
- Downloads a clean `linkedin-connections.csv` to your machine — no data leaves your browser
- Shows a live progress bar while loading (`X / total` when LinkedIn's count is available)

Tested with 535 connections in ~30 seconds on a fast connection. Timing scales with your internet speed — each "Load more" click fires a network request to LinkedIn's servers, so slower connections will take proportionally longer. The adaptive wait means the extension never idles longer than necessary: it moves to the next page as soon as new cards appear in the DOM rather than waiting a fixed delay.

---

## CSV output

```
name,profileUrl,headline,connectedOn,messageUrl
Jane Smith,https://www.linkedin.com/in/janesmith/,"Product Manager at Acme",Connected on March 1 2025,https://www.linkedin.com/messaging/compose/?profileUrn=...
```

Fields: `name`, `profileUrl`, `headline`, `connectedOn`, `messageUrl`

---

## Install

There are two ways to install — from the pre-built release (no Node.js required) or from source (for developers who want to inspect or modify the code).

---

### Option A — Pre-built release (recommended for most users)

1. Go to the [Releases page](https://github.com/nanaoosaki/linkedin_connections/releases)
2. Download `linkedin-connections-exporter.zip` from the latest release
3. Unzip it — you'll get a folder containing `manifest.json`, `content.js`, `popup.js`, `popup.html`, and the icon files
4. Open `chrome://extensions` in Chrome
5. Enable **Developer mode** (top-right toggle)
6. Click **Load unpacked** and select the unzipped folder
7. Pin the extension icon from the puzzle-piece menu

> **Want to verify what you're installing?** The zip is built directly from the source in this repo using `npm run pack`. You can audit every line of `src/` before building it yourself (see Option B).

---

### Option B — Build from source

**Prerequisites:** Node.js 18+, Chrome

```bash
git clone https://github.com/nanaoosaki/linkedin_connections.git
cd linkedin_connections
npm install
npm run build        # produces dist/ — the extension folder
```

To also produce the installable zip:

```bash
npm run pack         # runs build, then zips dist/ → linkedin-connections-exporter.zip
```

Then load `dist/` as an unpacked extension (same steps 4–7 above).

> After any rebuild, go to `chrome://extensions` and click the refresh icon on the extension card.

---

### Using the extension

1. Go to `https://www.linkedin.com/mynetwork/invite-connect/connections/`
2. Click the extension icon in the toolbar
3. Click **Export Connections**
4. The progress bar shows `X / total` connections loaded — `linkedin-connections.csv` downloads automatically when complete

---

## Permissions

| Permission | Why |
|-----------|-----|
| `activeTab` | Read the connections page DOM |
| `scripting` | Inject the content script into the active tab |

No network requests are made. No data is sent anywhere. The CSV is written directly to your Downloads folder.

---

## Architecture

```
src/
  domain/connection.ts      — Connection interface (single schema)
  content/
    selectors.ts            — All LinkedIn DOM selectors in one place
    parser.ts               — Extracts connection fields from card elements
    scroll.ts               — Load More loop with adaptive wait + deduplication
    index.ts                — Content script entry point; handles EXPORT/PROGRESS messages
  export/
    csv.ts                  — RFC 4180 CSV builder with formula-injection safety
  popup/
    index.ts                — Popup UI; injects content script, polls progress
popup.html                  — Popup markup
manifest.json               — MV3 manifest
```

**Key design decisions:**

- **Load More button, not scroll** — LinkedIn's connections page loads cards via a "Load more" button. Programmatic scrolling has no effect. The button is located by its text content (`"Load more"`) since it has no stable `id`, `data-testid`, or `aria-label`.
- **Collect while scrolling** — LinkedIn uses a virtual list that removes old cards from the DOM as new ones are added. Cards are collected and deduplicated on every cycle (keyed by `profileUrl`) rather than parsed once at the end.
- **Adaptive wait** — Instead of a fixed delay after each click, the loop polls `getRenderedCardCount()` every 150ms and proceeds as soon as new DOM cards appear (2000ms ceiling). Random jitter (100–300ms) is added to avoid a mechanically regular click pattern.
- **Dependency injection** — All side effects in `scroll.ts` are injected via `ScrollDeps` and timing constants via `ScrollConfig`, making the core loop fully unit-testable without a browser.
- **Zero obfuscated class names** — All selectors are anchored to `data-testid`, structural attributes, or text patterns. `selectors.ts` is the single source of truth with stability annotations.

---

## Development

```bash
npm run check      # lint + typecheck + test + build (run this before committing)
npm run build      # build only
npm test           # jest (28 tests across 3 suites)
```

### Test layout

| Suite | Tests | What it covers |
|-------|-------|----------------|
| `tests/parser.test.ts` | 12 | Field extraction from real LinkedIn HTML fixtures |
| `tests/scroll.test.ts` | 11 | Load More loop: dedup, stable-cycle stop, virtual list, ProgressInfo |
| `tests/csv.test.ts` | 5 | RFC 4180 quoting, formula-injection safety |

Fixtures in `tests/fixtures/` are real LinkedIn HTML captured from the live page and sanitised.

---

## Troubleshooting

**"Exported 0 connections"** — LinkedIn may have updated its DOM. Run this in DevTools Console on the connections page:

```js
document.querySelectorAll('[data-testid="lazy-column"] [data-display-contents="true"] > [componentkey]').length
```

If it returns `0`, the card selector needs updating. Open `src/content/selectors.ts`, inspect the live DOM, update `CARD`, rebuild, and reload.

**Progress bar stays indeterminate (no `X / 535`)** — The `CONNECTIONS_TOTAL` selector hasn't matched your page's total-count element. Export still works; you just won't see the determinate bar or time estimate. To fix it, find the element on your page:

```js
Array.from(document.querySelectorAll('*')).filter(el =>
  el.children.length === 0 &&
  el.textContent?.match(/^\s*\d{3,}[\s\S]{0,20}connection/i)
).forEach(el => console.log(el.tagName, el.className, '|', el.textContent.trim()));
```

Open an issue with the output and I'll update the selector.

**"Could not establish connection"** — Make sure you're on `https://www.linkedin.com/mynetwork/invite-connect/connections/`. Reload the page and try again.

**Extension still behaves the old way after rebuild** — Go to `chrome://extensions` and click the refresh icon on the extension card.

---

## Known limitations

- LinkedIn DOM selectors may break when LinkedIn deploys updates — particularly obfuscated class names (none are used here, but structural attributes can also change)
- The `CONNECTIONS_TOTAL` selector for the determinate progress bar needs live validation per LinkedIn account/locale
- Chrome Web Store submission pending — can be loaded unpacked in the meantime (see Install above)

---

## Human–AI collaboration

This project was built entirely through conversation between a human and Claude Code (claude-sonnet-4-6). The full engineering log is in [`AI_ENGINEERING_NOTES.md`](./AI_ENGINEERING_NOTES.md). The collaboration map below summarises who did what and why that division exists.

### What the human supplied

**HTML fixtures** — the single most critical contribution. Both `tests/fixtures/connection-card-basic.html` and `tests/fixtures/connections-list-basic.html` were captured directly from the live LinkedIn page by the human. LinkedIn is login-gated; the AI has no browser, no account, and no way to observe the actual DOM. The fixtures are the only ground truth the AI could test against.

**Live validation** — every real-world test run was performed by the human: loading the unpacked extension in Chrome, clicking Export, and reporting what happened. This is the feedback loop that discovered all the non-obvious bugs:
- The "Receiving end does not exist" error (content script not injected into pre-existing tabs)
- The 20 found / 10 downloaded discrepancy (virtual list recycling)
- The fact that scrolling does nothing — LinkedIn uses a Load More button, not infinite scroll

**The Load More button fixture** — after the scroll approach failed, the human captured the button's `outerHTML` directly from DevTools, which confirmed the button text is `"Load more"` and has no stable `data-testid` or `aria-label` to target.

**Scope and constraints** — `CLAUDE.md` and `REVIEW.md`, which defined the architecture boundaries and done criteria, were human-authored.

### What the AI supplied

All TypeScript source code, tests, build config, CI workflow, and documentation. Key design contributions:
- Isolating all LinkedIn DOM selectors in a single annotated file (`selectors.ts`) on the first draft
- Replacing obfuscated class selectors with structural and text-pattern alternatives that survive LinkedIn deploys
- The `Map<string, Connection>` deduplication pattern that handles virtual list recycling
- The elapsed-counter polling pattern for the adaptive wait (makes tests deterministic without fake timers)
- RFC 4180 CSV with formula-injection safety

### Where the boundary matters

The hardest constraint: **LinkedIn authentication always requires a human.** Any fixture-capture pipeline depends on a logged-in session. This is a permanent dependency that cannot be engineered around. The practical implication: when LinkedIn updates its DOM and exports break, the fix cycle is always — human captures new DOM snippet → AI updates selectors and tests.

### What this shows about AI-assisted development

The AI was capable of producing a correct, well-tested, production-quality Chrome extension from a spec. It did not require step-by-step instruction for implementation details. But it had a fundamental blind spot: it could not observe the system it was building for. Every real bug was discovered in the gap between the AI's model of LinkedIn's DOM and the actual DOM — and every fix required a human to close that gap with a real observation.

The pattern likely generalises: AI coding assistants are highly effective for closed systems (languages, frameworks, APIs with stable specs) and require ongoing human input for open systems (live websites, external APIs, real hardware) where the ground truth can only be observed, not derived.

See [`AI_ENGINEERING_NOTES.md`](./AI_ENGINEERING_NOTES.md) for the full record: what the model got right immediately, where it hallucinated or overfit, every live-validation discovery, and the reasoning behind each architectural decision.

---

## License

MIT
