# Project goal
Build a Manifest V3 Chrome extension in TypeScript that lets a logged-in user manually export visible connection cards from a LinkedIn connections page into a local CSV file.

# v1 scope
- Popup with Export button
- Content script reads visible DOM only
- No backend
- No auto-navigation
- No background harvesting
- CSV download only

# architecture
- src/content for DOM reading
- src/domain for models and normalization
- src/export for CSV creation/download
- src/background only for orchestration if needed
- strict schema versioning

# done criteria
- npm run lint passes
- npm run typecheck passes
- npm test passes
- npm run build passes
- extension loads unpacked in Chrome
- on a fixture page, export produces expected CSV rows