Use the HTML files under tests/fixtures as the primary source of truth for parser development.

Your job:
- build a parser that extracts connection cards from these fixtures
- keep selectors isolated in one module
- handle missing or variant fields gracefully
- add unit tests for each fixture
- generate normalized records
- export them to CSV safely
- run tests, typecheck, and build until all pass

Do not depend on live LinkedIn for normal development.
Assume live browser testing happens only after fixture-based tests are green.

Use the HTML fixtures under tests/fixtures as the primary parser inputs.

Assume:
- connection-card-basic.html contains one representative card
- connections-list-basic.html contains multiple repeated card wrappers

Tasks:
- identify the repeated card root
- implement a parser that extracts name, profileUrl, headline/summary text, connectedDate, and available actions if present
- isolate selectors in one module
- handle missing fields gracefully
- add parser tests against both the single-card and list fixtures