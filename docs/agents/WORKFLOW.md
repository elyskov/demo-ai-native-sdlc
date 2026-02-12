# Workflow (NPD)

Applies when planning work, creating branches, writing commits, and opening PRs.

## Issue model

- Issues may have sub-issues.
- Treat the top-level issue as the delivery umbrella; sub-issues can be used for decomposing work.

## Milestones & releases

- **Top-level issues must be assigned to a milestone.**
- Each milestone corresponds **1:1 with a release**.
- Releases must be annotated (include release notes/description describing what changed).

## Branching model

- `main` is long-lived.
- Use short-lived feature branches named:
  - `feat/<issue-id>-short-name`

Examples:
- `feat/42-migration_to_agents_md`

## Change flow

1) Identify the issue (and any sub-issues).
2) Create a feature branch from `main`.
3) Implement changes.
4) Open a PR targeting `main`.
5) Merge via **squash merge**.
6) Close the issue.

## Commit and PR expectations

- Prefer incremental, easy-to-review commits.
- Use clear, imperative commit messages (for example `docs: add agents governance`).
- PRs should be linked to the corresponding GitHub issue and include a closing keyword line in the description (for example `Closes #42`).
- In PRs, document:
  - Scope / non-goals
  - How you tested (unit/integration and/or Postman/Newman when relevant)
  - Any follow-ups
