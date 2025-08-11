# COMPREHENSIVE PDF EXTRACTOR FIX

## 🎯 **Root Cause Analysis**

The 400 Bad Request error is caused by multiple configuration mismatches:

1. **CSRF Protection**: Apollo Server v4 blocks multipart/form-data by default
2. **CORS Headers**: Missing allowedHeaders for Apollo-specific headers
3. **Database Mismatch**: Schema expects PostgreSQL but code uses SQLite
4. **Middleware Order**: GraphQL upload middleware conflicts
5. **Schema Inconsistency**: Client-server GraphQL schema mismatch

## 🔧 **Complete Fix Implementation**

### **1. Server Configuration Fix (server/src/server.ts)**

```typescript
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load GraphQL schema
const typeDefs = readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');

// Apollo Server with CSRF disabled and proper error handling
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  csrfPrevention: false, // Disable CSRF for file uploads
  formatError: (err) => {
    console.error('GraphQL Error:', {
      message: err.message,
      path: err.path,
      locations: err.locations
    });
    return err;
  }
});

async function startServer() {
  await server.start();
  
  const app = express();
  
  // CORS configuration with all required headers
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://anmolbaral.github.io',
      process.env.FRONTEND_URL
    ].filter(Boolean),
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
  
  // Static file serving for downloads
  app.use('/downloads', express.static(path.join(__dirname, '../downloads')));
  
  // Health check endpoint
  app.get('/', (req, res) => res.send('Server healthy'));
  
  // GraphQL upload middleware (MUST come before GraphQL endpoint)
  app.use('/graphql', graphqlUploadExpress({
    maxFileSize: 10_000_000, // 10MB
    maxFiles: 1
  }));
  
  // GraphQL endpoint
  app.use('/graphql', expressMiddleware(server, {
    context: async () => ({ prisma })
  }));
  
  const port = parseInt(process.env.PORT || '8080', 10);
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server ready at http://localhost:${port}/graphql`);
  });
}

startServer().catch(console.error);
```

### **2. Database Configuration Fix (server/prisma/schema.prisma)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model ExtractedDocument {
  id        String   @id @default(uuid())
  filename  String
  rawText   String
  metadata  String   // Changed from Json to String for SQLite compatibility
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
}
```

### **3. Apollo Client Configuration Fix (app/src/apollo.ts)**

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { createUploadLink } from 'apollo-upload-client';

const GRAPHQL_URL = 'https://profilebuilder-uejc.onrender.com/graphql';

const uploadLink = createUploadLink({
  uri: GRAPHQL_URL,
  headers: {
    // Minimal headers - CSRF is disabled on server
  },
  fetchOptions: {
    mode: 'cors',
    credentials: 'omit',
  },
});

export const client = new ApolloClient({
  link: uploadLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    mutate: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all'
    }
  }
});
```

### **4. GraphQL Schema Alignment (server/src/schema.graphql)**

```graphql
scalar DateTime
scalar JSON
scalar Upload

type ExtractedDocument {
  id: ID!
  filename: String!
  rawText: String!
  metadata: JSON!
  createdAt: DateTime!
}

type UpdatedResumeResult {
  downloadUrl: String!
  summary: String
  changes: JSON
  updatedResumeJson: JSON
}

type Query {
  documents: [ExtractedDocument!]!
}

