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

#### `tests/csv.test.ts` (5 tests)
| Test | What it verifies |
|------|-----------------|
| builds CSV with header | Header row is `name,profileUrl,headline,connectedOn,messageUrl` |
| escapes double quotes | `Say "Hello"` → `"Say ""Hello"""` (RFC 4180) |
| formula injection `=` | `=SUM(A1)` → `\t=SUM(A1)` (tab prefix) |
| formula injection `+` | `+malicious` → `\t+malicious` |
| empty array | Only header row, no blank trailing rows |

#### `tests/parser.test.ts` (12 tests)
| Test | Fixture | What it verifies |
|------|---------|-----------------|
| finds exactly one card | connection-card-basic.html | Wrapped fixture matches card selector |
| extracts name | connection-card-basic.html | `"Siba Prasad"` exact match |
| extracts profileUrl | connection-card-basic.html | Contains `linkedin.com/in/sibaps/` |
| extracts headline | connection-card-basic.html | Contains `"Talent Acquisition Lead"` |
| extracts connectedOn | connection-card-basic.html | `"Connected on March 19, 2026"` exact match |
| extracts messageUrl | connection-card-basic.html | Contains `/messaging/compose/` |
| finds multiple cards | connections-list-basic.html | Parser finds > 1 card in real list DOM |
| every card has name | connections-list-basic.html | No empty names across all cards |
| every card has profileUrl | connections-list-basic.html | All URLs contain `linkedin.com/in/` |
| every card has connectedOn | connections-list-basic.html | All dates start with `"Connected on"` |
| no null/undefined fields | connections-list-basic.html | Every field on every card is a string |
| first card name matches fixture | connections-list-basic.html | `"Siba Prasad"` |

#### `tests/scroll.test.ts` (10 tests)
| Test | What it verifies |
|------|-----------------|
| returns pre-click cards when button absent | Initial collect before loop runs |
| stops immediately when button absent | `triggerNextLoad` returns false → loop exits |
| stops after 2 stable cycles | Button present but no new cards → stableChecks stop |
| deduplicates by profileUrl across cycles | Map keyed by profileUrl, duplicates ignored |
| resets stable counter on new cards | Growth resets stableChecks to 0 |
| stops when button disappears mid-run | Button gone partway → clean exit |
| onProgress called with cumulative count | Progress reflects total collected, not window size |
| wait called with 1200ms | Correct wait duration per cycle |
| handles empty page | Returns empty array, no crash |
| simulates virtual list recycling | 20 unique connections collected across 10-card DOM windows |

### Fixtures
| File | Purpose |
|------|---------|
| `tests/fixtures/connection-card-basic.html` | Single card wrapped in lazy-column ancestry — single-card extraction tests |
| `tests/fixtures/connections-list-basic.html` | Real scraped list — primary parser regression fixture |
| `tests/fixtures/connections-load-more-button.html` | Load More button outerHTML — selector reference; confirms button has no stable attributes |

### Adding new fixtures
When LinkedIn changes its DOM structure:
1. Save a snippet of the new card HTML to `tests/fixtures/connection-card-vN.html`
2. Add a `describe` block in `tests/parser.test.ts` loading the new fixture
3. Assert specific field values (`name === 'Expected Name'`), not just `length > 0`
4. Update `src/content/selectors.ts` to match new attributes — never add obfuscated class names

---

## Layer 2 — Manual Chrome unpacked validation

### Every time you rebuild

```
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Click **↺** (refresh) on the **LinkedIn Connections Exporter** card
3. Go to your LinkedIn connections tab and press **Ctrl+R**

> Step 3 is important — the old `content.js` stays in memory until the page reloads.

### First install only
1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked** → select the `dist/` folder

### Full export test on live LinkedIn
1. Sign in to LinkedIn in Chrome
2. Navigate to:
   ```
   https://www.linkedin.com/mynetwork/invite-connect/connections/
   ```
3. Click the extension icon → popup opens
4. Click **Export Connections**
5. The button disables and a progress bar appears
6. Status updates: `Loading connections… 10 found` → `20 found` → ... climbing in batches
7. When complete: `Exported N connection(s).`
8. `linkedin-connections.csv` downloads automatically

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
- [ ] Row count matches your total LinkedIn connections
- [ ] No `null` or `undefined` literals in any cell
- [ ] Name and headline cells with commas are wrapped in double-quotes
- [ ] Profile URLs open correct profiles when pasted in browser
- [ ] `connectedOn` column shows "Connected on [Month Day, Year]"
- [ ] No spreadsheet formula evaluation (cells starting with `=` show a leading tab/space)

### Selector health check (run in DevTools console before reporting a bug)

```javascript
// Are cards found?
document.querySelectorAll('[data-testid="lazy-column"] [data-display-contents="true"] > [componentkey]').length

// Is the Load More button present and findable?
[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Load more')

// Is the scroll container present?
document.getElementById('workspace')
```

All three should return non-null/non-zero values. If any return null or 0, LinkedIn has changed its DOM and the corresponding selector in `src/content/selectors.ts` needs updating.

### Diagnosing "Exported 0 connection(s)."
1. Run the health check above — identify which selector broke
2. Inspect the live DOM and find the new structure
3. Update `src/content/selectors.ts` (never add obfuscated class names)
4. `npm run build` → reload extension → Ctrl+R on connections page → retry

### Diagnosing progress count stuck at 0
The Load More button text changed or is not yet in the DOM.
1. Run: `[...document.querySelectorAll('button')].map(b => b.textContent.trim())`
2. Find the button that loads new connections
3. Update `SELECTORS.LOAD_MORE_BUTTON_TEXT` in `src/content/selectors.ts`

---

## Known limitations

| Limitation | Impact | Notes |
|-----------|--------|-------|
| `LOAD_MORE_BUTTON_TEXT` matched by text | Breaks if LinkedIn renames/translates button | Update `selectors.ts`; no code change needed |
| `PROFILE_TEXT_LINK` uses `:not([style])` | Name/headline silently empty if LinkedIn adds style to text anchor | Monitor for 0-name exports |
| 1200ms wait hardcoded | May be too slow on fast connections, too fast on slow ones | Acceptable for current use |
| Message URL requires LinkedIn login | Dead link when not logged in | Export while logged in |
| Formula-injection prefix is a tab char | Leading space visible in some apps | Expected; protects against injection |
