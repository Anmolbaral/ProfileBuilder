// server/src/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { graphqlUploadExpress, GraphQLUpload } from 'graphql-upload';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
dotenv.config();
const app = express();
const prisma = new PrismaClient();
// Grab __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Read your GraphQL SDL
const typeDefs = readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');
// Turn streams into buffers
async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}
const resolvers = {
    // hook up the Upload scalar
    Upload: GraphQLUpload,
    Query: {
        documents: () => prisma.extractedDocument.findMany(),
    },
    Mutation: {
        uploadPdf: async (_, { file }) => {
            const { createReadStream, filename } = await file;
            const buffer = await streamToBuffer(createReadStream());
            const { text } = await pdf(buffer);
            return prisma.extractedDocument.create({
                data: { filename, rawText: text, metadata: {} },
            });
        },
    },
};
async function start() {
    try {
        const server = new ApolloServer({
            typeDefs,
            resolvers,
            // (optional) landing‐page plugin:
        });
        await server.start();
        // 🚨 1) upload middleware must come *before* express.json()
        app.use('/graphql', graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 1 }));
        // 2) CORS + body‐parsing
        app.use('/graphql', cors());
        app.use('/graphql', express.json({ limit: '50mb' }));
        app.use('/graphql', express.urlencoded({ extended: true }));
        // 3) finally mount Apollo
        app.use('/graphql', expressMiddleware(server, {
            context: async ({ req }) => ({ prisma, req }),
        }));
        app.listen(4000, () => {
            console.log(`🚀 Server ready at http://localhost:4000/graphql`);
        });
    }
    catch (err) {
        console.error('Error during server startup:');
        console.error(err);
        if (typeof err === 'object' && err !== null) {
            console.error('Error keys:', Object.keys(err));
            try {
                console.error('Error as JSON:', JSON.stringify(err, null, 2));
            }
            catch (jsonErr) {
                console.error('Error could not be stringified:', jsonErr);
            }
        }
    }
}
start().catch((err) => {
    console.error('Server failed to start:');
    console.error(err);
    if (typeof err === 'object' && err !== null) {
        console.error('Error keys:', Object.keys(err));
        try {
            console.error('Error as JSON:', JSON.stringify(err, null, 2));
        }
        catch (jsonErr) {
            console.error('Error could not be stringified:', jsonErr);
        }
    }
});
