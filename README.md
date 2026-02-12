# demo-ai-native-sdlc

Demonstration of an AI‑Native SDLC approach using GitHub Copilot.

Project goal
-----------

This repository demonstrates the AI‑Native SDLC workflow where GitHub Copilot drives most of the development and documentation. The project showcases how Copilot can assist in designing, implementing, and documenting an application end-to-end.

Development approach
--------------------

Most development and documentation for this project should be produced interactively through GitHub Copilot within VS Code. The repository acts as an MVP scaffold and a collaboration surface for Copilot-assisted iterations.

Technology stack
----------------

- Nest.js — backend services and APIs
- Next.js — frontend and server-side rendering
- Mermaid.js — visual diagrams (Flowchart diagrams)
- Docker — containerization and local deployment

Application (MVP)
-----------------

The application is a minimal web MVP that allows users to visually create and update specific Flowchart diagrams (rendered with Mermaid) and export generated inventory data as CSV files usable by NetBox.

Prerequisites
-------------

- VS Code with GitHub Copilot enabled
- A GitHub account (to use Copilot and push to the remote)
- Node.js (LTS recommended)
- Docker & Docker Compose (for local container workflows)

Installation / Running
----------------------

See INSTALL.md for:

- Local development (Docker images + Docker Compose)
- Local verification URLs (health, Swagger, frontend)
- CI pipeline behavior (Docker publish)
- Production run via docker-compose.prod.yml
