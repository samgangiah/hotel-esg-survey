import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Users,
  FileText,
  Lock,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "PHS Energy — find the savings hiding in your hotel",
  description:
    "A short, structured way to capture how your hotel uses energy — so you know where to save.",
};

/**
 * Public marketing landing page. The portal itself is invite-only; this page
 * exists so that anyone who navigates to the root URL — prospective customers,
 * curious visitors, or invited respondents who lost their email — lands on
 * something explanatory rather than the bare survey.
 */
export default function HomePage() {
  return (
    <div className="bg-canvas">
      <Header />
      <Hero />
      <ValueProps />
      <HowItWorks />
      <CtaBlock />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-card bg-accent text-white text-xs font-medium">
            phs
          </span>
          <span>
            <span className="block font-display text-lg leading-tight text-ink">
              PHS Energy
            </span>
            <span className="block text-xs text-muted">
              Find the savings hiding in your hotel
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/demo"
            className="hidden rounded-control px-3 py-1.5 text-muted hover:bg-accent-soft/40 hover:text-ink sm:inline"
          >
            See an example
          </Link>
          <Link
            href="/recover"
            className="rounded-control px-3 py-1.5 text-muted hover:bg-accent-soft/40 hover:text-ink"
          >
            Lost your link?
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-xs uppercase tracking-wide text-muted">Invite-only</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl sm:leading-tight">
        A short, structured way to capture how your hotel uses energy — so you
        know where to save.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">
        Built for hotel groups working through their first sustainability
        baseline. We collect the data, your team fills it in across roles, and
        you get a clean report to act on.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/recover">
          <Button size="lg">
            <Mail className="h-4 w-4" />
            I have an invite — send me a fresh link
          </Button>
        </Link>
        <Link href="/demo">
          <Button variant="secondary" size="lg">
            See an example
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <p className="mt-5 text-xs text-muted">
        No accounts. No passwords. Access is by personal magic-link email,
        scoped to your operator.
      </p>
    </section>
  );
}

function ValueProps() {
  return (
    <section className="border-y border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="font-display text-2xl text-ink sm:text-3xl">
          What you get
        </h2>
        <p className="mt-2 text-muted">
          An honest baseline of how your property consumes energy, structured
          so an analyst can spot the savings in days, not weeks.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={Users}
            title="Right people, right questions"
            body="Each section is filled by the team member closest to it — GM, engineering, housekeeping, laundry, finance. No one is asked something they don't know."
          />
          <Feature
            icon={CheckCircle2}
            title="Save and resume"
            body="Answers save automatically. Pick up on any device with the same magic link. No accounts, no passwords."
          />
          <Feature
            icon={FileText}
            title="Print-ready report"
            body="One click generates a versioned snapshot. Open the print view, save as PDF, email to whoever needs it."
          />
          <Feature
            icon={ShieldCheck}
            title="Scoped data, full audit trail"
            body="Your data stays inside your operator's space. Every action — invitations, answers, exports — is audit-logged."
          />
        </div>
      </div>
    </section>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <Card className="px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-card bg-accent-soft text-accent-deep">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-3 font-display text-base text-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
    </Card>
  );
}

function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
      <h2 className="font-display text-2xl text-ink sm:text-3xl">
        How it works
      </h2>
      <p className="mt-2 max-w-2xl text-muted">
        From kickoff to deliverable, typically inside a working week.
      </p>
      <ol className="mt-8 space-y-4">
        <Step
          n={1}
          title="You're invited"
          body="We set up your operator account. You — the Operator Admin — get a welcome email with a sign-in link. Click it to land in your portal."
        />
        <Step
          n={2}
          title="You set up your hotel + team"
          body="Add your hotel's name and buildings, then invite the people on your team to fill different sections. They each get their own magic-link email."
        />
        <Step
          n={3}
          title="Your team fills the survey"
          body="Each team member sees only the questions relevant to them. They can save and resume, upload bills and EPCs, or delegate a question to a colleague if they don't know the answer."
        />
        <Step
          n={4}
          title="You get a report"
          body="When the last section is in, you get a notification. Generate a print-ready snapshot, share it with your sustainability team, and start finding savings."
        />
      </ol>
    </section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent bg-white font-display text-sm text-accent-deep">
        {n}
      </span>
      <div>
        <h3 className="font-display text-base text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    </li>
  );
}

function CtaBlock() {
  return (
    <section className="border-y border-line bg-accent-soft/40">
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-16">
        <div>
          <h2 className="font-display text-2xl text-ink sm:text-3xl">
            Already invited?
          </h2>
          <p className="mt-2 text-sm text-muted">
            Find the email from us with subject starting{" "}
            <em>&ldquo;Welcome to PHS Energy&rdquo;</em>
            {" "}or your colleague&apos;s name. Click the link inside. If you
            can&apos;t find it, send yourself a fresh one.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/recover">
            <Button size="lg">
              <Mail className="h-4 w-4" />
              Send me a fresh link
            </Button>
          </Link>
          <Link href="/demo">
            <Button variant="secondary" size="lg">
              Try the demo
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-2">
          <Lock className="h-3 w-3" />
          <span>
            Invite-only. The portal isn&apos;t publicly accessible — only people
            with a magic-link email can sign in.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://phsenergy.co.uk"
            className="underline-offset-2 hover:text-ink hover:underline"
          >
            phsenergy.co.uk
          </a>
          <Link
            href="/demo"
            className="underline-offset-2 hover:text-ink hover:underline"
          >
            Try the demo
          </Link>
          <Link
            href="/recover"
            className="underline-offset-2 hover:text-ink hover:underline"
          >
            Lost your link?
          </Link>
        </div>
      </div>
    </footer>
  );
}
