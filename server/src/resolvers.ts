import { GraphQLUpload } from 'graphql-upload-minimal';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const resolvers = {
  Upload: GraphQLUpload,
  
  Query: {
    // Removed getCareerAnalysis
  },
  
  Mutation: {
    // Removed uploadCareerAnalysis and updateCareerAnalysis
  },
}; 