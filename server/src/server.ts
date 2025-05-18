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

// Helper to extract text from PDF using OpenAI
async function extractTextWithOpenAI(buffer: Buffer): Promise<string> {
  try {
    console.log('Starting OpenAI processing...');
    console.log('Buffer size:', buffer.length);
    
    const base64PDF = buffer.toString('base64');
    console.log('Base64 PDF length:', base64PDF.length);

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract and summarize the key information from this PDF document." },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64PDF}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    console.log('OpenAI Response:', response);
    const extractedText = response.choices[0].message.content || '';
    console.log('Extracted text:', extractedText);
    return extractedText;
  } catch (error) {
    console.error('OpenAI API error:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    return '';
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
        
        const buffer = await streamToBuffer(createReadStream());
        console.log('File buffer created, size:', buffer.length);
        
        // Extract text using pdf-parse
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const pdfData = await pdfParse(buffer);
        const extractedText = pdfData.text;
        console.log('Extracted text from PDF:', extractedText.slice(0, 500)); // log first 500 chars
        
        // Send extracted text to OpenAI for summarization/analysis
        const openaiResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "user", content: `Summarize the following document:\n\n${extractedText}` }
          ],
          max_tokens: 1000
        });
        const summary = openaiResponse.choices[0].message.content || '';
        console.log('OpenAI summary:', summary);
        
        // Use pdf-lib to get page count
        const pdfDoc = await PDFDocument.load(buffer);
        const pageCount = pdfDoc.getPageCount();
        console.log('PDF page count:', pageCount);
        
        // Store both the extracted text, summary, and metadata
        const metadata = { 
          pageCount,
          summary
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
        throw error;
      }
    },
  },
};

async function start() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  const app = express();
  
  // Enable CORS for all routes
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'https://studio.apollographql.com'
    ],
    credentials: true
  }));

  // 1) must come BEFORE body-parsers:
  app.use('/graphql', graphqlUploadExpress({ 
    maxFileSize: 10_000_000, 
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

  app.listen(4000, () =>
    console.log('🚀 Server ready at http://localhost:4000/graphql')
  );
}

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

start().catch(console.error);