## Frontend architecture: avangarde-frontend-architect

This frontend's structure and decisions are tracked by the
`avangarde-frontend-architect` skill, not only by the source code:

- `DESIGN.md` — requirements, navigation, theme, and component decisions.
- `ARCHITECTURE.md` — frontend framework and styling decisions.
- `journeys/` — Gherkin/BDD specs of the actual built user journeys.

Read `DESIGN.md` and `ARCHITECTURE.md` before making frontend changes —
they're the durable record of what was decided and why; don't re-derive a
decision that's already written down there. To keep extending the project
with the same skill (evolve the design, add a phase, audit before a
redesign), reinstall it with `npx skills add <source-repo> --skill
avangarde-frontend-architect` — check `skills-lock.json` or your skills
manifest for `<source-repo>` if it isn't already obvious from how this
skill was installed here.
