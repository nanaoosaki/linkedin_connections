# Extension Review Instructions

Use the `.claude/agents/extension-reviewer.md` subagent to review changes before shipping.

## Your task when reviewing

1. Run `npm run check` — all four gates must pass before review begins
2. Review code against the checklist in `.claude/agents/extension-reviewer.md`
3. Fix all blocking findings
4. Update `STATUS.md` and `AI_ENGINEERING_NOTES.md` with findings
5. Confirm `TESTING.md` Layer 2 manual steps are still accurate

## Constraints
- No backend sync, no stored credentials
- All LinkedIn DOM strings must stay in `src/content/selectors.ts`
- No obfuscated class names in selectors
- CSV must be formula-injection safe
- Scroll/load loop must use injectable deps (keep unit-testable)
- Do not stop until `npm run check` passes and manual test steps are documented

## Key things to verify after any selector or scroll change

Run this in DevTools console on the live connections page to confirm selectors still match:

```javascript
// Card selector health check
document.querySelectorAll('[data-testid="lazy-column"] [data-display-contents="true"] > [componentkey]').length
// Expected: > 0

// Load More button health check
[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Load more')
// Expected: HTMLButtonElement (not undefined)

// Scroll container health check
document.getElementById('workspace')
// Expected: HTMLElement
```

## Deliverables
- Working code with passing automated checks
- Updated TESTING.md manual steps
- Updated STATUS.md
- Entry in AI_ENGINEERING_NOTES.md covering what changed and why
- Summary of remaining limitations and risks
