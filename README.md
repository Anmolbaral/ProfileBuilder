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







