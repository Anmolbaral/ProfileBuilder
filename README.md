# PDF Extractor

A web application that extracts and analyzes resume content with AI, and suggests targeted edits to personalize your resume for a specific job description.

## Live Demo

The application is hosted at: [https://resumepersonalizer.web.app](https://resumepersonalizer.web.app)

## Tech Stack

- **Frontend**: React (TypeScript), Vite
- **Styling/UI**: Tailwind CSS, Radix UI, shadcn/ui, MUI (select components)
- **Client Data**: Apollo Client (GraphQL), `apollo-upload-client` for file uploads
- **Backend**: Node.js (Express) + Apollo Server (GraphQL)
- **Database**: PostgreSQL (via Prisma)
- **AI Integration**: OpenAI API
- **PDF Processing**: pdf-parse, pdf-lib, pdfkit
- **Deployment**:
  - Frontend: Firebase Hosting (SPA rewrites enabled)
  - Backend: Render.com (Cloud Run migration planned)
  - Database: PostgreSQL on Render.com (Cloud SQL migration planned)

## Features

- PDF file and job description upload and processing
- AI-powered content analysis
- Structured summary generation
- Metadata extraction
- Raw text extraction
- Modern, responsive UI

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/Anmolbaral/ProfileBuilder.git
```

2. Install dependencies:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../app
npm install
```

3. Set up environment variables:
Create a `.env` file in the server directory with:
```
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_openai_api_key
```

4. Start the development servers:
```bash
# Start the backend server
cd server
npm run dev

# Start the frontend development server
cd ../app
npm run dev
```

## Deployment

### Frontend (Firebase Hosting)

1) Build with a root base path and your API URL:
```bash
cd app
VITE_API_URL="https://<your-backend-domain>/graphql" npm run build -- --base=/
```

2) Initialize Firebase Hosting (one-time, at repo root):
```bash
cd ..
firebase init hosting
# public directory: app/dist
# single-page app rewrite: Yes
```

3) Deploy:
```bash
firebase deploy --only hosting
```

Notes:
- Router uses `basename={import.meta.env.BASE_URL}` so it works on both GitHub Pages and Firebase. For Firebase builds we pass `--base=/`.
- Ensure your backend CORS allows `https://<project>.web.app` and `https://<project>.firebaseapp.com`.

### Backend (current)
- Hosted on Render.com at `https://profilebuilder-uejc.onrender.com`.
- Exposes `/graphql`, `/health`, and serves generated PDFs from `/downloads`.

### Planned (Google Cloud)
- Backend to Cloud Run, PDFs to Cloud Storage (public or signed URLs), DB to Cloud SQL. Build-time client `VITE_API_URL` will point to the Cloud Run `/graphql` URL.

## Challenges & Solutions

### Challenge: Slow updated resume generation
- Users experienced delays when generating the optimized resume after uploading a PDF and job description.
- This felt like the app was stuck or unreliable, especially on weaker networks or when the server was cold-starting.

### Why it happened
- Large PDF files and AI calls take time to process.
- Network issues (CORS/CSRF/timeout) caused retries or failures.
- No caching meant we re-fetched and re-rendered even when results were already available.
- UI didn’t clearly communicate progress, so even normal processing felt “slow”.

### What we did (simple, effective fixes)
1. Faster networking and fewer failures
   - Disabled CSRF for file uploads (server) and simplified headers to remove unnecessary checks.
   - Added CORS correctly and used `apollo-upload-client` with a direct GraphQL upload link.
   - Used `fetchOptions: { mode: 'cors', credentials: 'omit' }` to avoid credential noise.

2. Clear progress and cancel/retry
   - Added a real-time progress state with stages: uploading → processing → finalizing.
   - Visual progress bar + percent + ETA so users know it’s working.
   - Added “Retry” and “Cancel” so users can recover without reloading.

3. Smart caching to skip repeat work
   - Stored final analysis (`resumeAnalysisResult`) in `localStorage`.
   - Results page first checks cache and renders instantly if available.
   - Only fetch if cache is missing or invalid.

4. Health checks and offline handling
   - Added “Test Server Connection” button and a health check endpoint.
   - Monitored online/offline state and displayed helpful messages.

5. UI performance and responsiveness
   - Used React `lazy` and `Suspense` to load heavy components on demand.
   - Memoized static data (mock data, lists) to avoid unnecessary re-renders.
   - Reduced initial render work and improved perceived speed.

### The result
- Much faster perceived performance (user sees results quickly from cache).
- Fewer failed uploads and clearer recovery options.
- Transparent progress and better user control.
- Overall: snappier, more reliable experience, even on slower networks.







