-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "surveyInstanceId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "repeaterParentId" TEXT,
    "repeaterIndex" INTEGER,
    "filename" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageBackend" TEXT NOT NULL DEFAULT 'local',
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadedFile_surveyInstanceId_idx" ON "UploadedFile"("surveyInstanceId");

-- CreateIndex
CREATE INDEX "UploadedFile_surveyInstanceId_questionId_buildingId_idx" ON "UploadedFile"("surveyInstanceId", "questionId", "buildingId");

-- CreateIndex
CREATE INDEX "UploadedFile_respondentId_idx" ON "UploadedFile"("respondentId");

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_surveyInstanceId_fkey" FOREIGN KEY ("surveyInstanceId") REFERENCES "SurveyInstance"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
