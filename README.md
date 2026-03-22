# LinkedIn Connections Exporter

A Manifest V3 Chrome extension that exports all your LinkedIn connections to a CSV file in one click.

---

## What it does

- Navigates to your LinkedIn connections page and clicks **Load more** repeatedly until all connections are loaded
- Collects name, profile URL, headline, connected date, and message URL for every connection
- Downloads a clean `linkedin-connections.csv` to your machine — no data leaves your browser
- Shows a live progress bar while loading (`X / total` when LinkedIn's count is available)

Tested with 535 connections (~40 seconds end-to-end).

---

## CSV output

```
name,profileUrl,headline,connectedOn,messageUrl
Jane Smith,https://www.linkedin.com/in/janesmith/,"Product Manager at Acme",Connected on March 1 2025,https://www.linkedin.com/messaging/compose/?profileUrn=...
```

Fields: `name`, `profileUrl`, `headline`, `connectedOn`, `messageUrl`

---

## Install (unpacked — no Web Store required)

**Prerequisites:** Node.js 18+, Chrome

### 1. Build

```bash
git clone https://github.com/nanaoosaki/linkedin_connections.git
cd linkedin_connections
npm install
npm run build
```

This produces a `dist/` folder — that is the extension.

### 2. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `dist/` folder
4. Pin the extension icon from the puzzle-piece menu

### 3. Export

1. Go to `https://www.linkedin.com/mynetwork/invite-connect/connections/`
2. Click the extension icon
3. Click **Export Connections**
4. Wait for the progress bar to complete — `linkedin-connections.csv` downloads automatically

> After rebuilding, go to `chrome://extensions` and click the refresh icon on the extension card.

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
- No Chrome Web Store listing yet — must be loaded unpacked

---

## License

MIT
