# Frontend

React + Vite + TypeScript app for the PsicoFinder discovery experience.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_API_BASE_URL` to your FastAPI service, for example `http://localhost:8000/api/v1`.

## Vercel deployment

Deploy this app as a static Vite site from the `frontend/` directory.

Suggested settings:

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

Environment variables:

- `VITE_API_BASE_URL=https://YOUR-CLOUD-RUN-SERVICE-URL/api/v1`

If you keep the backend on Cloud Run, make sure the backend URL is the full public service URL and includes `/api/v1`.
