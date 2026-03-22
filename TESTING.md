# Testing Guide

This document has two layers:
1. **Automated checks** — fixture-based, run in CI, no browser needed
2. **Manual Chrome validation** — unpacked extension loaded in a real browser

---

## Layer 1 — Automated checks

### Prerequisites
```
npm install
```

### Run all automated checks (must all pass before shipping)
```
npm run lint        # ESLint — zero errors required
npm run typecheck   # tsc --noEmit — zero errors required
npm test            # Jest fixture tests — all green required
npm run build       # esbuild — dist/ produced without error
```

Or run the full gate at once:
```
npm run check       # lint + typecheck + test + build in sequence
```

### What the tests cover

#### `tests/csv.test.ts`
| Test | What it verifies |
|------|-----------------|
| builds CSV with header | Header row is `name,profileUrl,headline,connectedOn,messageUrl` |
| escapes double quotes | `Say "Hello"` → `"Say ""Hello"""` (RFC 4180) |
| formula injection `=` | `=SUM(A1)` → `\t=SUM(A1)` (tab prefix) |
| formula injection `+` | `+malicious` → `\t+malicious` |
| empty array | Only header row, no blank trailing rows |

#### `tests/parser.test.ts`
| Test | Fixture | What it verifies |
|------|---------|-----------------|
| parses at least one connection | connections-list-basic.html | Parser finds cards in the real list DOM |
| first connection has name | connections-list-basic.html | Name is non-empty string |
| first connection has profileUrl | connections-list-basic.html | URL contains `linkedin.com/in/` |
| first connection has connectedOn | connections-list-basic.html | Text matches "Connected on" |
| single card fixture graceful | connection-card-basic.html | No crash on card without lazy-column wrapper |

### Fixtures
| File | Purpose |
|------|---------|
| `tests/fixtures/connection-card-basic.html` | One sanitized card — tests parser resilience without list wrapper |
| `tests/fixtures/connections-list-basic.html` | Real scraped list page — primary parser regression fixture |

### Adding new fixtures
When LinkedIn changes its DOM structure:
1. Save a snippet of the new card HTML to `tests/fixtures/connection-card-vN.html`
2. Add a `describe` block in `tests/parser.test.ts` loading the new fixture
3. Assert specific field values (`name === 'Expected Name'`), not just `length > 0`
4. Update `src/content/selectors.ts` to match the new class names or attributes

---

## Layer 2 — Manual Chrome unpacked validation

### Build
```
npm run build
```
This produces `dist/` containing `manifest.json`, `content.js`, `popup.js`, `popup.html`.

### Load in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked** → select the `dist/` folder
4. Confirm "LinkedIn Connections Exporter" appears with no errors

### Smoke test on a fixture page (no LinkedIn login required)
1. Open `tests/fixtures/connections-list-basic.html` as a local file in Chrome:
   `File > Open File` → select `tests/fixtures/connections-list-basic.html`
2. Note: the content script only runs on `https://www.linkedin.com/*` — it will **not** inject on a local file URL. This step only confirms the extension loads without crashing.

### Full test on live LinkedIn
1. Sign in to LinkedIn in Chrome.
2. Navigate to:
   ```
   https://www.linkedin.com/mynetwork/invite-connect/connections/
   ```
3. **Scroll the page** until the connections you want are visible. LinkedIn renders lazily — only DOM-rendered cards are exported.
4. Click the extension icon → popup opens with "Export Connections" button.
5. Click **Export Connections**.
6. Expected popup response: `Exported N connection(s).`
7. A file `linkedin-connections.csv` downloads automatically.

### Verify the CSV
Open the downloaded file in a text editor or spreadsheet app.

**Expected header (row 1):**
```
name,profileUrl,headline,connectedOn,messageUrl
```

**Example data row:**
```
Siba Prasad,https://www.linkedin.com/in/sibaps/,"Talent Acquisition Lead || VLSI and Embedded || Hardware",Connected on March 19 2026,https://www.linkedin.com/messaging/compose/?profileUrn=...
```

**Checks:**
- [ ] Row count matches visible connections on the page
- [ ] No `null` or `undefined` literals in any cell
- [ ] Name and headline cells with commas are wrapped in double-quotes
- [ ] Profile URLs open correct profiles when pasted in browser
- [ ] `connectedOn` column shows "Connected on [Month Day, Year]"
- [ ] No spreadsheet formula evaluation when opened in Excel/Sheets (cells starting with `=` should show a leading space/tab)

### Diagnosing 0 results
If the popup reports `Exported 0 connection(s)`:
1. Open DevTools (F12) on the connections page → Console tab.
2. Run: `document.querySelectorAll('[data-testid="lazy-column"] [data-display-contents="true"] > [componentkey]').length`
3. If `0`: LinkedIn changed the list structure. Update `SELECTORS.CARD` in `src/content/selectors.ts`.
4. Run: `document.querySelector('p[class*="b21f8722"]')` — if `null`, the name class changed. Update `SELECTORS.NAME`.
5. Rebuild and reload the extension.

---

## Known limitations

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| Virtual list — only rendered cards exported | Incomplete exports | Scroll page fully before exporting |
| Obfuscated class selectors | Breaks on LinkedIn deploys | Re-inspect DOM, update `selectors.ts` |
| No auto-scroll or pagination | Manual effort for large lists | Scroll manually |
| Message URL requires LinkedIn login | Dead link when not logged in | Export while logged in |
| Formula-injection prefix is a tab char | Leading space visible in some apps | Expected behavior; protects against injection |
