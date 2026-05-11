-- CreateTable
CREATE TABLE "SectionSubmission" (
    "id" TEXT NOT NULL,
    "surveyInstanceId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SectionSubmission_surveyInstanceId_respondentId_sectionId_key" ON "SectionSubmission"("surveyInstanceId", "respondentId", "sectionId");

-- CreateIndex
CREATE INDEX "SectionSubmission_surveyInstanceId_idx" ON "SectionSubmission"("surveyInstanceId");

-- AddForeignKey
ALTER TABLE "SectionSubmission" ADD CONSTRAINT "SectionSubmission_surveyInstanceId_fkey" FOREIGN KEY ("surveyInstanceId") REFERENCES "SurveyInstance"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSubmission" ADD CONSTRAINT "SectionSubmission_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
