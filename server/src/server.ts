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
import GraphQLJSON from 'graphql-type-json';
import { PrismaClient } from '@prisma/client';
// @ts-ignore - PDFKit has some type inconsistencies with modules
import PDFKitDocument from 'pdfkit';
import fs from 'fs';
import crypto from 'node:crypto';
import { 
  savePlan, 
  getPlan, 
  newPlanId, 
  getPlanStats 
} from './utils/planStore.js';
import { 
  generateOptimizationPlan, 
  calculateFitMetrics, 
  applyUserDecisions, 
  generateBulletSuggestions
} from './utils/optimization.js';
import { stableId } from './utils/planStore.js';

// Define a type for the file upload promise
interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

dotenv.config();

// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

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

// Helper to parse PDF
async function parsePdf(buffer: Buffer): Promise<any> {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as any;
  return await pdfParse(buffer);
}

/**
 * Conservative PDF text normalizer.
 * Keeps bullets + section boundaries intact.
 */
function normalizePdfText(rawText: string): string {
  let s = (rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '');

  // common ligatures
  s = s.replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl');

  // protect paragraph breaks
  s = s.replace(/\n{2,}/g, '⏎⏎');

  // hyphenated wraps + soft wraps
  s = s.replace(/([A-Za-z0-9])-\n(?=[a-z0-9])/g, '$1');
  s = s.replace(/([A-Za-z0-9])\n(?=[a-z0-9])/g, '$1');

  // fold remaining newlines
  s = s.replace(/\n/g, ' ');

  // restore paragraphs
  s = s.replace(/⏎⏎/g, '\n\n');

  // normalize bullets and dashes
  s = s
    .replace(/[•●▪◦·]/g, '•')
    .replace(/(^|\n)\s*[-–—]\s+/g, '\n• ')
    .replace(/(?:^|\n)\s*•\s*/g, '\n• ');

  // collapse extra blanks
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// Helper to generate section improvement suggestions
async function generateSectionSuggestions(
  sectionType: string,
  currentContent: any,
  jdText: string,
  improvementType: string
): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: `You are a resume optimization expert. Analyze the current content and suggest improvements based on the job description and improvement type. Return a JSON object with original content, suggested improvements, and detailed changes.`
        },
        {
          role: "user",
          content: `Section Type: ${sectionType}
Improvement Type: ${improvementType}
Current Content: ${JSON.stringify(currentContent, null, 2)}
Job Description: ${jdText}

Generate improvements and return as JSON with:
- original: current content
- suggested: improved content
- changes: array of change details with type, field, oldValue, newValue, impact
- reasoning: explanation of improvements`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.3
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      original: currentContent,
      suggested: result.suggested || currentContent,
      changes: result.changes || [],
      reasoning: result.reasoning || 'No specific improvements suggested.'
    };
  } catch (error) {
    console.error('Failed to generate section suggestions:', error);
    return {
      original: currentContent,
      suggested: currentContent,
      changes: [],
      reasoning: 'Unable to generate suggestions at this time.'
    };
  }
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
        const timeout = setTimeout(() => {
            reject(new Error('PDF generation timed out after 30 seconds'));
        }, 30000);

        writeStream.on('finish', () => {
            clearTimeout(timeout);
            resolve();
        });
        writeStream.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

// Lightweight in-memory LRU cache for results to reduce repeat work
const RESULT_CACHE_MAX_ENTRIES = 50;
type CachedResult = {
  downloadUrl: string;
  changes: string;
  updatedResumeJson: any;
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
  if (!fs.existsSync(cached.pdfPath)) {
    resultCache.delete(key);
    return null;
  }
  // touch
  resultCache.delete(key);
  resultCache.set(key, cached);
  return cached;
}

function setCachedResult(key: string, value: CachedResult) {
  if (resultCache.has(key)) resultCache.delete(key);
  resultCache.set(key, value);
  if (resultCache.size > RESULT_CACHE_MAX_ENTRIES) {
    const oldestKey = resultCache.keys().next().value as string | undefined;
    if (oldestKey) resultCache.delete(oldestKey);
  }
}

