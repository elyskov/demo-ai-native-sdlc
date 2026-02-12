# Agents Governance (NPD)

This repository uses **Nested Progressive Disclosure (NPD)** governance.

Read order:
1) **This file** (AGENTS.md)
2) The relevant deep-dive in `docs/agents/`
3) The most specific local docs (for example service READMEs)

## Scope

These rules apply to humans and AI agents contributing code, docs, tests, and build assets.

## Precedence (NPD)

When instructions conflict, follow the most specific document for the area you’re changing:

- Service- or folder-local docs (for example `services/*/README.md`, `postman/README.md`, `INSTALL.md`)
- `docs/agents/*.md`
- `AGENTS.md`

If you notice a conflict, call it out in the PR description and follow the most specific rule.

## Global engineering defaults

- Produce runnable, production-ready changes by default (build/run without manual fixes).
- Prefer clean, readable, maintainable solutions; avoid introducing conflicting patterns.
- Add short comments only where they clarify non-obvious decisions.
- If a change materially affects architecture, behavior, or developer workflows, update `README.md` (or the most relevant docs) as part of the change.

## Safety & boundaries

- Never add secrets or tokens to the repo. Use environment variables and documented configuration.
- Keep changes incremental and scoped to the current issue; avoid drive-by refactors.
- Don’t modify historical chat logs under `docs/chats/` unless explicitly requested.

## Deep-dive instructions (open when relevant)

- Architecture: `docs/agents/ARCHITECTURE.md`
- Frontend: `docs/agents/FRONTEND.md`
- Workflow: `docs/agents/WORKFLOW.md`
- Testing: `docs/agents/TESTING.md`
