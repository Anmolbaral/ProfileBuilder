import { gql } from '@apollo/client';

export const typeDefs = gql`
  scalar Upload
  scalar DateTime

  enum PdfType {
    RESUME
    LINKEDIN
    PORTFOLIO
  }

  type UploadedPdf {
    id: ID!
    filename: String!
    url: String!
    fileType: PdfType!
    uploadedAt: DateTime!
  }

  type CareerSnapshot {
    company: String
    title: String
    startDate: String
    endDate: String
    summary: String
  }

  type AnalysisResult {
    timeline: [CareerSnapshot!]!
    skillsGrowth: [String!]!
    recommendedNextSteps: String
  }

  type Mutation {
    uploadCareerPdfs(files: [Upload!]!, types: [PdfType!]!): [UploadedPdf!]!
    analyzeCareerPdf(uploadedIds: [ID!]!): AnalysisResult!
  }
`; 