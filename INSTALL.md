# Installation & Running

This repository ships a minimal MVP with two services:

- Backend (NestJS) on port 3000
- Frontend (NextJS) on port 3001 (maps to container port 3000)

## 1) Development (Docker images)

Build images locally:

    docker build -t demo-ai-native-sdlc-backend:local ./services/backend
    docker build -t demo-ai-native-sdlc-frontend:local ./services/frontend

Run backend:

    docker run --rm -p 3000:3000 \
      -e PORT=3000 \
      -e APP_ENV=local \
      -e APP_NAME=demo-ai-native-sdlc-backend \
      -e NODE_ENV=production \
      demo-ai-native-sdlc-backend:local

Run frontend (talks to backend via your host network):

    docker run --rm -p 3001:3000 \
      -e NODE_ENV=production \
      -e NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 \
      demo-ai-native-sdlc-frontend:local

## 2) Development (Docker Compose)

Build and run the full stack:

    docker compose up --build -d

Stop and remove containers:

    docker compose down

Remove containers and the diagrams volume (destructive):

    docker compose down -v

## 3) Local checks

Backend:
- Health: http://localhost:3000/health
- API health: http://localhost:3000/api/health
- Swagger/OpenAPI: http://localhost:3000/api/docs

Frontend:
- UI: http://localhost:3001

## 4) CI pipeline overview (Docker publish)

Workflow file:
- .github/workflows/docker-publish.yml

Triggers:
- Push to main (e.g. PR merged)
- Manual run via GitHub Actions (workflow_dispatch)

Publishing:
- Logs in to Docker Hub using the repository secrets:
  - DOCKERHUB_USERNAME
  - DOCKERHUB_TOKEN
  - DOCKERHUB_REPOSITORY

Image naming:
- Base repository: DOCKERHUB_USERNAME/DOCKERHUB_REPOSITORY
- Two images are published to the same repository, disambiguated by tags.

Tag scheme:
- Version source:
  - If HEAD is tagged with vX.Y.Z (or vX.Y.Z-suffix), that tag is used as the version
  - Otherwise the version defaults to mvp
- Published tags (main branch only):
  - Backend:
    - DOCKERHUB_USERNAME/DOCKERHUB_REPOSITORY:backend-<version>
    - DOCKERHUB_USERNAME/DOCKERHUB_REPOSITORY:backend-latest
  - Frontend:
    - DOCKERHUB_USERNAME/DOCKERHUB_REPOSITORY:frontend-<version>
    - DOCKERHUB_USERNAME/DOCKERHUB_REPOSITORY:frontend-latest

Manual trigger notes:
- In GitHub Actions, pick the workflow “Docker Publish” and click “Run workflow”.
- Run it from the main branch. (The workflow refuses to publish from other branches.)
- Optionally provide an explicit version input (otherwise it uses git tag vX.Y.Z on HEAD, else mvp).

## 5) Production run (Docker Compose)

The production compose file pulls published images from Docker Hub:
- docker-compose.prod.yml

Run (defaults to IMAGE_TAG=mvp):

    export DOCKERHUB_USERNAME=elyskov
    export DOCKERHUB_REPOSITORY=demo-ai-native-sdlc
    export IMAGE_TAG=mvp
    docker compose -f docker-compose.prod.yml up -d

Verify:

    curl -sf http://localhost:3000/api/health
    curl -sf http://localhost:3001

Stop:

    docker compose -f docker-compose.prod.yml down

## Manual test plan (CI)

1) workflow_dispatch on main
- Run the workflow manually
- Confirm images exist on Docker Hub with tags backend-mvp/frontend-mvp (or backend-vX.Y.Z/frontend-vX.Y.Z if tagged)

2) Merge trigger
- Merge a small PR to main
- Confirm the workflow runs and pushes backend-latest/frontend-latest plus backend-<version>/frontend-<version>

3) Pull and run prod compose
- On a clean machine:

    export DOCKERHUB_USERNAME=<your user>
    export DOCKERHUB_REPOSITORY=<repo>
    export IMAGE_TAG=mvp
    docker compose -f docker-compose.prod.yml up -d
    curl -sf http://localhost:3000/api/health
    curl -sf http://localhost:3001

4) Regression: frontend -> backend connectivity
- Open the frontend and confirm it can call backend APIs
