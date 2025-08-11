/*
  Warnings:

  - You are about to drop the `ExtractedDocument` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "ExtractedDocument";

-- CreateTable
CREATE TABLE "CareerAnalysis" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "contactInfo" JSONB,
    "careerTimeline" JSONB,
    "skillsGrowth" JSONB,
    "topSkills" JSONB,
    "education" JSONB,
    "certifications" JSONB,
    "portfolio" JSONB,
    "recommendations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareerAnalysis_documentId_key" ON "CareerAnalysis"("documentId");
