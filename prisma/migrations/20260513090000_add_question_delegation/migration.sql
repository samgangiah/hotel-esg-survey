-- CreateTable
CREATE TABLE "QuestionDelegation" (
    "id" TEXT NOT NULL,
    "surveyInstanceId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "delegatedByRespondentId" TEXT NOT NULL,
    "delegatedToEmail" TEXT NOT NULL,
    "delegatedToName" TEXT,
    "delegatedToRespondentId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "parentDelegationId" TEXT,

    CONSTRAINT "QuestionDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionDelegation_tokenHash_key" ON "QuestionDelegation"("tokenHash");
CREATE INDEX "QuestionDelegation_surveyInstanceId_idx" ON "QuestionDelegation"("surveyInstanceId");
CREATE INDEX "QuestionDelegation_surveyInstanceId_questionId_buildingId_idx" ON "QuestionDelegation"("surveyInstanceId", "questionId", "buildingId");
CREATE INDEX "QuestionDelegation_delegatedByRespondentId_idx" ON "QuestionDelegation"("delegatedByRespondentId");

-- AddForeignKey
ALTER TABLE "QuestionDelegation" ADD CONSTRAINT "QuestionDelegation_surveyInstanceId_fkey" FOREIGN KEY ("surveyInstanceId") REFERENCES "SurveyInstance"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "QuestionDelegation" ADD CONSTRAINT "QuestionDelegation_delegatedByRespondentId_fkey" FOREIGN KEY ("delegatedByRespondentId") REFERENCES "Respondent"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "QuestionDelegation" ADD CONSTRAINT "QuestionDelegation_delegatedToRespondentId_fkey" FOREIGN KEY ("delegatedToRespondentId") REFERENCES "Respondent"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "QuestionDelegation" ADD CONSTRAINT "QuestionDelegation_parentDelegationId_fkey" FOREIGN KEY ("parentDelegationId") REFERENCES "QuestionDelegation"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
