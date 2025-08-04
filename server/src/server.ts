e/// <reference path="./types/pdf-parse-lib.d.ts" />
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
// @ts-ignore - PDFKit has some type inconsistencies with modules
import PDFKitDocument from 'pdfkit';
import { PDFDocument as PDFLibDocument } from 'pdf-lib'; // Renamed to avoid conflict
import fs from 'fs';

// Define a type for the file upload promise
interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

dotenv.config();
const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Grab __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Define downloads directory path BEFORE it's used in resolvers
const downloadsDir = path.join(__dirname, '../downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

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
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a highly accurate resume parser. Extract all sections from the provided text, including contactInfo (name, email, phone, linkedin, github), education (as an array), experience (as an array), projects (as an array), skills (as an object or array), and honorsAndAwards (as an array). Maintain the original structure and content as closely as possible. Return the data in a valid JSON object.`
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

// **UPDATED**: A much more robust function to generate a compact, one-page PDF resume
async function generateResumePdf(resumeData: any, outputPath: string): Promise<void> {
    const doc = new PDFKitDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const leftMargin = doc.page.margins.left;
    const rightMargin = doc.page.margins.right;
    const contentWidth = doc.page.width - leftMargin - rightMargin;

    const sectionHeader = (title: string) => {
        if (doc.y > 720) return; // Prevent orphaned headers
        doc.fontSize(11).font('Helvetica-Bold').text(title.toUpperCase(), { lineBreak: false });
        const titleWidth = doc.widthOfString(title.toUpperCase());
        doc.strokeColor("#cccccc").moveTo(leftMargin + titleWidth + 8, doc.y + 6).lineTo(doc.page.width - rightMargin, doc.y + 6).stroke();
        doc.moveDown(1.2);
    };

    // --- Header ---
    if (resumeData.contactInfo) {
        const { name, email, phone, linkedin, github } = resumeData.contactInfo;
        if (name) doc.fontSize(22).font('Helvetica-Bold').text(name, { align: 'center' });
        const contactLine = [email, phone, linkedin, github].filter(Boolean).map(String).join('  |  ');
        if (contactLine) doc.fontSize(9).font('Helvetica').text(contactLine, { align: 'center', characterSpacing: 0.5 });
        doc.moveDown(1.5);
    }

    // --- Two-Column Row Function ---
    const renderTwoColumnRow = (leftText: string, rightText: string, options: {leftFont?: string, rightFont?: string, size?: number}) => {
        const yPos = doc.y;
        doc.font(options.leftFont || 'Helvetica').fontSize(options.size || 10).text(leftText, leftMargin, yPos);
        const rightTextWidth = doc.widthOfString(rightText);
        doc.font(options.rightFont || 'Helvetica').fontSize(options.size || 10).text(rightText, doc.page.width - rightMargin - rightTextWidth, yPos);
    };

    // --- Education ---
    if (Array.isArray(resumeData.education) && resumeData.education.length > 0) {
        sectionHeader('Education');
        resumeData.education.forEach((edu: any) => {
            renderTwoColumnRow(edu.institution || 'Institution', edu.year || '', {leftFont: 'Helvetica-Bold', size: 10});
            doc.fontSize(10).font('Helvetica-Oblique').text(edu.degree || 'Degree');
            if(edu.gpa) doc.fontSize(9).font('Helvetica').text(`GPA: ${edu.gpa}`);
            doc.moveDown(1);
        });
    }

    // --- Experience ---
    if (Array.isArray(resumeData.experience) && resumeData.experience.length > 0) {
        sectionHeader('Work Experience');
        resumeData.experience.forEach((job: any) => {
            renderTwoColumnRow(job.company || 'Company', job.duration || '', {leftFont: 'Helvetica-Bold', size: 10});
            doc.fontSize(10).font('Helvetica-Oblique').text(job.position || 'Position');
            if (Array.isArray(job.impactBullets) && job.impactBullets.length > 0) {
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(9.5).list(job.impactBullets.map(String), { bulletRadius: 1.2, textIndent: 10, indent: 15, lineGap: 2 });
            }
            doc.moveDown(1);
        });
    }

    // --- Projects ---
    if (Array.isArray(resumeData.projects) && resumeData.projects.length > 0) {
        sectionHeader('Projects');
        resumeData.projects.forEach((proj: any) => {
            doc.fontSize(10).font('Helvetica-Bold').text(proj.projectName || 'Project');
            if (proj.techStack) doc.fontSize(8.5).font('Helvetica-Oblique').text(`Tech: ${proj.techStack}`);
            if (Array.isArray(proj.impactBullets) && proj.impactBullets.length > 0) {
                doc.moveDown(0.4);
                doc.font('Helvetica').fontSize(9.5).list(proj.impactBullets.map(String), { bulletRadius: 1.2, textIndent: 10, indent: 15, lineGap: 2 });
            }
            doc.moveDown(1);
        });
    }

    // --- Skills ---
    if (resumeData.skills) {
        sectionHeader('Skills');
        if (typeof resumeData.skills === 'object' && !Array.isArray(resumeData.skills)) {
             Object.entries(resumeData.skills).forEach(([category, skillsList]) => {
                if (Array.isArray(skillsList)) {
                    doc.fontSize(9.5).font('Helvetica-Bold').text(`${category}: `, { continued: true, lineGap: 3 });
                    doc.font('Helvetica').text(skillsList.join(', '));
                }
             });
        } else if (Array.isArray(resumeData.skills)) {
            doc.fontSize(9.5).font('Helvetica').text(resumeData.skills.join(', '));
        }
    }

    // --- Honors & Awards ---
    if (Array.isArray(resumeData.honorsAndAwards) && resumeData.honorsAndAwards.length > 0) {
        doc.moveDown(1);
        sectionHeader('Honors and Awards');
        doc.fontSize(9.5).font('Helvetica').list(resumeData.honorsAndAwards.map(String), { bulletRadius: 1.5, textIndent: 10, indent: 15, lineGap: 2 });
    }

    doc.end();

    return new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
}


const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    documents: (_: any, __: any, { prisma }: { prisma: PrismaClient }) =>
      prisma.extractedDocument.findMany()
  },
  Mutation: {
    uploadPdf: async (
      _: any,
      { file }: { file: Promise<FileUpload> },
      { prisma }: { prisma: PrismaClient }
    ) => {
      try {
        console.log('Starting PDF upload process...');
        const { createReadStream, filename } = await file;
        console.log('File details:', { filename });
        
        const buffer = await streamToBuffer(createReadStream());
        console.log('File buffer created, size:', buffer.length);
        
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const pdfData = await pdfParse(buffer);
        const extractedText = pdfData.text;
        console.log('Extracted text from PDF:', extractedText.slice(0, 200));
        
        const structuredInfo = await extractStructuredInfo(extractedText);
        console.log('Structured information:', structuredInfo);
        
        const openaiResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a document analysis assistant. Provide a concise summary of the document, highlighting key points."
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
        
        const pdfDoc = await PDFLibDocument.load(buffer);
        const pageCount = pdfDoc.getPageCount();
        console.log('PDF page count:', pageCount);
        
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
        throw new Error('Failed to process PDF. Please ensure it is a valid PDF file.');
      }
    },
    updateResume: async (
      _: any,
      { resume, jobDescription }: { resume: Promise<FileUpload>, jobDescription: string },
      { prisma }: { prisma: PrismaClient }
    ) => {
      try {
        if (!jobDescription || jobDescription.trim() === '') {
            throw new Error('Job Description cannot be empty.');
        }

        const { createReadStream } = await resume;
        const buffer = await streamToBuffer(createReadStream());
        
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const pdfData = await pdfParse(buffer);
        const resumeText = pdfData.text;

        if (!resumeText || resumeText.trim() === '') {
            throw new Error('Could not extract text from the provided resume PDF.');
        }
        
        // **STEP 1: Parse the original resume to preserve its structure**
        const originalResumeJson = await extractStructuredInfo(resumeText);
        console.log("Original parsed resume:", JSON.stringify(originalResumeJson, null, 2));


        // **STEP 2: Use the AI to update ONLY the experience and projects**
        const systemPrompt = `
# MISSION
You are 'Synapse', a top-tier career strategist. Your only task is to rewrite the "experience" and "projects" sections of a resume to align with a job description, ensuring the final content creates a well-balanced, professional, single-page document.

# RULES
- **One-Page Constraint & Dynamic Content Density:** This is your most important rule. The final resume MUST be concise enough to fit on a single page without large empty spaces or overflowing.
  - **Analyze Content Length:** First, assess the user's original resume content.
  - **For Long Resumes:** If the user has extensive experience (e.g., 3+ jobs, 3+ projects), be RUTHLESS. Cut less relevant roles or projects entirely. Limit bullet points to the top 2-3 most impactful ones per entry. Write very concisely.
  - **For Short Resumes:** If the user's resume is short (e.g., a new graduate with 1-2 internships), you can use more detail to fill the page. Expand with up to 3-4 relevant bullet points per entry.
- **Focus:** ONLY output the \`experience\` and \`projects\` keys. Do not output any other resume sections.
- **Impact Statements:** Rewrite every bullet point to be a quantifiable impact statement (use the STAR method). Use the word "and" instead of "&".
- **Structure:** The final output MUST be a single, valid JSON object starting with \`{\` and ending with \`}\`.
  - \`experience\` MUST be an array of objects: \`[{"company": "...", "position": "...", "duration": "...", "location": "...", "impactBullets": ["..."]}]\`.
  - \`projects\` MUST be an array of objects: \`[{"projectName": "...", "techStack": "...", "impactBullets": ["..."]}]\`.
  - The \`impactBullets\` key is mandatory and must be an array of strings.

# FINAL OUTPUT
Your response will be a JSON object containing ONLY the updated \`experience\` and \`projects\` arrays, followed by a "StrategicDebrief" explaining your changes.
`;

        console.log('Resume text length:', resumeText.length);
        console.log('Job description length:', jobDescription.length);
        // Truncate inputs for speed and reliability
        const truncatedResume = resumeText.slice(0, 5000);
        const truncatedJobDesc = jobDescription.slice(0, 3000);
        // Use truncated values in the OpenAI prompt
        const openaiResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo", // Switched to gpt-3.5-turbo for faster response
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `[USER_RESUME_JSON]:\n${JSON.stringify({rawContent: truncatedResume}, null, 2)}\n\n[JOB_DESCRIPTION_TEXT]:\n${truncatedJobDesc}` }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1024 // Limit output for speed
        });
        
        const rawAI = openaiResponse.choices[0].message.content || '{}';
        console.log('AI response length:', rawAI.length);
        if (rawAI.length > 1000000) { // 1MB
          throw new Error('AI response too large to process.');
        }
        const aiResult = JSON.parse(rawAI);
        const changeLog = aiResult.StrategicDebrief || 'No changes logged by AI.';
        
        // **STEP 3: Merge original data with AI-updated sections**
        const finalResumeJson = {
            ...originalResumeJson, // Keep original contact, education, skills, etc.
            experience: aiResult.experience || originalResumeJson.experience, // Use AI version, fallback to original
            projects: aiResult.projects || originalResumeJson.projects, // Use AI version, fallback to original
        };
        console.log('Resume data keys:', Object.keys(finalResumeJson).length);
        if (Object.keys(finalResumeJson).length > 1000) {
          throw new Error('Resume data too large to process.');
        }
        
        const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 10000);
        const pdfFilename = `updated-resume-${uniqueId}.pdf`;
        const pdfPath = path.join(downloadsDir, pdfFilename);
        
        console.log('Rendering final merged PDF with:', JSON.stringify(finalResumeJson, null, 2));
        
        // **STEP 4: Generate the new PDF using the merged data**
        await generateResumePdf(finalResumeJson, pdfPath);
        
        if (!fs.existsSync(pdfPath)) {
          throw new Error('PDF file was not created successfully.');
        } else {
          console.log('PDF file created at:', pdfPath);
        }

        const downloadUrl = `http://localhost:4000/downloads/${pdfFilename}`;
        return {
          downloadUrl,
          changes: changeLog,
          updatedResumeJson: finalResumeJson // Return the complete, merged resume
        };
      } catch (error) {
        console.error('Error in updateResume mutation:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to update resume: ${error.message}`);
        }
        throw new Error('An unknown error occurred while updating the resume.');
      }
    },
  },
};

async function start() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  const app = express();
  
  const allowedOrigins = [
    'http://localhost:5173',
    'https://studio.apollographql.com',
    'https://anmolbaral.github.io',
    process.env.FRONTEND_URL
  ].filter(Boolean) as string[];

  app.use(cors({ origin: allowedOrigins }));

  app.use('/downloads', express.static(downloadsDir));

  app.get('/', (req, res) => {
    res.status(200).send('Server is healthy');
  });

  app.use('/graphql', graphqlUploadExpress({ 
    maxFileSize: 10_000_000,
    maxFiles: 1
  }));

  app.use('/graphql', express.json({ limit: '50mb' }));
  
  app.use(
    '/graphql',
    expressMiddleware(server, { 
      context: async () => ({ prisma })
    })
  );

  const port = parseInt(process.env.PORT || '8080', 10);
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err, origin) => {
  console.error('Uncaught Exception:', err, 'Origin:', origin);
});

start().catch(console.error);
