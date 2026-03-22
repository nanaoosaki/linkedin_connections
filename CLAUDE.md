# Project goal
Build a Manifest V3 Chrome extension in TypeScript that lets a logged-in user export all their LinkedIn connections into a local CSV file with one click.

# Current scope (v2 — shipped)
- Popup with Export button and live progress indicator
- "Load more" button clicked automatically in a loop to load all connections
- Content script collects cards on every cycle (handles LinkedIn's virtual list)
- Deduplication by profileUrl across all cycles
- No backend, no stored credentials, no auto-navigation to other pages
- CSV download only with formula-injection safety

# Architecture
- src/content/selectors.ts — ALL LinkedIn DOM strings in one place (zero obfuscated class names)
- src/content/parser.ts    — extracts Connection fields from a card element
- src/content/scroll.ts    — scrollAndCollect(): injectable-dep loop, fully unit-tested
- src/content/index.ts     — Chrome message listener, wires real deps into scroll loop
- src/domain/connection.ts — Connection interface (single schema)
- src/export/csv.ts        — RFC 4180 CSV builder, formula-injection safe
- src/popup/index.ts       — popup UI, polls progress, triggers export
- src/background/          — not used in v2; orchestration handled in content script

# Key LinkedIn facts (discovered through live testing)
- Connections page URL: https://www.linkedin.com/mynetwork/invite-connect/connections/
- List container: [data-testid="lazy-column"]
- Cards: [data-testid="lazy-column"] [data-display-contents="true"] > [componentkey]
- Page scroll container: <main id="workspace"> (NOT document.scrollingElement)
- Loading mechanism: "Load more" BUTTON (not infinite scroll) — found by text content
- Virtual list: cards are removed from DOM as they scroll out of view — must collect per cycle
- Load more button: <button> with text "Load more", no data-testid/id/aria-label

# Done criteria
- npm run lint passes
- npm run typecheck passes
- npm test passes (27 tests across 3 suites)
- npm run build passes
- extension loads unpacked in Chrome
- one-click export collects all connections via Load More loop
- progress count visible during export run
- CSV contains correct fields for all connections

# Selector stability policy
All LinkedIn DOM selectors live in src/content/selectors.ts only.
Prefer in this order: data-testid > structural attributes > href patterns > text content > class names.
Obfuscated class names (e.g. b21f8722) are BANNED from selectors.ts.
