import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileText,
  Mail,
  Plane,
  Sparkles,
  Target,
} from 'lucide-react';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Sticky Nav */}
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-lg">
              <Plane className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Job Pilot</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-muted-foreground hover:text-foreground rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center md:px-8 md:pt-28">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Your AI Co-Pilot for the <span className="text-primary">Job Search</span>
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
          Stop flying blind. Job Pilot uses AI to score job fits, tailor your resume, generate cover
          letters, and track every application from takeoff to landing.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-medium transition-colors"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/login"
            className="hover:bg-accent inline-flex items-center gap-2 rounded-md border px-6 py-3 text-sm font-medium transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Beta Banner */}
      <div className="mx-auto max-w-2xl px-4 md:px-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Currently in <span className="font-semibold">beta</span>. Subject to change and charge.
        </div>
      </div>

      {/* Features Grid */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">Everything You Need to Land the Job</h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
            A full cockpit of AI-powered tools designed to give you an edge at every stage of your
            job search.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={FileText}
            title="AI Resume Tailoring"
            description="Automatically tailor your resume for each job posting, highlighting the skills and experience that matter most."
          />
          <FeatureCard
            icon={Target}
            title="Smart Job Scoring"
            description="Get an instant fit score for every job based on your profile, skills, and career goals."
          />
          <FeatureCard
            icon={Sparkles}
            title="Application Assist"
            description="One drawer with everything you need: tailored resume, cover letter, profile clipboard, and AI chat."
          />
          <FeatureCard
            icon={BookOpen}
            title="Answer Bank"
            description="Store and refine reusable answers to common application questions. Never start from scratch."
          />
          <FeatureCard
            icon={Mail}
            title="Cover Letter Generator"
            description="Generate tailored cover letters that match the job description and your personal voice."
          />
          <FeatureCard
            icon={BarChart3}
            title="Flight Analytics"
            description="Track your search with dashboards showing response rates, pipeline stages, and trends over time."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 border-t py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
              Three simple steps from job listing to confident application.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <StepCard
              step={1}
              title="Add Jobs"
              description="Paste a job URL or description. Job Pilot parses the details and adds it to your flight plan."
            />
            <StepCard
              step={2}
              title="AI Scores & Tailors"
              description="Instantly see your fit score. Get a tailored resume and cover letter matched to the role."
            />
            <StepCard
              step={3}
              title="Apply with Confidence"
              description="Use Application Assist to apply with polished materials and track your progress from start to finish."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="mx-auto max-w-6xl px-4 text-center md:px-8">
          <div className="flex items-center justify-center gap-3">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Plane className="text-primary-foreground h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight">Job Pilot</span>
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            Built by{' '}
            <a
              href="https://eduardoverde.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary font-medium underline underline-offset-4"
            >
              eduardoverde.com
            </a>{' '}
            &{' '}
            <a
              href="https://whyuascii.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary font-medium underline underline-offset-4"
            >
              whyuascii.com
            </a>
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            &copy; {new Date().getFullYear()} Job Pilot. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="bg-primary/10 mb-4 flex h-10 w-10 items-center justify-center rounded-lg">
        <Icon className="text-primary h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="bg-primary text-primary-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold">
        {step}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
