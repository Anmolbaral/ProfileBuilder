/// <reference path="./types/pdf-parse-lib.d.ts" />
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAI } from 'openai';

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import { PrismaClient } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';

dotenv.config();
const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Grab __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load your SDL
const typeDefs = readFileSync(
  path.join(__dirname, 'schema.graphql'),
  'utf8'
);

// Helper to buffer the Upload stream
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Helper to extract and structure information from PDF text
async function extractStructuredInfo(text: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a PDF parser that extracts structured information from text. Extract the following information if available: name, email, phone, education (as an array of objects with institution, degree, year), experience (as an array of objects with company, position, duration), skills (as an array). Return the data in JSON format.\n\nAdditionally, for the raw text output, format it for maximum readability:\n- Clearly separate paragraphs with double line breaks.\n- Identify and format headings (such as section titles or bold/large text) by placing them on their own line, surrounded by double asterisks (e.g., **Heading**).\n- For bullet points or lists, use a dash (-) or bullet (•) at the start of each item, and keep each bullet on its own line.\n- If there are numbered lists, use 1., 2., etc., at the start of each item.\n- Preserve any indentation or structure that helps clarify the document's organization.\n- Do not include any extra commentary or explanation—just return the formatted text.`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });

    const structuredData = JSON.parse(response.choices[0].message.content || '{}');
    return structuredData;
  } catch (error) {
    console.error('Error in structured info extraction:', error);
    return {};
  }
}

const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    documents: (_: any, __: any, { prisma }: any) =>
      prisma.extractedDocument.findMany(),
  },
  Mutation: {
    uploadPdf: async (
      _: any,
      { file }: { file: any },
      { prisma }: { prisma: PrismaClient }
    ) => {
      try {
        console.log('Starting PDF upload process...');
        const { createReadStream, filename } = await file;
        console.log('File details:', { filename });
        
        // 1. Read the file into buffer
        const buffer = await streamToBuffer(createReadStream());
        console.log('File buffer created, size:', buffer.length);
        
        // 2. Extract text using pdf-parse
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const pdfData = await pdfParse(buffer);
        const extractedText = pdfData.text;
        console.log('Extracted text from PDF:', extractedText.slice(0, 500)); // log first 500 chars
        
        // 3. Get structured information
        const structuredInfo = await extractStructuredInfo(extractedText);
        console.log('Structured information:', structuredInfo);
        
        // 4. Generate summary
        const openaiResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a document analysis assistant. Your task is to provide a concise summary of the document, highlighting the key points, main topics, and any important details. Keep the summary clear and well-structured, focusing on the most relevant information. Format the summary in a way that makes it easy to read and understand."
            },
            {
              role: "user",
              content: `Analyze this document:\n\n${extractedText}`
            }
          ],
          max_tokens: 500
        });
        const summary = openaiResponse.choices[0].message.content || '';
        console.log('OpenAI summary:', summary);
        
        // 5. Get page count
        const pdfDoc = await PDFDocument.load(buffer);
        const pageCount = pdfDoc.getPageCount();
        console.log('PDF page count:', pageCount);
        
        // 6. Store everything in the database
        const metadata = {
          pageCount,
          summary,
          ...structuredInfo
        };
        
        const result = await prisma.extractedDocument.create({
          data: {
            filename,
            rawText: extractedText,
            metadata
          },
        });
        
        console.log('Document saved to database:', result);
        return result;
      } catch (error) {
        console.error('Error in uploadPdf mutation:', error);
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
          });
        }
        throw new Error('Failed to process PDF. Please ensure it is a valid PDF file and try again.');
      }
    },
  },
};

async function start() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  const app = express();
  
  // Enable CORS for all routes
  const allowedOrigins = [
    'http://localhost:5173',
    'https://studio.apollographql.com',
    'https://anmolbaral.github.io',
    'https://anmolbaral.github.io/ProfileBuilder',
    process.env.FRONTEND_URL
  ].filter(Boolean) as string[];

  app.use(cors({
    origin: allowedOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Apollo-Require-Preflight',
      'Accept',
      'Origin',
      'X-Requested-With'
    ]
  }));

  // Add a health check endpoint
  app.get('/', (req, res) => {
    res.send('Server is running');
  });

  // 1) must come BEFORE body-parsers:
  app.use('/graphql', graphqlUploadExpress({ 
    maxFileSize: 10_000_000, // 10MB
    maxFiles: 1
  }));

  // 2) JSON/urlencoded parsing
  app.use('/graphql', express.json({ limit: '50mb' }));
  app.use('/graphql', express.urlencoded({ extended: true }));

  // 3) Apollo
  app.use(
    '/graphql',
    expressMiddleware(server, { 
      context: async () => ({ prisma })
    })
  );

  const port = process.env.PORT || 4000;
  app.listen(port, () =>
    console.log(`🚀 Server ready at http://localhost:${port}/graphql`)
  );
}

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

start().catch(console.error);