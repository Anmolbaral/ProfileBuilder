# PDF Extractor

A web application that extracts and analyzes content from PDF files using AI. The application provides structured summaries, metadata extraction, and raw text content from uploaded PDFs.

## Live Demo

The application is hosted and can be accessed at: [https://anmolbaral.github.io/ProfileBuilder/results](https://anmolbaral.github.io/ProfileBuilder/results)

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **AI Integration**: OpenAI API
- **PDF Processing**: pdfjs-dist
- **Deployment**: 
  - Frontend: GitHub Pages
  - Backend: Render.com
  - Database: Render.com PostgreSQL

## Features

- PDF file upload and processing
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
npm start
```

## Deployment

The application is deployed using:
- Frontend: GitHub Pages for static hosting
- Backend: Render.com for the Node.js server
- Database: Render.com PostgreSQL service until Google Cloud work is complete

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







