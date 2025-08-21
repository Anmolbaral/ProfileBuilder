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
import fs from 'fs';
import crypto from 'node:crypto';

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
    return {};
  }
}

// Intelligent content selection system
type JDSignals = { mustHave: Set<string>; niceToHave: Set<string>; };

function extractJDSignals(jd: string): JDSignals {
  const norm = (s: string) => s.toLowerCase();
  const tokens = new Set(norm(jd).match(/[a-z0-9\-\+#\.]{2,}/g) || []);
  // crude split: treat frequent tech terms as must-have (can be improved)
  const mustHave = new Set([...tokens].filter(t => /sql|graphql|react|node|kafka|aws|gcp|python|typescript|etl|ml|llm|latency|throughput/.test(t)));
  const niceToHave = new Set([...tokens].filter(t => !mustHave.has(t)));
  return { mustHave, niceToHave };
}

function scoreBullet(bullet: string, sig: JDSignals, recencyBoost = 0, rarityMap?: Map<string, number>) {
  const b = bullet.toLowerCase();
  let s = 0;
  for (const k of sig.mustHave) if (b.includes(k)) s += 8;
  for (const k of sig.niceToHave) if (b.includes(k)) s += 2;
  if (/\b(\d+%|\$\d+|p9[05]|p[0-9]{2}|[0-9]+(ms|s|x|k|m))\b/i.test(b)) s += 5; // impact
  if (rarityMap) for (const [tok, rarity] of rarityMap) if (b.includes(tok)) s += rarity; // reward rare tech
  s += recencyBoost; // newer roles get small boost
  return s;
}

function topBullets(bullets: string[], sig: JDSignals, k = 3, recencyBoost = 0) {
  return bullets
    .map(b => ({ b, s: scoreBullet(b, sig, recencyBoost) }))
    .sort((a, z) => z.s - a.s)
    .slice(0, k)
    .map(x => x.b);
}

function composeForLLM(parsed: any, jd: string, maxChars = 4000) {
  const sig = extractJDSignals(jd);

  const pinned = {
    contactInfo: parsed.contactInfo ?? {},
    education: (parsed.education ?? []).slice(0, 1), // summary row
    skills: (parsed.skills ?? []).slice?.(0, 12) ?? parsed.skills
  };

  const roles = (parsed.experience ?? []).map((r: any, i: number) => {
    const recencyBoost = Math.max(0, 3 - i); // boost top 3 roles
    const picked = topBullets(r.impactBullets ?? [], sig, 3, recencyBoost);
    return { company: r.company, position: r.position, duration: r.duration, location: r.location, impactBullets: picked };
  });

  // drop roles that ended up empty after ranking (low match)
  const prunedRoles = roles.filter((r: any) => (r.impactBullets?.length ?? 0) > 0);

  const projects = (parsed.projects ?? []).map((p: any) => {
    const picked = topBullets(p.impactBullets ?? [], sig, 2, 1);
    return { projectName: p.projectName, techStack: p.techStack, impactBullets: picked };
  }).filter((p: any) => (p.impactBullets?.length ?? 0) > 0).slice(0, 2);

  const out = { ...pinned, experience: prunedRoles.slice(0, 4), projects };

  // final safety: hard cap by characters to respect model/window and keep latency/cost down
  const json = JSON.stringify(out);
  if (json.length > maxChars) {
    // fallback: tighten bullets further
    out.experience.forEach((r: any) => r.impactBullets = (r.impactBullets ?? []).slice(0, 2));
    out.projects.forEach((p: any) => p.impactBullets = (p.impactBullets ?? []).slice(0, 1));
  }
  return out;
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

// Lightweight in-memory LRU cache for results to reduce repeat work
const RESULT_CACHE_MAX_ENTRIES = 50;
type CachedResult = {
  downloadUrl: string;
  pdfPath: string;
};
const resultCache = new Map<string, CachedResult>();

function computeRequestKey(buffer: Buffer, jobDescription: string): string {
  const hasher = crypto.createHash('sha256');
  // Hash up to first 1MB of file to avoid large memory cost
  const slice = buffer.byteLength > 1_048_576 ? buffer.subarray(0, 1_048_576) : buffer;
  hasher.update(slice);
  hasher.update('\n||\n');
  hasher.update(jobDescription.slice(0, 2000));
  return hasher.digest('hex');
}

function getCachedResult(key: string): CachedResult | null {
  const cached = resultCache.get(key);
  if (!cached) return null;
  // Ensure file still exists; if not, invalidate
  if (!fs.existsSync(cached.pdfPath)) {
    resultCache.delete(key);
    return null;
  }
  // Touch entry to mark as recently used
  resultCache.delete(key);
  resultCache.set(key, cached);
  return cached;
}

function setCachedResult(key: string, value: CachedResult) {
  if (resultCache.has(key)) resultCache.delete(key);
  resultCache.set(key, value);
  if (resultCache.size > RESULT_CACHE_MAX_ENTRIES) {
    // Evict least-recently used (first entry in Map)
    const oldestKey = resultCache.keys().next().value as string | undefined;
    if (oldestKey) resultCache.delete(oldestKey);
  }
}


const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    documents: async (_: any, __: any, { prisma }: { prisma: PrismaClient }) => {
      try {
        console.log('📋 Query: documents called');
        const docs = await prisma.extractedDocument.findMany({
          orderBy: { createdAt: 'desc' }
        });
        console.log(`📋 Found ${docs.length} documents`);
        
        // Parse metadata strings back to objects for GraphQL response
        return docs.map(doc => ({
          ...doc,
          metadata: (() => {
            try {
              return JSON.parse(String(doc.metadata || '{}'));
            } catch (e) {
              console.warn(`⚠️ Failed to parse metadata for doc ${doc.id}:`, e);
              return {}; // Return empty object if JSON parse fails
            }
          })()
        }));
      } catch (error) {
        console.error('❌ Query documents error:', error);
        throw new Error('Failed to fetch documents');
      }
    }
  },
  Mutation: {
    uploadPdf: async (
      _: any,
      { file }: { file: Promise<FileUpload> },
      { prisma }: { prisma: PrismaClient }
    ) => {
      try {
        const { createReadStream, filename } = await file;
        
        let buffer = await streamToBuffer(createReadStream());
        
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const pdfData = await pdfParse(buffer);
        const extractedText = pdfData.text;
        
        //free memory to avoid OOM
        // @ts-ignore - Intentionally clearing buffer for memory management
        buffer = null as any;

        const structuredInfo = await extractStructuredInfo(extractedText);
        
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
        
        
        const metadata = {
          summary,
          ...structuredInfo
        };
        
        const result = await prisma.extractedDocument.create({
          data: {
            filename,
            rawText: extractedText,
            metadata: JSON.stringify(metadata)
          },
        });
        
        // Return with parsed metadata for GraphQL response
        const resultWithParsedMetadata = {
          ...result,
          metadata: JSON.parse(String(result.metadata || '{}'))
        };
        
        return resultWithParsedMetadata;
      } catch (error) {
        throw new Error('Failed to process PDF. Please ensure it is a valid PDF file.');
      }
    },
    updateResume: async (
      _: any,
      { resume, jobDescription }: { resume: Promise<FileUpload>, jobDescription: string },
      { prisma }: { prisma: PrismaClient }
    ) => {
      console.log('\n🎯 === updateResume MUTATION RESOLVER CALLED ===');
      console.log('📥 Mutation Arguments:', {
        resumeArgument: {
          type: typeof resume,
          isPromise: resume instanceof Promise,
          constructor: resume?.constructor?.name
        },
        jobDescriptionArgument: {
          type: typeof jobDescription,
          length: jobDescription?.length || 0,
          preview: jobDescription?.substring(0, 100) || 'N/A',
          isEmpty: !jobDescription,
          isEmptyAfterTrim: !jobDescription?.trim()
        }
      });
      
      try {
        if (!jobDescription || jobDescription.trim() === '') {
            console.error('❌ Job description validation failed:', { jobDescription });
            throw new Error('Job Description cannot be empty.');
        }

        console.log('⏳ Awaiting file upload promise...');
        const { createReadStream, filename, mimetype } = await resume;
        
        console.log('📁 File Upload Details:', {
          filename,
          mimetype,
          hasCreateReadStream: typeof createReadStream === 'function'
        });
        
        // Validate file type
        if (mimetype !== 'application/pdf') {
            console.error('❌ Invalid file type:', { mimetype, expected: 'application/pdf' });
            throw new Error('Invalid file type. Please upload a PDF file.');
        }
        
        console.log('✅ File type validation passed');
        console.log('📊 Processing resume file...');
        
        const buffer = await streamToBuffer(createReadStream());
        
        console.log('📊 File Buffer Details:', {
          bufferLength: buffer.length,
          bufferType: typeof buffer,
          isBuffer: Buffer.isBuffer(buffer),
          firstFewBytes: buffer.slice(0, 10).toString('hex')
        });
        
        // Validate file size (10MB limit)
        if (buffer.length > 10 * 1024 * 1024) {
            console.error('❌ File too large:', { 
              actualSize: buffer.length, 
              maxSize: 10 * 1024 * 1024,
              sizeMB: (buffer.length / (1024 * 1024)).toFixed(2)
            });
            throw new Error('File too large. Please upload a PDF smaller than 10MB.');
        }
        
        console.log('✅ File size validation passed');

        // Cache short-circuit: reuse previous result for identical input
        const requestKey = computeRequestKey(buffer, jobDescription);
        const cached = getCachedResult(requestKey);
        if (cached) {
          return {
            downloadUrl: cached.downloadUrl,
          };
        }
        
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as any;
        const pdfData = await pdfParse(buffer);
        const resumeText = pdfData.text;

        if (!resumeText || resumeText.trim() === '') {
            throw new Error('Could not extract text from the provided resume PDF.');
        }
        
        // Use intelligent content selection instead of naive truncation
        const originalResumePromise = extractStructuredInfo(resumeText);
        
        const [originalResumeJson] = await Promise.all([
          originalResumePromise,
        ]);

        console.log('✅ Resume parsing completed');
        
        // Use intelligent content selection
        const compactResume = composeForLLM(originalResumeJson, jobDescription, 4000);
        
        console.log('📊 Intelligent content selection completed:', {
          originalLength: JSON.stringify(originalResumeJson).length,
          compactLength: JSON.stringify(compactResume).length,
          experienceCount: compactResume.experience?.length || 0,
          projectsCount: compactResume.projects?.length || 0
        });

        // **STEP 2: Use the AI to update ONLY the experience and projects**
        const systemPrompt = `
# MISSION
You are 'Synapse', a top-tier career strategist. Your only task is to rewrite the "experience" and "projects" sections of a resume to align with a job description, ensuring the final content creates a well-balanced, professional, single-page document.

# RULES
- **One-Page Constraint & Dynamic Content Density:** This is your most important rule. The final resume MUST be concise enough to fit on a single page without large empty spaces or overflowing.
  - **Analyze Content Length:** First, assess the user's original resume content.
  - **For Long Resumes:** If the user has extensive experience (e.g., 3+ jobs, 3+ projects), cut less relevant roles or projects entirely. Limit bullet points to the top 2-3 most impactful ones per entry. Write very concisely.
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

        // Use intelligent content selection in the OpenAI prompt
        console.log('🤖 Starting OpenAI API call with intelligent content...');
        const aiUpdate = await openai.chat.completions.create({
          model: "gpt-3.5-turbo", // Switched to gpt-3.5-turbo for faster response
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `[USER_RESUME_JSON]:\n${JSON.stringify(compactResume, null, 2)}\n\n[JOB_DESCRIPTION_TEXT]:\n${jobDescription}` }
          ],
          response_format: { type: "json_object" },
          max_tokens: 600, // Further reduced for memory efficiency
          temperature: 0.7 // Add some creativity while keeping responses focused
        });
        
        console.log('✅ OpenAI API call completed');
        
        const rawAI = aiUpdate.choices[0].message.content || '{}';
        console.log('📊 AI Response size:', {
          length: rawAI.length,
          preview: rawAI.substring(0, 200)
        });
        
        if (rawAI.length > 300000) { // Further reduced for memory efficiency
          throw new Error('AI response too large to process.');
        }
        
        const aiResult = JSON.parse(rawAI);
        const changeLog = aiResult.StrategicDebrief || 'No changes logged by AI.';
        
        // Clean up large variables to free memory
        // aiUpdate = null; // Let garbage collection handle it
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          console.log('🧹 Garbage collection triggered');
        }
        
        // Log memory usage
        const memUsage = process.memoryUsage();
        console.log('📊 Memory usage:', {
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
        });
        
        // **STEP 3: Merge original data with AI-updated sections**
        const finalResumeJson = {
            ...originalResumeJson, // Keep original contact, education, skills, etc.
            experience: aiResult.experience || originalResumeJson.experience, // Use AI version, fallback to original
            projects: aiResult.projects || originalResumeJson.projects, // Use AI version, fallback to original
        };
        if (Object.keys(finalResumeJson).length > 1000) {
          throw new Error('Resume data too large to process.');
        }
        
        const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 10000);
        const pdfFilename = `updated-resume-${uniqueId}.pdf`;
        const pdfPath = path.join(downloadsDir, pdfFilename);
        
        
        // **STEP 4: Generate the new PDF using the merged data**
        await generateResumePdf(finalResumeJson, pdfPath);
        
        if (!fs.existsSync(pdfPath)) {
          throw new Error('PDF file was not created successfully.');
        }

        const port = parseInt(process.env.PORT || '8080', 10);
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://profilebuilder-backend-xx3otar6ca-uc.a.run.app'
          : `http://localhost:${port}`;
        const downloadUrl = `${baseUrl}/downloads/${pdfFilename}`;

        // Store in cache for subsequent identical requests
        setCachedResult(requestKey, {
          downloadUrl,
          pdfPath,
        });

        return {
          downloadUrl,
          changes: changeLog,
          updatedResumeJson: finalResumeJson // Return the complete, merged resume
        };
      } catch (error) {
        console.error('❌ updateResume mutation error:', {
          error: error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        
        if (error instanceof Error) {
            throw new Error(`Failed to update resume: ${error.message}`);
        }
        throw new Error('An unknown error occurred while updating the resume.');
      }
    },
  },
};

async function start() {
  console.log('🚀 Starting Apollo Server...');
  
  // Test database connection first
  try {
    console.log('🔍 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (dbError) {
    console.error('❌ Database connection failed:', dbError);
    console.log('⚠️ Continuing without database for basic health check...');
  }
  
  const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    // Add some debugging options
    introspection: true,
    // Disable CSRF protection for file uploads - they're already validated by our middleware
    csrfPrevention: false,
    formatError: (err) => {
      console.error('🚨 GraphQL Error:', {
        message: err.message,
        locations: err.locations,
        path: err.path,
        extensions: err.extensions,
        stack: (err as any).stack
      });
      return {
        message: err.message,
        locations: err.locations,
        path: err.path,
        extensions: {
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        }
      };
    }
  });
  
  console.log('⏳ Apollo Server starting...');
  await server.start();
  console.log('✅ Apollo Server started successfully');

  const app = express();
  
  const allowedOrigins = [
    'http://localhost:5173',
    'https://studio.apollographql.com',
    'https://resumepersonalizer.web.app',
    'https://resumepersonalizer.firebaseapp.com',
    process.env.FRONTEND_URL
  ].filter(Boolean) as string[];

  app.use(cors({ 
    origin: allowedOrigins,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'apollo-require-preflight',
      'x-apollo-operation-name',
      'Accept',
      'Origin',
      'X-Requested-With'
    ],
    credentials: false
  }));

  app.use('/downloads', express.static(downloadsDir));

  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Health check with database status
  app.get('/health', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Health check database error:', error);
      res.status(500).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Add a test endpoint to verify request processing
  app.post('/test-upload', (req, res) => {
    console.log('🧪 Test endpoint called:', {
      method: req.method,
      contentType: req.get('content-type'),
      contentLength: req.get('content-length'),
      hasBody: !!req.body,
      bodyType: typeof req.body
    });
    res.json({ status: 'ok', message: 'Test endpoint working' });
  });

  app.use('/graphql', graphqlUploadExpress({ 
    maxFileSize: 10_000_000,
    maxFiles: 1
  }));
  
  // Add JSON middleware for regular GraphQL queries (but not for file uploads)
  app.use('/graphql', (req, res, next) => {
    // Only apply JSON parsing for non-multipart requests
    if (!req.get('content-type')?.includes('multipart/form-data')) {
      express.json({ limit: '50mb' })(req, res, next);
    } else {
      next();
    }
  });

  // Add request logging middleware before GraphQL
  app.use('/graphql', (req, res, next) => {
    console.log('\n🔍 === INCOMING GRAPHQL REQUEST ===');
    console.log('📋 Request Details:', {
      method: req.method,
      url: req.url,
      contentType: req.get('content-type'),
      contentLength: req.get('content-length'),
      userAgent: req.get('user-agent'),
      origin: req.get('origin'),
      headers: Object.keys(req.headers).reduce((acc, key) => {
        // Log most headers but hide sensitive ones
        if (!key.toLowerCase().includes('authorization') && !key.toLowerCase().includes('cookie')) {
          acc[key] = req.headers[key];
        }
        return acc;
      }, {} as any)
    });
    
    if (req.body) {
      console.log('📦 Request Body Type:', typeof req.body);
      if (typeof req.body === 'object') {
        console.log('📦 Request Body Keys:', Object.keys(req.body));
        if (req.body.query) {
          console.log('📝 GraphQL Query:', req.body.query.substring(0, 200) + '...');
        }
        if (req.body.variables) {
          console.log('🔧 GraphQL Variables:', {
            variableKeys: Object.keys(req.body.variables),
            hasResume: 'resume' in req.body.variables,
            hasJobDescription: 'jobDescription' in req.body.variables,
            jobDescriptionLength: req.body.variables.jobDescription?.length || 0
          });
        }
      }
    }
    
    next();
  });
  
  app.use(
    '/graphql',
    expressMiddleware(server, { 
      context: async () => ({ prisma })
    })
  );

  const port = parseInt(process.env.PORT || '8080', 10);
  
  const httpServer = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔍 GraphQL playground: http://localhost:${port}/graphql`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      console.log('Process terminated');
    });
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process, just log the error
});

process.on('uncaughtException', (err, origin) => {
  console.error('Uncaught Exception:', err, 'Origin:', origin);
  // Don't exit process, just log the error
});

// Start server with better error handling
start().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
