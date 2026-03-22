Build this Chrome extension completely according to the repository instructions in CLAUDE.md and REVIEW.md.

Your task is to:
1. design and implement the extension
2. add tests
3. run lint, typecheck, tests, and build until all pass
4. review your own changes using the extension-reviewer subagent
5. fix all blocking review findings
6. leave behind a clear TESTING.md with exact manual test steps for Chrome unpacked install

Constraints:
- obey v1 scope only
- do not add backend sync
- keep LinkedIn-specific DOM selectors isolated
- add fixture-based parser tests
- ensure CSV escaping and formula-injection safety
- do not stop after scaffolding; stop only when the project builds and the test steps are documented

Deliverables:
- working code
- passing automated checks
- testing instructions
- summary of remaining limitations and risks