const resolvers = {
  Upload: GraphQLUpload,
  JSON: GraphQLJSON,
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
        
        const pdfData = await parsePdf(buffer);
        const extractedText = pdfData.text;
        
        //free memory to avoid OOM
        // @ts-ignore - Intentionally clearing buffer for memory management
        buffer = null as any;

        const normalized = normalizePdfText(extractedText);
        const structuredInfo = await extractStructuredInfo(normalized);
        
        const openaiResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
              content: "You are a document analysis assistant. Provide a concise summary of the document, highlighting key points."
            },
        { 
          role: "user", 
              content: `Analyze this document:\n\n${normalized}`
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
            changes: cached.changes,
            updatedResumeJson: cached.updatedResumeJson,
          };
        }
        
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as any;
        const pdfData = await pdfParse(buffer);
        const resumeText = pdfData.text;

        if (!resumeText || resumeText.trim() === '') {
          throw new Error('Could not extract text from the provided resume PDF.');
        }
        
        // Normalize PDF text before parsing
        const normalizedText = normalizePdfText(resumeText);
        const originalResumeJson = await extractStructuredInfo(normalizedText);

        console.log('✅ Resume parsing completed');
        
        console.log('📊 Resume data prepared for AI:', {
          originalLength: JSON.stringify(originalResumeJson).length,
          experienceCount: originalResumeJson.experience?.length || 0,
          projectsCount: originalResumeJson.projects?.length || 0
        });

        // **STEP 2: Use the AI to update ONLY the experience and projects**
        const systemPrompt = `
# MISSION
You are 'Synapse', a top-tier career strategist. Your task is to rewrite the "experience" and "projects" sections of a resume to align with a job description, optimizing for relevance and impact while preserving all valuable content.

# RULES
- **Preserve All Content:** Keep all relevant experience and projects. Only remove content that is clearly irrelevant to the target position.
- **Focus:** ONLY output the \`experience\` and \`projects\` keys. Do not output any other resume sections.
- **Impact Statements:** Rewrite every bullet point to be a quantifiable impact statement (use the STAR method). Use the word "and" instead of "&".
- **Structure:** The final output MUST be a single, valid JSON object starting with \`{\` and ending with \`}\`.
  - \`experience\` MUST be an array of objects: \`[{"company": "...", "position": "...", "duration": "...", "location": "...", "impactBullets": ["..."]}]\`.
  - \`projects\` MUST be an array of objects: \`[{"projectName": "...", "techStack": "...", "impactBullets": ["..."]}]\`.
  - The \`impactBullets\` key is mandatory and must be an array of strings.
- **Optimization:** Prioritize content that directly relates to the job requirements while maintaining comprehensive coverage of the candidate's background.

# REQUIRED OUTPUT FORMAT
Your response MUST be a JSON object with this exact structure:
{
  "experience": [...],
  "projects": [...],
  "StrategicDebrief": "A detailed explanation of what changes you made and why, including specific improvements to impact statements, relevance optimization, and any content that was enhanced or restructured."
}

# STRATEGIC DEBRIEF REQUIREMENTS
The StrategicDebrief field MUST include:
1. **Summary of Changes:** What sections were modified and why
2. **Impact Improvements:** How bullet points were enhanced with quantifiable metrics
3. **Relevance Optimization:** How content was aligned with the job description
4. **Content Preservation:** What valuable content was maintained
5. **Specific Examples:** Mention 2-3 specific improvements made
`;

        // Use full resume data in the OpenAI prompt
        console.log('🤖 Starting OpenAI API call with full resume data...');
        const aiUpdate = await openai.chat.completions.create({
          model: "gpt-3.5-turbo", // Switched to gpt-3.5-turbo for faster response
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `[USER_RESUME_JSON]:\n${JSON.stringify(originalResumeJson, null, 2)}\n\n[JOB_DESCRIPTION_TEXT]:\n${jobDescription}` }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1500, // Increased for full data processing
          temperature: 0.7 // Add some creativity while keeping responses focused
        });
        
        console.log('✅ OpenAI API call completed');
        
        const rawAI = aiUpdate.choices[0].message.content || '{}';
        console.log('📊 AI Response size:', {
          length: rawAI.length,
          preview: rawAI.substring(0, 200)
        });
        
        console.log('🔍 Full AI Response for debugging:', rawAI);
        
        if (rawAI.length > 300000) { // Further reduced for memory efficiency
          throw new Error('AI response too large to process.');
        }
        
        const aiResult = JSON.parse(rawAI);
        
        // Generate a comprehensive change log with fallback
        let changeLog = aiResult.StrategicDebrief;
        if (!changeLog || changeLog.trim() === '') {
          // Create a fallback debrief based on what we can observe
          const originalExpCount = originalResumeJson.experience?.length || 0;
          const originalProjCount = originalResumeJson.projects?.length || 0;
          const aiExpCount = aiResult.experience?.length || 0;
          const aiProjCount = aiResult.projects?.length || 0;
          
          const changes = [];
          if (aiExpCount > 0) changes.push(`Enhanced ${aiExpCount} experience entries with quantifiable impact statements`);
          if (aiProjCount > 0) changes.push(`Optimized ${aiProjCount} projects with improved descriptions and tech stack details`);
          
          changeLog = changes.length > 0 
            ? `AI Optimization Summary: ${changes.join(' and ')}. All content has been restructured to use the STAR method with specific metrics and achievements.`
            : 'AI Optimization Summary: Resume content has been analyzed and optimized for better impact and relevance to the target position.';
        }
        
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

        // **STEP 4: Calculate missing keywords for the main response**
        console.log('🔍 Calculating missing keywords...');
        
        // Extract keywords from job description
        const extractSkillsFromJD = (jd: string): string[] => {
          const commonSkills = [
            'javascript', 'python', 'java', 'react', 'node.js', 'sql', 'aws', 'docker',
            'kubernetes', 'git', 'html', 'css', 'api', 'rest', 'graphql', 'mongodb',
            'postgresql', 'redis', 'kafka', 'elasticsearch', 'jenkins', 'ci/cd',
            'agile', 'scrum', 'tdd', 'bdd', 'microservices', 'serverless', 'typescript',
            'vue', 'angular', 'next.js', 'express', 'fastapi', 'django', 'spring',
            'terraform', 'ansible', 'jenkins', 'gitlab', 'github', 'jira', 'confluence'
          ];
          
          const jdLower = jd.toLowerCase();
          return commonSkills.filter(skill => jdLower.includes(skill));
        };
        
        // Extract keywords from resume
        const resumeKeywords = new Set<string>();
        const allText = JSON.stringify(finalResumeJson).toLowerCase();
        
        // Add skills from resume
        if (finalResumeJson.skills) {
          const skills = Array.isArray(finalResumeJson.skills) ? finalResumeJson.skills : 
            Object.values(finalResumeJson.skills).flat();
          skills.forEach((skill: string) => resumeKeywords.add(skill.toLowerCase()));
        }
        
        // Add keywords from experience and project bullets
        [...(finalResumeJson.experience || []), ...(finalResumeJson.projects || [])].forEach((item: any) => {
          if (item.impactBullets) {
            item.impactBullets.forEach((bullet: string) => {
              const words = bullet.toLowerCase().match(/\b\w+\b/g) || [];
              words.forEach((word: string) => {
                if (word.length > 3) resumeKeywords.add(word);
              });
            });
          }
        });
        
        const jdKeywords = extractSkillsFromJD(jobDescription);
        const missingKeywords = jdKeywords.filter(keyword => !resumeKeywords.has(keyword));
        
        console.log('🔍 Missing keywords found:', missingKeywords);
        
        // const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 10000);
        // const pdfFilename = `updated-resume-${uniqueId}.pdf`;
        // const pdfPath = path.join(downloadsDir, pdfFilename);
        
        
        // **STEP 4: Generate the new PDF using the merged data**
        // TEMPORARILY DISABLED: PDF generation for testing other features
        console.log('📄 PDF generation temporarily disabled for testing');
        
        // const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 10000);
        // const pdfFilename = `updated-resume-${uniqueId}.pdf`;
        // const pdfPath = path.join(downloadsDir, pdfFilename);
        
        // console.log('📄 Starting PDF generation...');
        // console.log('📄 PDF path:', pdfPath);
        // console.log('📄 Resume data keys:', Object.keys(finalResumeJson));
        
        // try {
        //   await generateResumePdf(finalResumeJson, pdfPath);
        //   console.log('✅ PDF generation completed successfully');
        // } catch (pdfError) {
        //   console.error('❌ PDF generation failed:', pdfError);
        //   throw new Error(`PDF generation failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
        // }
        
        // if (!fs.existsSync(pdfPath)) {
        //   throw new Error('PDF file was not created successfully.');
        // }

        // const port = parseInt(process.env.PORT || '8080', 10);
        // const baseUrl = process.env.NODE_ENV === 'production' 
        //   ? 'https://profilebuilder-backend-xx3otar6ca-uc.a.run.app'
        //   : `http://localhost:${port}`;
        // const downloadUrl = `${baseUrl}/downloads/${pdfFilename}`;
        
        // Create a mock download URL for now
        const downloadUrl = `/downloads/mock-resume-${Date.now()}.pdf`;

        const resultForClient = {
          downloadUrl,
          changes: changeLog,
          updatedResumeJson: finalResumeJson, // full for the first response
          missingKeywords, // Add missing keywords to the response
        };

        // Trim heavy fields for cache to keep memory headroom
        const cachedResumeJson = {
          contactInfo: finalResumeJson.contactInfo,
          education: (finalResumeJson.education || []).slice(0, 1),
          skills: finalResumeJson.skills,
          experience: (finalResumeJson.experience || []).slice(0, 3),
          projects: (finalResumeJson.projects || []).slice(0, 2),
        };

        // Store in cache for subsequent identical requests
        // TEMPORARILY DISABLED: Cache storage since PDF generation is disabled
        // setCachedResult(requestKey, {
        //   downloadUrl,
        //   changes: changeLog,
        //   updatedResumeJson: cachedResumeJson,
        //   pdfPath: '', // No PDF path since generation is disabled
        // });

        return resultForClient;
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

    // New interactive optimization mutations
    createOptimizationPlan: async (
      _: any,
      { resume, jobDescription, companyName }: { resume: Promise<FileUpload>; jobDescription: string; companyName?: string }
    ) => {
      console.log('🎯 === createOptimizationPlan MUTATION CALLED ===');
      
      try {
        // Parse resume (reuse existing logic)
        const { createReadStream } = await resume;
        const buffer = await streamToBuffer(createReadStream());
        
        const pdfData = await parsePdf(buffer);
        const normalizedText = normalizePdfText(pdfData.text);
        const originalResumeJson = await extractStructuredInfo(normalizedText);
        
        // Generate plan with scoring (including company research)
        const plan = await generateOptimizationPlan(originalResumeJson, jobDescription, companyName);
        const fit = await calculateFitMetrics(plan, jobDescription);
        
        // Store plan
        const planId = newPlanId();
        savePlan(planId, {
          plan: { ...plan, id: planId },
          fit,
          createdAt: Date.now(),
          originalResumeJson
        });
        
        console.log('✅ Optimization plan created:', {
          planId,
          rolesCount: plan.roles.length,
          projectsCount: plan.projects.length,
          overallScore: fit.overallScore
        });

        return {
          plan: { ...plan, id: planId },
          fit
        };
      } catch (error) {
        console.error('❌ createOptimizationPlan error:', error);
        throw new Error(`Failed to create optimization plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    applyDecisions: async (
      _: any,
      { planId, roleDecisions, projectDecisions, jdText }: {
        planId: string;
        roleDecisions: any[];
        projectDecisions: any[];
        jdText: string;
      }
    ) => {
      console.log('🔄 === applyDecisions MUTATION CALLED ===');
      
      try {
        const planBlob = getPlan(planId);
        if (!planBlob) {
          throw new Error('Plan expired or not found. Please re-upload your resume.');
        }
        
        const updatedResumeJson = await applyUserDecisions(
          planBlob.originalResumeJson,
          planBlob.plan,
          roleDecisions,
          projectDecisions
        );
        
        const newFit = await calculateFitMetrics(planBlob.plan, jdText);
        
        console.log('✅ Decisions applied successfully:', {
          planId,
          roleDecisionsCount: roleDecisions.length,
          projectDecisionsCount: projectDecisions.length,
          newOverallScore: newFit.overallScore
        });

        return {
          updatedResumeJson,
          fit: newFit
        };
      } catch (error) {
        console.error('❌ applyDecisions error:', error);
        throw new Error(`Failed to apply decisions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    suggestBulletEdits: async (
      _: any,
      { planId, bulletId, currentText, jdText, mustInclude }: {
        planId: string;
        bulletId: string;
        currentText: string;
        jdText: string;
        mustInclude: string[];
      }
    ) => {
      console.log('💡 === suggestBulletEdits MUTATION CALLED ===');
      
      try {
        const planBlob = getPlan(planId);
        if (!planBlob) {
          throw new Error('Plan expired or not found. Please re-upload your resume.');
        }
        
        const suggestions = await generateBulletSuggestions(
          currentText,
          jdText,
          mustInclude
        );
        
        console.log('✅ Bullet suggestions generated:', {
          planId,
          bulletId,
          suggestionsCount: suggestions.length
        });
        
        return suggestions;
      } catch (error) {
        console.error('❌ suggestBulletEdits error:', error);
        throw new Error(`Failed to generate bullet suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Enhanced Interactive Studio mutations
    updateSection: async (
      _: any,
      { planId, sectionType, sectionId, updatedContent, jdText }: {
        planId: string;
        sectionType: string;
        sectionId: string;
        updatedContent: any;
        jdText: string;
      }
    ) => {
      console.log('🔄 === updateSection MUTATION CALLED ===');
      
      try {
        const planBlob = getPlan(planId);
        if (!planBlob) {
          throw new Error('Plan expired or not found. Please re-upload your resume.');
        }
        
        // Update the resume JSON with the new section content
        const updatedResumeJson = { ...planBlob.originalResumeJson };
        
        if (sectionType === 'experience') {
          const expIndex = updatedResumeJson.experience?.findIndex((exp: any) => 
            stableId([exp.company || '', exp.position || '', exp.duration || '']) === sectionId
          );
          if (expIndex !== -1) {
            updatedResumeJson.experience[expIndex] = { ...updatedResumeJson.experience[expIndex], ...updatedContent };
          }
        } else if (sectionType === 'project') {
          const projIndex = updatedResumeJson.projects?.findIndex((proj: any) => 
            stableId([proj.projectName || '', proj.techStack || '']) === sectionId
          );
          if (projIndex !== -1) {
            updatedResumeJson.projects[projIndex] = { ...updatedResumeJson.projects[projIndex], ...updatedContent };
          }
        } else if (sectionType === 'skills') {
          updatedResumeJson.skills = updatedContent;
        }
        
        // Recalculate scores with updated content
        const newPlan = await generateOptimizationPlan(updatedResumeJson, jdText);
        const newScores = await calculateFitMetrics(newPlan, jdText);
        
        // Update the stored plan
        savePlan(planId, {
          ...planBlob,
          originalResumeJson: updatedResumeJson,
          plan: newPlan,
          fit: newScores
        });
        
        console.log('✅ Section updated successfully:', {
          planId,
          sectionType,
          sectionId,
          newOverallScore: newScores.overallScore
        });
        
        return {
          success: true,
          updatedResumeJson,
          newScores: {
            overallScore: newScores.overallScore,
            experienceMatch: newScores.experienceMatch,
            projectMatch: newScores.projectMatch,
            skillCoverage: newScores.skillCoverage,
            keywordCoverage: newScores.skillCoverage, // Using skill coverage as keyword coverage
            impactScore: 0.8 // Placeholder - would need to calculate from bullets
          }
        };
      } catch (error) {
        console.error('❌ updateSection error:', error);
        throw new Error(`Failed to update section: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    recalculateScores: async (
      _: any,
      { planId, updatedResumeJson, jdText }: {
        planId: string;
        updatedResumeJson: any;
        jdText: string;
      }
    ) => {
      console.log('📊 === recalculateScores MUTATION CALLED ===');
      
      try {
        const planBlob = getPlan(planId);
        if (!planBlob) {
          throw new Error('Plan expired or not found. Please re-upload your resume.');
        }
        
        // Recalculate scores with updated resume JSON
        const newPlan = await generateOptimizationPlan(updatedResumeJson, jdText);
        const newScores = await calculateFitMetrics(newPlan, jdText);
        
        console.log('✅ Scores recalculated:', {
          planId,
          newOverallScore: newScores.overallScore
        });
        
        return {
          overallScore: newScores.overallScore,
          experienceMatch: newScores.experienceMatch,
          projectMatch: newScores.projectMatch,
          skillCoverage: newScores.skillCoverage,
          keywordCoverage: newScores.skillCoverage,
          impactScore: 0.8 // Placeholder
        };
      } catch (error) {
        console.error('❌ recalculateScores error:', error);
        throw new Error(`Failed to recalculate scores: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    suggestSectionImprovement: async (
      _: any,
      { planId, sectionType, sectionId, currentContent, jdText, improvementType }: {
        planId: string;
        sectionType: string;
        sectionId: string;
        currentContent: any;
        jdText: string;
        improvementType: string;
      }
    ) => {
      console.log('💡 === suggestSectionImprovement MUTATION CALLED ===');
      
      try {
        const planBlob = getPlan(planId);
        if (!planBlob) {
          throw new Error('Plan expired or not found. Please re-upload your resume.');
        }
        
        // Generate AI suggestions based on improvement type
        const suggestions = await generateSectionSuggestions(
          sectionType,
          currentContent,
          jdText,
          improvementType
        );
        
        console.log('✅ Section improvement suggestions generated:', {
          planId,
          sectionType,
          sectionId,
          improvementType,
          suggestionsCount: suggestions.changes.length
        });
        
        return suggestions;
      } catch (error) {
        console.error('❌ suggestSectionImprovement error:', error);
        throw new Error(`Failed to generate section suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Only parse JSON when it's NOT a multipart (uploads) request
  app.use('/graphql', (req, res, next) => {
    const ct = req.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) {
      return express.json({ limit: '50mb' })(req, res, next);
    }
    next();
  });

  // MUST come before expressMiddleware(server)
  app.use('/graphql', graphqlUploadExpress({ 
    maxFileSize: 10_000_000,
    maxFiles: 1
  }));
  
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
  
  // Now Apollo
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
