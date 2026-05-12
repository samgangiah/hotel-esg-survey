import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { findQuestionContext } from "@/lib/delegation";
import type { FormSpec } from "@/lib/schema";
import { Card } from "@/components/ui/Card";
import { DelegatedQuestion } from "@/components/form/delegate/DelegatedQuestion";
import { submitDelegatedAnswer, forwardDelegation } from "./actions";

export const metadata = { title: "Answer a question" };
export const dynamic = "force-dynamic";

/**
 * Public micro-page for someone who's been delegated a single question.
 * No login — the token is the auth. They can answer the question or
 * forward it on to someone else. Same TLD as the rest of the app so
 * there's no trust hop.
 */
export default async function DelegatedQuestionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const delegation = await db.questionDelegation.findUnique({
    where: { tokenHash },
    include: {
      surveyInstance: {
        include: {
          template: true,
          site: { include: { operator: true } },
        },
      },
      delegatedBy: true,
    },
  });

  if (!delegation) {
    return <Expired heading="Link not found" />;
  }
  if (delegation.cancelledAt && !delegation.answeredAt) {
    return (
      <Expired heading="This delegation has been cancelled">
        The person who sent you this link has withdrawn the request. No
        action is needed from you.
      </Expired>
    );
  }
  if (delegation.answeredAt) {
    return (
      <Expired heading="Already answered">
        This question has already been answered. Thanks for your help — no
        further action is needed.
      </Expired>
    );
  }
  if (delegation.expiresAt < new Date()) {
    return (
      <Expired heading="Link expired">
        This delegation link has expired. Ask the person who sent it to send
        you a fresh one.
      </Expired>
    );
  }

  const spec =
    delegation.surveyInstance.template.schemaJson as unknown as FormSpec;
  const ctx = findQuestionContext(spec, delegation.questionId);
  if (!ctx) notFound();

  const isClosed =
    delegation.surveyInstance.status === "submitted" ||
    delegation.surveyInstance.status === "locked";
  if (isClosed) {
    return (
      <Expired heading="Survey is closed">
        The energy survey for {delegation.surveyInstance.site.name} has
        been closed, so this question is no longer open for input.
      </Expired>
    );
  }

  return (
    <DelegatedQuestion
      token={token}
      question={ctx.question}
      sectionTitle={ctx.sectionTitle}
      groupTitle={ctx.groupTitle}
      delegatorName={delegation.delegatedBy.name}
      delegatorEmail={delegation.delegatedBy.email}
      siteName={delegation.surveyInstance.site.name}
      operatorName={delegation.surveyInstance.site.operator.name}
      toEmail={delegation.delegatedToEmail}
      toName={delegation.delegatedToName}
      note={delegation.note}
      onSubmit={submitDelegatedAnswer}
      onForward={forwardDelegation}
    />
  );
}

function Expired({
  heading,
  children,
}: {
  heading: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-3 p-8 text-center sm:p-10">
        <h1 className="font-display text-2xl text-ink">{heading}</h1>
        {children && <p className="text-muted">{children}</p>}
      </Card>
    </div>
  );
}