type Mutation {
  uploadPdf(file: Upload!): ExtractedDocument!
  updateResume(resume: Upload!, jobDescription: String!): UpdatedResumeResult!
}
```

### **5. Resolver Implementation (server/src/server.ts - resolvers section)**

```typescript
const resolvers = {
  Upload: GraphQLUpload,
  
  Query: {
    documents: async (_, __, { prisma }) => {
      return await prisma.extractedDocument.findMany({
        orderBy: { createdAt: 'desc' }
      });
    }
  },
  
  Mutation: {
    uploadPdf: async (_, { file }, { prisma }) => {
      try {
        const { createReadStream, filename } = await file;
        const buffer = await streamToBuffer(createReadStream());
        
        // PDF parsing and processing logic here
        const pdfData = await pdfParse(buffer);
        const structuredInfo = await extractStructuredInfo(pdfData.text);
        
        const result = await prisma.extractedDocument.create({
          data: {
            filename,
            rawText: pdfData.text,
            metadata: JSON.stringify(structuredInfo)
          }
        });
        
        return {
          ...result,
          metadata: JSON.parse(result.metadata)
        };
      } catch (error) {
        throw new Error(`Failed to process PDF: ${error.message}`);
      }
    },
    
    updateResume: async (_, { resume, jobDescription }, { prisma }) => {
      try {
        if (!jobDescription?.trim()) {
          throw new Error('Job description is required');
        }
        
        const { createReadStream, filename, mimetype } = await resume;
        
        if (mimetype !== 'application/pdf') {
          throw new Error('Only PDF files are allowed');
        }
        
        const buffer = await streamToBuffer(createReadStream());
        
        if (buffer.length > 10 * 1024 * 1024) {
          throw new Error('File too large (max 10MB)');
        }
        
        // PDF processing and AI optimization logic
        const pdfData = await pdfParse(buffer);
        const originalResume = await extractStructuredInfo(pdfData.text);
        
        // AI resume optimization
        const optimizedResume = await optimizeResumeWithAI(originalResume, jobDescription);
        
        // Generate PDF
        const pdfFilename = `updated-resume-${Date.now()}-${Math.random().toString(36).substr(2, 4)}.pdf`;
        const pdfPath = path.join(__dirname, '../downloads', pdfFilename);
        
        await generateResumePdf(optimizedResume, pdfPath);
        
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://profilebuilder-uejc.onrender.com'
          : `http://localhost:${process.env.PORT || 8080}`;
        
        return {
          downloadUrl: `${baseUrl}/downloads/${pdfFilename}`,
          summary: 'Resume optimized successfully',
          changes: optimizedResume.changes,
          updatedResumeJson: optimizedResume
        };
        
      } catch (error) {
        throw new Error(`Failed to update resume: ${error.message}`);
      }
    }
  }
};
```

### **6. Environment Configuration (.env)**

```env
# Database
DATABASE_URL="file:./dev.db"

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Server
NODE_ENV=production
PORT=8080

# Frontend URL for CORS
FRONTEND_URL=https://anmolbaral.github.io
```

### **7. Deployment Configuration (render.yaml)**

```yaml
services:
  - type: web
    name: pdf-extractor-server
    runtime: docker
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 8080
      - key: OPENAI_API_KEY
        sync: false
    buildCommand: cd server && npm install && npm run build
    startCommand: cd server && npm start
```

### **8. Package.json Scripts Update (server/package.json)**

```json
{
  "scripts": {
    "build": "tsc && cp src/schema.graphql dist/",
    "start": "node --experimental-specifier-resolution=node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "postinstall": "prisma generate"
  }
}
```

## 🚀 **Deployment Steps**

1. **Update Environment Variables**:
   ```bash
   # Add to Render dashboard environment variables
   OPENAI_API_KEY=your_key_here
   NODE_ENV=production
   PORT=8080
   ```

2. **Database Migration**:
   ```bash
   cd server
   npx prisma migrate reset --force
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **Build and Deploy**:
   ```bash
   git add .
   git commit -m "fix: Complete PDF extractor configuration fix"
   git push origin main
   ```

## ✅ **Expected Results**

After deployment:
- ✅ File uploads work without CSRF errors
- ✅ CORS headers allow all Apollo GraphQL requests
- ✅ Database operations work with SQLite
- ✅ PDF processing and AI optimization function
- ✅ Download URLs are correctly generated
- ✅ Error handling provides clear feedback

## 🔍 **Testing Commands**

```bash
# Test GraphQL endpoint
curl -X POST https://profilebuilder-uejc.onrender.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __typename }"}'

# Test file upload (multipart)
curl -X POST https://profilebuilder-uejc.onrender.com/graphql \
  -H "apollo-require-preflight: true" \
  -F 'operations={"query": "query { __typename }", "variables": {}}' \
  -F 'map={}' 
```

This comprehensive fix addresses all identified issues and should resolve the 400 Bad Request error completely.
