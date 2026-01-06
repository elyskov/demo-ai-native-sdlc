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
- Mermaid.js — visual diagrams (C4 / deployment views)
- Docker — containerization and local deployment

Application (MVP)
-----------------

The application is a minimal web MVP that allows users to visually create and update C4 deployment diagrams (rendered with Mermaid) and export generated inventory data as CSV files usable by NetBox.

Prerequisites
-------------

- VS Code with GitHub Copilot enabled
- A GitHub account (to use Copilot and push to the remote)
- Node.js (LTS recommended)
- Docker & Docker Compose (for local container workflows)

Backend (Nest.js)
----------------

The backend lives in `services/backend`.

Run with Docker (image)
~~~~~~~~~~~~~~~~~~~~~~

- Build: `docker build -t demo-ai-native-sdlc-backend:local ./services/backend`
- Run: `docker run --rm -p 3000:3000 -e APP_ENV=local -e APP_NAME=demo-ai-native-sdlc-backend demo-ai-native-sdlc-backend:local`

Run with Docker Compose
~~~~~~~~~~~~~~~~~~~~~~~

- Start: `docker compose up --build`

Check locally
~~~~~~~~~~~~~

- Health endpoint: http://localhost:3000/health

Frontend (Next.js)
------------------

The frontend lives in `services/frontend` and uses the Next.js App Router.

Run with Docker Compose
~~~~~~~~~~~~~~~~~~~~~~~

- Start: `docker compose up --build`

Check locally
~~~~~~~~~~~~~

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
