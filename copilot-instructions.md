# Copilot Instructions — Project Governance

This document defines how GitHub Copilot (and contributors following Copilot's guidance) must manage and evolve this repository. Treat these rules as the authoritative project governance when generating code, documentation, commits, or tasks for demo-ai-native-sdlc.

1. General Principles
---------------------

- Follow the Minimal Viable Product (MVP) principle: implement only what is required to deliver the stated feature set.
- Generate runnable, production-ready code by default. Output must build and run without requiring manual fixes.
- Prioritize clean, readable, and maintainable architecture and code.
- Include concise explanatory comments where they increase clarity or document non-obvious decisions.
- When major architectural or behavioral changes are introduced, update `README.md` to describe the change and rationale.
- Prefer modern, well-supported technologies and community best practices.
- Respect existing project conventions; avoid introducing conflicting patterns or styles.

2. Architecture Principles
-------------------------

- Stack: Next.js (App Router) for frontend, Nest.js for backend API, Docker for packaging and runtime.
- Frontend responsibilities:
  - Provide UI for creating and editing C4 Deployment Diagrams.
  - Render diagrams using Mermaid.js and support interactive behavior via the Mermaid API.
- Backend responsibilities:
  - Store, validate, and manipulate diagram data.
  - Provide an endpoint to generate CSV exports that strictly follow NetBox-compatible format.
- CSV export rules:
  - Output must be deterministic and documented.
  - Follow NetBox CSV schema precisely for the chosen inventory objects.
- Deployment:
  - Produce a single multi-stage Docker build that supports development and production modes (dev build with tooling, prod build optimized and minimal).

3. Frontend Guidelines
----------------------

- Use Mermaid.js for rendering C4 Deployment Diagrams.
- Prefer the Mermaid API to enable interactive features (context menus, element actions, selection handlers).
- Use semantic HTML structure and accessible ARIA attributes where appropriate.
- Ensure markup passes W3C validation and follows accessibility best practices (WCAG AA where reasonable).
- Use modern CSS (Flexbox, Grid, custom properties) while keeping styles maintainable and responsive.
- Ensure responsive design for common viewport sizes and mobile.

4. Browser Compatibility
------------------------

- Use feature detection (for example, `if ('fetch' in window)`) rather than user-agent sniffing.
- Target support for the latest two stable releases of Chrome, Firefox, Edge, and Safari (macOS and iOS).

5. Development Workflow Rules
-----------------------------

- Prefer incremental, small, and understandable changes.
- Generate commits with clear, imperative messages describing intent (e.g. "feat: add Mermaid viewer component").
- Use feature branches and open Pull Requests for non-trivial changes; avoid direct commits to `main` except for fast administrative fixes.
- Keep code consistent with the repository's existing style and conventions.
- For larger changes, include a short rationale in code comments and the PR description.
- Generated code should include reasonable validation, basic error handling, and logging where it helps diagnose issues.

6. Quality & Testing
---------------------

- When applicable, include basic tests (unit or integration) covering key behavior.
- Prefer lightweight, pragmatic testing frameworks and fast-running tests.
- Validate that the application builds and runs locally before committing a change.

7. AI‑Native SDLC Rules (Traceability)
-------------------------------------

- Wherever possible, link development work to GitHub Issues.
- Reflect important Copilot prompts and iterations in Issue comments so the decision trail is traceable.
- When Copilot generates code or documentation, include a brief note in the related Issue or PR describing the prompt and the intended intent.

Operational Notes for Copilot Use
---------------------------------

- When providing code snippets, ensure they are full, runnable examples (not fragments) or clearly labeled partials with instructions for integration.
- When scaffolding new modules or services, produce a minimal README and sample usage for that component.
- Validate third‑party libraries: prefer actively maintained packages with compatible licenses.
- Always avoid leaking secrets or tokens into the repository; prefer environment variable configuration.

Enforcement
-----------

Treat this file as the canonical source of rules for Copilot-assisted development and for humans following Copilot suggestions. If a suggested change violates these rules, prefer producing an alternative that adheres to them. When in doubt, create a small Issue to discuss the proposed deviation and include the Copilot prompt that produced it.

Updates to these instructions should be tracked through normal PR workflows and referenced in the project's `README.md` when significant.