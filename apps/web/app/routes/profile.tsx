import * as React from 'react';

import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  Ban,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Github,
  Globe,
  Link2,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Printer,
  Save,
  Settings2,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@job-pilot/ui';

import { ProfileCoachPanel } from '~/components/profile-coach';
import { api } from '~/lib/api-client';
import { captureEvent } from '~/lib/posthog';

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-72" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Route Definition ────────────────────────────────────────────────────────

export const Route = createFileRoute('/profile')({
  loader: async () => {
    const [candidate, resumeList, skillsList, experienceList, projectsList, preferencesList] =
      await Promise.all([
        api.candidates.get(),
        api.resumes.list(),
        api.skills.list().catch(() => []),
        api.experience.list().catch(() => []),
        api.projects.list().catch(() => []),
        api.preferences.list().catch(() => []),
      ]);
    return {
      candidate,
      resumes: resumeList,
      skills: skillsList,
      experience: experienceList,
      projects: projectsList,
      preferences: preferencesList,
    };
  },
  component: ProfilePage,
  pendingComponent: ProfileSkeleton,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type Candidate = NonNullable<Awaited<ReturnType<typeof api.candidates.get>>>;
type Skill = Awaited<ReturnType<typeof api.skills.list>>[number];
type Experience = Awaited<ReturnType<typeof api.experience.list>>[number];
type Project = Awaited<ReturnType<typeof api.projects.list>>[number];
type Preference = Awaited<ReturnType<typeof api.preferences.list>>[number];
type Resume = Awaited<ReturnType<typeof api.resumes.list>>[number];

// ─── Constants ───────────────────────────────────────────────────────────────

const REMOTE_OPTIONS = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
  { value: 'flexible', label: 'Flexible' },
];

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR'];

const SKILL_CATEGORIES = [
  { value: 'language', label: 'Language' },
  { value: 'framework', label: 'Framework' },
  { value: 'tool', label: 'Tool' },
  { value: 'platform', label: 'Platform' },
  { value: 'methodology', label: 'Methodology' },
  { value: 'soft_skill', label: 'Soft Skill' },
  { value: 'domain', label: 'Domain' },
];

const PREFERENCE_CATEGORIES = [
  { value: 'location', label: 'Location' },
  { value: 'salary', label: 'Salary' },
  { value: 'role', label: 'Role' },
  { value: 'company', label: 'Company' },
  { value: 'other', label: 'Other' },
];

const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMonthYear(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function toISOString(monthValue: string): string {
  return new Date(monthValue + '-01').toISOString();
}

function formatDisplayDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function categoryBadgeVariant(category: string): 'default' | 'secondary' | 'outline' {
  switch (category) {
    case 'language':
    case 'framework':
      return 'default';
    case 'tool':
    case 'platform':
      return 'secondary';
    default:
      return 'outline';
  }
}

// ─── Success Banner Component ────────────────────────────────────────────────

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-white px-4 py-3 text-sm text-emerald-700">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4" />
        {message}
      </div>
    </div>
  );
}

// ─── Main Profile Page ───────────────────────────────────────────────────────

function ProfilePage() {
  const { candidate, resumes, skills, experience, projects, preferences } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pilot Profile</h1>
        <p className="text-muted-foreground">
          Your canonical profile powers all tailored applications.
        </p>
      </div>

      {!candidate ? (
        <Card className="rounded-xl shadow">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <User className="text-muted-foreground/20 mb-4 h-16 w-16" />
            <h3 className="mb-1 text-lg font-semibold">No profile found</h3>
            <p className="text-muted-foreground max-w-md text-center text-sm">
              It looks like your candidate profile hasn't been created yet. This usually happens
              automatically when you sign up.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Content */}
          <div className="min-w-0">
            <Tabs defaultValue="overview">
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
                <TabsTrigger value="overview" className="gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="experience" className="gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  Experience
                </TabsTrigger>
                <TabsTrigger value="skills" className="gap-1.5">
                  <Code className="h-3.5 w-3.5" />
                  Skills
                </TabsTrigger>
                <TabsTrigger value="projects" className="gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Projects
                </TabsTrigger>
                <TabsTrigger value="preferences" className="gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" />
                  Preferences
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <OverviewTab candidate={candidate} />
              </TabsContent>
              <TabsContent value="experience">
                <ExperienceTab experience={experience} />
              </TabsContent>
              <TabsContent value="skills">
                <SkillsTab skills={skills} />
              </TabsContent>
              <TabsContent value="projects">
                <ProjectsTab projects={projects} />
              </TabsContent>
              <TabsContent value="preferences">
                <PreferencesTab preferences={preferences} candidate={candidate} />
              </TabsContent>
            </Tabs>
          </div>

          {/* AI Coach + Resume Sidebar */}
          <div className="space-y-4 lg:order-last">
            <ProfileCoachPanel
              candidate={candidate}
              skills={skills}
              experience={experience}
              projects={projects}
            />
            <ResumeLibrary />
            <ResumeSidebar resumes={resumes} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 1: Overview ─────────────────────────────────────────────────────────

function OverviewTab({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState('');

  const [form, setForm] = React.useState({
    email: candidate.email ?? '',
    phone: candidate.phone ?? '',
    legalName: candidate.legalName ?? '',
    preferredName: candidate.preferredName ?? '',
    headline: candidate.headline ?? '',
    summary: candidate.summary ?? '',
    currentTitle: candidate.currentTitle ?? '',
    currentCompany: candidate.currentCompany ?? '',
    yearsOfExperience: candidate.yearsOfExperience ?? 0,
    location: candidate.location ?? '',
    remotePreference: candidate.remotePreference ?? 'flexible',
    salaryMin: candidate.salaryMin ?? '',
    salaryMax: candidate.salaryMax ?? '',
    salaryCurrency: candidate.salaryCurrency ?? 'USD',
    visaRequired: candidate.visaRequired ?? false,
    linkedinUrl: candidate.linkedinUrl ?? '',
    githubUrl: candidate.githubUrl ?? '',
    websiteUrl: candidate.websiteUrl ?? '',
    portfolioUrl: candidate.portfolioUrl ?? '',
  });

  function updateField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    if (!form.salaryMin && form.salaryMin !== 0) {
      setError('Minimum salary is required.');
      setSaving(false);
      return;
    }

    try {
      await api.candidates.update({
        phone: form.phone || null,
        legalName: form.legalName || null,
        preferredName: form.preferredName || null,
        headline: form.headline,
        summary: form.summary,
        currentTitle: form.currentTitle,
        currentCompany: form.currentCompany || null,
        yearsOfExperience: Number(form.yearsOfExperience),
        location: form.location,
        remotePreference: form.remotePreference,
        salaryMin: Number(form.salaryMin),
        salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
        salaryCurrency: form.salaryCurrency,
        visaRequired: form.visaRequired,
        linkedinUrl: form.linkedinUrl || null,
        githubUrl: form.githubUrl || null,
        websiteUrl: form.websiteUrl || null,
        portfolioUrl: form.portfolioUrl || null,
      });
      setSuccess(true);
      router.invalidate();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-xl shadow">
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="text-muted-foreground h-5 w-5" />
          <CardTitle>Basic Information</CardTitle>
        </div>
        <CardDescription>
          Keep your profile up to date to get the best tailored applications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success && <SuccessBanner message="Profile updated successfully." />}
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-white px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-6">
          {/* Contact Information */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="mr-1 inline h-3.5 w-3.5" />
                Email Address
              </Label>
              <Input id="email" type="email" value={form.email} disabled className="bg-muted" />
              <p className="text-muted-foreground text-xs">
                Set from your login email — update in account settings
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">
                <Phone className="mr-1 inline h-3.5 w-3.5" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g. +1 (555) 123-4567"
                maxLength={30}
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
              <p className="text-muted-foreground text-xs">Used for job applications</p>
            </div>
          </div>

          {/* Legal Name + Preferred Name */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalName">
                <User className="mr-1 inline h-3.5 w-3.5" />
                Legal Name
              </Label>
              <Input
                id="legalName"
                placeholder="e.g. John Michael Smith"
                maxLength={200}
                value={form.legalName}
                onChange={(e) => updateField('legalName', e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Full legal name used on resumes and applications
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredName">Preferred / Nickname</Label>
              <Input
                id="preferredName"
                placeholder="e.g. Johnny, Mike"
                maxLength={100}
                value={form.preferredName}
                onChange={(e) => updateField('preferredName', e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Optional — how you prefer to be addressed
              </p>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              placeholder="e.g. Senior Full-Stack Engineer"
              maxLength={200}
              value={form.headline}
              onChange={(e) => updateField('headline', e.target.value)}
            />
            <p className="text-muted-foreground text-xs">{form.headline.length}/200 characters</p>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <textarea
              id="summary"
              rows={5}
              maxLength={5000}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="A brief professional summary..."
              value={form.summary}
              onChange={(e) => updateField('summary', e.target.value)}
            />
            <p className="text-muted-foreground text-xs">{form.summary.length}/5000 characters</p>
          </div>

          {/* Title + Company */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currentTitle">
                <Briefcase className="mr-1 inline h-3.5 w-3.5" />
                Current Title
              </Label>
              <Input
                id="currentTitle"
                placeholder="e.g. Software Engineer"
                value={form.currentTitle}
                onChange={(e) => updateField('currentTitle', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentCompany">
                <Building2 className="mr-1 inline h-3.5 w-3.5" />
                Current Company (optional)
              </Label>
              <Input
                id="currentCompany"
                placeholder="e.g. Acme Corp"
                value={form.currentCompany}
                onChange={(e) => updateField('currentCompany', e.target.value)}
              />
            </div>
          </div>

          {/* Years of Experience + Location */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="yearsOfExperience">Years of Experience</Label>
              <Input
                id="yearsOfExperience"
                type="number"
                min={0}
                max={50}
                value={form.yearsOfExperience}
                onChange={(e) => updateField('yearsOfExperience', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                Location
              </Label>
              <Input
                id="location"
                placeholder="e.g. San Francisco, CA"
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
              />
            </div>
          </div>

          {/* Remote Preference */}
          <div className="space-y-2">
            <Label htmlFor="remotePreference">
              <Globe className="mr-1 inline h-3.5 w-3.5" />
              Remote Preference
            </Label>
            <select
              id="remotePreference"
              className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
              value={form.remotePreference}
              onChange={(e) => updateField('remotePreference', e.target.value)}
            >
              {REMOTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Salary Range */}
          <div className="space-y-2">
            <Label>
              <DollarSign className="mr-1 inline h-3.5 w-3.5" />
              Salary Range
            </Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Min *"
                  min={0}
                  required
                  aria-required="true"
                  value={form.salaryMin}
                  onChange={(e) => updateField('salaryMin', e.target.value)}
                />
                <p className="text-muted-foreground text-[10px]">Required</p>
              </div>
              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Max (optional)"
                  min={0}
                  value={form.salaryMax}
                  onChange={(e) => updateField('salaryMax', e.target.value)}
                />
                <p className="text-muted-foreground text-[10px]">Optional</p>
              </div>
              <select
                className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
                value={form.salaryCurrency}
                onChange={(e) => updateField('salaryCurrency', e.target.value)}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Visa Required */}
          <div className="flex items-center gap-2">
            <input
              id="visaRequired"
              type="checkbox"
              className="border-input text-primary focus:ring-ring h-4 w-4 rounded"
              checked={form.visaRequired}
              onChange={(e) => updateField('visaRequired', e.target.checked)}
            />
            <Label htmlFor="visaRequired">Visa sponsorship required</Label>
          </div>

          <Separator />

          {/* Profile Links */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              Profile Links
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="linkedinUrl"
                  className="text-muted-foreground flex items-center gap-1 text-xs"
                >
                  <Linkedin className="h-3 w-3" />
                  LinkedIn
                </Label>
                <Input
                  id="linkedinUrl"
                  type="url"
                  placeholder="https://linkedin.com/in/yourname"
                  value={form.linkedinUrl}
                  onChange={(e) => updateField('linkedinUrl', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="githubUrl"
                  className="text-muted-foreground flex items-center gap-1 text-xs"
                >
                  <Github className="h-3 w-3" />
                  GitHub
                </Label>
                <Input
                  id="githubUrl"
                  type="url"
                  placeholder="https://github.com/yourname"
                  value={form.githubUrl}
                  onChange={(e) => updateField('githubUrl', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="websiteUrl"
                  className="text-muted-foreground flex items-center gap-1 text-xs"
                >
                  <Globe className="h-3 w-3" />
                  Website
                </Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://yoursite.com"
                  value={form.websiteUrl}
                  onChange={(e) => updateField('websiteUrl', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="portfolioUrl"
                  className="text-muted-foreground flex items-center gap-1 text-xs"
                >
                  <ExternalLink className="h-3 w-3" />
                  Portfolio
                </Label>
                <Input
                  id="portfolioUrl"
                  type="url"
                  placeholder="https://portfolio.yoursite.com"
                  value={form.portfolioUrl}
                  onChange={(e) => updateField('portfolioUrl', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Tab 2: Experience ───────────────────────────────────────────────────────

interface ExperienceFormState {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  bullets: string[];
  skills: string;
}

const emptyExperienceForm: ExperienceFormState = {
  company: '',
  title: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
  bullets: [''],
  skills: '',
};

function ExperienceTab({ experience }: { experience: Experience[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState('');

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleAdd(form: ExperienceFormState) {
    setLoading(true);
    try {
      await api.experience.add({
        company: form.company,
        title: form.title,
        location: form.location || undefined,
        startDate: toISOString(form.startDate),
        endDate: form.current ? undefined : form.endDate ? toISOString(form.endDate) : undefined,
        current: form.current,
        description: form.description || undefined,
        bullets: form.bullets.filter((b) => b.trim()),
        skills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setShowAdd(false);
      showSuccess('Experience added successfully.');
      router.invalidate();
    } catch {
      // Error handling is inline in the form
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id: string, form: ExperienceFormState) {
    setLoading(true);
    try {
      await api.experience.update({
        experienceId: id,
        company: form.company,
        title: form.title,
        location: form.location,
        startDate: form.startDate ? toISOString(form.startDate) : undefined,
        endDate: form.current ? undefined : form.endDate ? toISOString(form.endDate) : undefined,
        current: form.current,
        description: form.description,
        bullets: form.bullets.filter((b) => b.trim()),
        skills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setEditingId(null);
      showSuccess('Experience updated successfully.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await api.experience.delete({ experienceId: id });
      setDeletingId(null);
      showSuccess('Experience deleted.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="text-muted-foreground h-5 w-5" />
          <h2 className="text-lg font-semibold">Experience</h2>
          <Badge variant="secondary">{experience.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Experience
        </Button>
      </div>

      {success && <SuccessBanner message={success} />}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Experience</DialogTitle>
            <DialogDescription>Add a new experience entry to your profile.</DialogDescription>
          </DialogHeader>
          <ExperienceForm
            initial={emptyExperienceForm}
            loading={loading}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Experience Cards */}
      {experience.length === 0 ? (
        <Card className="rounded-xl shadow">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Briefcase className="text-muted-foreground/20 mb-3 h-12 w-12" />
            <p className="mb-1 font-medium">No experience added yet</p>
            <p className="text-muted-foreground mb-4 text-sm">
              Add your work history to strengthen your applications.
            </p>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Add Your First Experience
            </Button>
          </CardContent>
        </Card>
      ) : (
        experience.map((exp) => (
          <Card key={exp.id} className="rounded-xl shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{exp.title}</h3>
                    {exp.current && <Badge variant="success">Current</Badge>}
                  </div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {exp.company}
                    </span>
                    {exp.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {exp.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDisplayDate(exp.startDate)} &mdash;{' '}
                      {exp.current ? 'Present' : formatDisplayDate(exp.endDate)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditingId(exp.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingId(exp.id)}
                    aria-label={`Delete experience at ${exp.company}`}
                    className="hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {exp.description && (
                <p className="text-muted-foreground mt-3 text-sm">{exp.description}</p>
              )}

              {(exp.bullets as string[])?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {(exp.bullets as string[]).map((bullet, i) => (
                    <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}

              {(exp.skills as string[])?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(exp.skills as string[]).map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Edit Dialog - rendered once, outside the loop */}
      {(() => {
        const editingExp = experience.find((e) => e.id === editingId);
        return (
          <Dialog
            open={editingId !== null}
            onOpenChange={(open) => {
              if (!open) setEditingId(null);
            }}
          >
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Experience</DialogTitle>
                <DialogDescription>Update this experience entry.</DialogDescription>
              </DialogHeader>
              {editingExp && (
                <ExperienceForm
                  key={editingExp.id}
                  initial={{
                    company: editingExp.company,
                    title: editingExp.title,
                    location: editingExp.location ?? '',
                    startDate: formatMonthYear(editingExp.startDate),
                    endDate: formatMonthYear(editingExp.endDate),
                    current: editingExp.current ?? false,
                    description: editingExp.description ?? '',
                    bullets: (editingExp.bullets as string[])?.length
                      ? (editingExp.bullets as string[])
                      : [''],
                    skills: (editingExp.skills as string[])?.join(', ') ?? '',
                  }}
                  loading={loading}
                  onSubmit={(form) => handleUpdate(editingExp.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Delete AlertDialog - rendered once, outside the loop */}
      {(() => {
        const deletingExp = experience.find((e) => e.id === deletingId);
        return (
          <AlertDialog
            open={deletingId !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Experience?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deletingExp
                    ? `This will permanently remove your position at ${deletingExp.company}. This cannot be undone.`
                    : 'This will permanently remove this experience entry.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deletingId) handleDelete(deletingId);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </div>
  );
}

function ExperienceForm({
  initial,
  loading,
  onSubmit,
  onCancel,
}: {
  initial: ExperienceFormState;
  loading: boolean;
  onSubmit: (form: ExperienceFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState<ExperienceFormState>(initial);

  function updateField(field: keyof ExperienceFormState, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addBullet() {
    setForm((prev) => ({ ...prev, bullets: [...prev.bullets, ''] }));
  }

  function updateBullet(index: number, value: string) {
    setForm((prev) => {
      const bullets = [...prev.bullets];
      bullets[index] = value;
      return { ...prev, bullets };
    });
  }

  function removeBullet(index: number) {
    setForm((prev) => ({
      ...prev,
      bullets: prev.bullets.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Company *</Label>
          <Input
            placeholder="Company name"
            value={form.company}
            onChange={(e) => updateField('company', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Title *</Label>
          <Input
            placeholder="Job title"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Location</Label>
        <Input
          placeholder="e.g. New York, NY"
          value={form.location}
          onChange={(e) => updateField('location', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Start Date *</Label>
          <Input
            type="month"
            value={form.startDate}
            onChange={(e) => updateField('startDate', e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input
            type="month"
            value={form.endDate}
            onChange={(e) => updateField('endDate', e.target.value)}
            disabled={form.current}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="current-role"
          className="border-input text-primary focus:ring-ring h-4 w-4 rounded"
          checked={form.current}
          onChange={(e) => {
            updateField('current', e.target.checked);
            if (e.target.checked) updateField('endDate', '');
          }}
        />
        <Label htmlFor="current-role">I currently work here</Label>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <textarea
          rows={3}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          placeholder="Brief description of your role..."
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
        />
      </div>

      {/* Bullet Points */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Key Achievements / Bullets</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addBullet}>
            <Plus className="h-3.5 w-3.5" />
            Add Bullet
          </Button>
        </div>
        <div className="space-y-2">
          {form.bullets.map((bullet, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={`Achievement #${i + 1}`}
                value={bullet}
                onChange={(e) => updateBullet(i, e.target.value)}
              />
              {form.bullets.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeBullet(i)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <Label>Skills (comma-separated)</Label>
        <Input
          placeholder="e.g. React, TypeScript, Node.js"
          value={form.skills}
          onChange={(e) => updateField('skills', e.target.value)}
        />
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button
          type="button"
          disabled={loading || !form.company || !form.title || !form.startDate}
          onClick={() => onSubmit(form)}
        >
          <Save className="h-4 w-4" />
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ─── Tab 3: Skills ───────────────────────────────────────────────────────────

interface SkillFormState {
  name: string;
  category: string;
  confidenceScore: number;
  yearsUsed: string;
}

const emptySkillForm: SkillFormState = {
  name: '',
  category: 'language',
  confidenceScore: 50,
  yearsUsed: '',
};

function SkillsTab({ skills }: { skills: Skill[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState('');

  function showSuccessMsg(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  // Group skills by category
  const grouped = React.useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const skill of skills) {
      const cat = skill.category ?? 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(skill);
    }
    return map;
  }, [skills]);

  const uniqueCategories = grouped.size;

  async function handleAdd(form: SkillFormState) {
    setLoading(true);
    try {
      await api.skills.add({
        name: form.name,
        category: form.category,
        confidenceScore: form.confidenceScore,
        yearsUsed: form.yearsUsed ? Number(form.yearsUsed) : undefined,
      });
      setShowAdd(false);
      showSuccessMsg('Skill added successfully.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id: string, form: SkillFormState) {
    setLoading(true);
    try {
      await api.skills.update({
        skillId: id,
        name: form.name,
        category: form.category,
        confidenceScore: form.confidenceScore,
        yearsUsed: form.yearsUsed ? Number(form.yearsUsed) : undefined,
      });
      setEditingId(null);
      showSuccessMsg('Skill updated successfully.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await api.skills.delete({ skillId: id });
      setDeletingId(null);
      showSuccessMsg('Skill deleted.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="text-muted-foreground h-5 w-5" />
          <h2 className="text-lg font-semibold">Skills</h2>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Skill
        </Button>
      </div>

      {/* Summary */}
      <p className="text-muted-foreground text-sm">
        {skills.length} skill{skills.length !== 1 ? 's' : ''} across {uniqueCategories} categor
        {uniqueCategories !== 1 ? 'ies' : 'y'}
      </p>

      {success && <SuccessBanner message={success} />}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
            <DialogDescription>Add a new skill to your profile.</DialogDescription>
          </DialogHeader>
          <SkillForm
            initial={emptySkillForm}
            loading={loading}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {skills.length === 0 && (
        <Card className="rounded-xl shadow">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Code className="text-muted-foreground/20 mb-3 h-12 w-12" />
            <p className="mb-1 font-medium">No skills added yet</p>
            <p className="text-muted-foreground mb-4 text-sm">
              Add your technical and professional skills.
            </p>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Add Your First Skill
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grouped Skills */}
      {SKILL_CATEGORIES.map(({ value: catValue, label: catLabel }) => {
        const catSkills = grouped.get(catValue);
        if (!catSkills || catSkills.length === 0) return null;

        return (
          <Card key={catValue} className="rounded-xl shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{catLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {catSkills.map((skill) => (
                <div key={skill.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium">{skill.name}</span>
                        <Badge variant={categoryBadgeVariant(catValue)}>{catLabel}</Badge>
                        {skill.yearsUsed != null && (
                          <span className="text-muted-foreground text-xs">
                            {skill.yearsUsed} yr{skill.yearsUsed !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {/* Confidence Bar */}
                      <div className="flex items-center gap-2">
                        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full bg-sky-500 transition-all"
                            style={{
                              width: `${skill.confidenceScore ?? 50}%`,
                            }}
                          />
                        </div>
                        <span className="text-muted-foreground w-8 text-right text-xs">
                          {skill.confidenceScore ?? 50}%
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingId(skill.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingId(skill.id)}
                        aria-label={`Delete skill ${skill.name}`}
                        className="hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Edit Dialog - rendered once, outside the loop */}
      {(() => {
        const editingSkill = skills.find((s) => s.id === editingId);
        return (
          <Dialog
            open={editingId !== null}
            onOpenChange={(open) => {
              if (!open) setEditingId(null);
            }}
          >
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Skill</DialogTitle>
                <DialogDescription>Update this skill entry.</DialogDescription>
              </DialogHeader>
              {editingSkill && (
                <SkillForm
                  key={editingSkill.id}
                  initial={{
                    name: editingSkill.name,
                    category: editingSkill.category ?? 'language',
                    confidenceScore: editingSkill.confidenceScore ?? 50,
                    yearsUsed: editingSkill.yearsUsed?.toString() ?? '',
                  }}
                  loading={loading}
                  onSubmit={(form) => handleUpdate(editingSkill.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Delete AlertDialog - rendered once, outside the loop */}
      {(() => {
        const deletingSkill = skills.find((s) => s.id === deletingId);
        return (
          <AlertDialog
            open={deletingId !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Skill?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deletingSkill
                    ? `This will permanently remove "${deletingSkill.name}" from your profile. This cannot be undone.`
                    : 'This skill will be removed from your profile. This cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deletingId) handleDelete(deletingId);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </div>
  );
}

function SkillForm({
  initial,
  loading,
  onSubmit,
  onCancel,
}: {
  initial: SkillFormState;
  loading: boolean;
  onSubmit: (form: SkillFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState<SkillFormState>(initial);

  function updateField(field: keyof SkillFormState, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            placeholder="e.g. TypeScript"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <select
            className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
          >
            {SKILL_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Confidence Score: {form.confidenceScore}%</Label>
          <input
            type="range"
            min={0}
            max={100}
            value={form.confidenceScore}
            onChange={(e) => updateField('confidenceScore', Number(e.target.value))}
            className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg accent-sky-500"
          />
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>Beginner</span>
            <span>Expert</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Years Used</Label>
          <Input
            type="number"
            min={0}
            max={50}
            placeholder="e.g. 3"
            value={form.yearsUsed}
            onChange={(e) => updateField('yearsUsed', e.target.value)}
          />
        </div>
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button type="button" disabled={loading || !form.name} onClick={() => onSubmit(form)}>
          <Save className="h-4 w-4" />
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ─── Tab 4: Projects ─────────────────────────────────────────────────────────

interface ProjectFormState {
  name: string;
  description: string;
  url: string;
  skills: string;
  highlights: string[];
}

const emptyProjectForm: ProjectFormState = {
  name: '',
  description: '',
  url: '',
  skills: '',
  highlights: [''],
};

function ProjectsTab({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState('');

  function showSuccessMsg(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleAdd(form: ProjectFormState) {
    setLoading(true);
    try {
      await api.projects.add({
        name: form.name,
        description: form.description,
        url: form.url || undefined,
        skills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        highlights: form.highlights.filter((h) => h.trim()),
      });
      setShowAdd(false);
      showSuccessMsg('Project added successfully.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id: string, form: ProjectFormState) {
    setLoading(true);
    try {
      await api.projects.update({
        projectId: id,
        name: form.name,
        description: form.description,
        url: form.url || undefined,
        skills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        highlights: form.highlights.filter((h) => h.trim()),
      });
      setEditingId(null);
      showSuccessMsg('Project updated successfully.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await api.projects.delete({ projectId: id });
      setDeletingId(null);
      showSuccessMsg('Project deleted.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="text-muted-foreground h-5 w-5" />
          <h2 className="text-lg font-semibold">Projects</h2>
          <Badge variant="secondary">{projects.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </div>

      {success && <SuccessBanner message={success} />}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
            <DialogDescription>Add a new project to your profile.</DialogDescription>
          </DialogHeader>
          <ProjectForm
            initial={emptyProjectForm}
            loading={loading}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {projects.length === 0 && (
        <Card className="rounded-xl shadow">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="text-muted-foreground/20 mb-3 h-12 w-12" />
            <p className="mb-1 font-medium">No projects yet</p>
            <p className="text-muted-foreground mb-4 text-sm">
              Showcase your side projects and portfolio work.
            </p>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Add Your First Project
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Project Cards */}
      {projects.map((project) => (
        <Card key={project.id} className="rounded-xl shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{project.name}</h3>
                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-sky-600 hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Link
                    </a>
                  )}
                </div>
                {project.description && (
                  <p className="text-muted-foreground mt-1 text-sm">{project.description}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditingId(project.id)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeletingId(project.id)}
                  aria-label={`Delete project ${project.name}`}
                  className="hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>

            {(project.highlights as string[])?.length > 0 && (
              <ul className="mt-3 space-y-1">
                {(project.highlights as string[]).map((highlight, i) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                    {highlight}
                  </li>
                ))}
              </ul>
            )}

            {(project.skills as string[])?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(project.skills as string[]).map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Edit Dialog - rendered once, outside the loop */}
      {(() => {
        const editingProject = projects.find((p) => p.id === editingId);
        return (
          <Dialog
            open={editingId !== null}
            onOpenChange={(open) => {
              if (!open) setEditingId(null);
            }}
          >
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogDescription>Update this project entry.</DialogDescription>
              </DialogHeader>
              {editingProject && (
                <ProjectForm
                  key={editingProject.id}
                  initial={{
                    name: editingProject.name,
                    description: editingProject.description ?? '',
                    url: editingProject.url ?? '',
                    skills: (editingProject.skills as string[])?.join(', ') ?? '',
                    highlights: (editingProject.highlights as string[])?.length
                      ? (editingProject.highlights as string[])
                      : [''],
                  }}
                  loading={loading}
                  onSubmit={(form) => handleUpdate(editingProject.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Delete AlertDialog - rendered once, outside the loop */}
      {(() => {
        const deletingProject = projects.find((p) => p.id === deletingId);
        return (
          <AlertDialog
            open={deletingId !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deletingProject
                    ? `This will permanently remove "${deletingProject.name}" and all its highlights. This cannot be undone.`
                    : 'This will permanently remove this project. This cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deletingId) handleDelete(deletingId);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </div>
  );
}

function ProjectForm({
  initial,
  loading,
  onSubmit,
  onCancel,
}: {
  initial: ProjectFormState;
  loading: boolean;
  onSubmit: (form: ProjectFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState<ProjectFormState>(initial);

  function updateField(field: keyof ProjectFormState, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addHighlight() {
    setForm((prev) => ({
      ...prev,
      highlights: [...prev.highlights, ''],
    }));
  }

  function updateHighlight(index: number, value: string) {
    setForm((prev) => {
      const highlights = [...prev.highlights];
      highlights[index] = value;
      return { ...prev, highlights };
    });
  }

  function removeHighlight(index: number) {
    setForm((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Project Name *</Label>
        <Input
          placeholder="e.g. Open Source CLI Tool"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Description *</Label>
        <textarea
          rows={3}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          placeholder="Describe your project..."
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>URL</Label>
        <Input
          type="url"
          placeholder="https://github.com/..."
          value={form.url}
          onChange={(e) => updateField('url', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Skills (comma-separated)</Label>
        <Input
          placeholder="e.g. React, TypeScript, GraphQL"
          value={form.skills}
          onChange={(e) => updateField('skills', e.target.value)}
        />
      </div>

      {/* Highlights */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Highlights</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addHighlight}>
            <Plus className="h-3.5 w-3.5" />
            Add Highlight
          </Button>
        </div>
        <div className="space-y-2">
          {form.highlights.map((highlight, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={`Highlight #${i + 1}`}
                value={highlight}
                onChange={(e) => updateHighlight(i, e.target.value)}
              />
              {form.highlights.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHighlight(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button
          type="button"
          disabled={loading || !form.name || !form.description}
          onClick={() => onSubmit(form)}
        >
          <Save className="h-4 w-4" />
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ─── Tab 5: Preferences ──────────────────────────────────────────────────────

interface PreferenceFormState {
  key: string;
  value: string;
  category: string;
}

const emptyPreferenceForm: PreferenceFormState = {
  key: '',
  value: '',
  category: 'role',
};

function PreferencesTab({
  preferences,
  candidate,
}: {
  preferences: Preference[];
  candidate: Candidate;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState('');

  // Avoided companies state
  const [avoidedCompanies, setAvoidedCompanies] = React.useState<string[]>(
    (candidate as any).avoidedCompanies ?? [],
  );
  const [newCompany, setNewCompany] = React.useState('');
  const [savingAvoided, setSavingAvoided] = React.useState(false);

  function showSuccessMsg(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  // Group by category
  const grouped = React.useMemo(() => {
    const map = new Map<string, Preference[]>();
    for (const pref of preferences) {
      const cat = pref.category ?? 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(pref);
    }
    return map;
  }, [preferences]);

  async function handleAdd(form: PreferenceFormState) {
    setLoading(true);
    try {
      await api.preferences.add({
        key: form.key,
        value: form.value,
        category: form.category,
      });
      setShowAdd(false);
      showSuccessMsg('Preference added successfully.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id: string, form: PreferenceFormState) {
    setLoading(true);
    try {
      await api.preferences.update({
        preferenceId: id,
        key: form.key,
        value: form.value,
        category: form.category,
      });
      setEditingId(null);
      showSuccessMsg('Preference updated successfully.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await api.preferences.delete({ preferenceId: id });
      setDeletingId(null);
      showSuccessMsg('Preference deleted.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAvoidedCompany() {
    const name = newCompany.trim();
    if (!name || avoidedCompanies.includes(name)) return;
    const updated = [...avoidedCompanies, name];
    setSavingAvoided(true);
    try {
      await api.candidates.update({ avoidedCompanies: updated });
      setAvoidedCompanies(updated);
      setNewCompany('');
      showSuccessMsg(`"${name}" added to avoided companies.`);
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setSavingAvoided(false);
    }
  }

  async function handleRemoveAvoidedCompany(name: string) {
    const updated = avoidedCompanies.filter((c) => c !== name);
    setSavingAvoided(true);
    try {
      await api.candidates.update({ avoidedCompanies: updated });
      setAvoidedCompanies(updated);
      showSuccessMsg(`"${name}" removed from avoided companies.`);
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setSavingAvoided(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="text-muted-foreground h-5 w-5" />
        <h2 className="text-lg font-semibold">Preferences</h2>
      </div>

      {success && <SuccessBanner message={success} />}

      {/* ─── Avoided Companies ─────────────────────────────────────── */}
      <Card className="rounded-xl shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-500" />
            <CardTitle className="text-base">Avoided Companies</CardTitle>
          </div>
          <CardDescription>
            Companies you don't want to apply to. Jobs from these companies will be flagged with a
            warning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Company name..."
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAvoidedCompany();
                }
              }}
              disabled={savingAvoided}
            />
            <Button
              size="sm"
              className="shrink-0"
              disabled={savingAvoided || !newCompany.trim()}
              onClick={handleAddAvoidedCompany}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {avoidedCompanies.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {avoidedCompanies.map((company) => (
                <Badge key={company} variant="secondary" className="gap-1 pr-1 text-sm">
                  {company}
                  <button
                    type="button"
                    onClick={() => handleRemoveAvoidedCompany(company)}
                    className="hover:bg-destructive/20 hover:text-destructive focus:ring-ring ml-0.5 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1"
                    aria-label={`Remove ${company} from avoided companies`}
                    disabled={savingAvoided}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No companies avoided yet. Add companies you want to skip during your job search.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Custom Preferences ───────────────────────────────────── */}
      <Card className="rounded-xl shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sliders className="text-muted-foreground h-4 w-4" />
                Custom Preferences
                {preferences.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {preferences.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Additional job search criteria and personal notes. These inform AI scoring and
                tailoring.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add Dialog */}
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Preference</DialogTitle>
                <DialogDescription>Add a new job search preference.</DialogDescription>
              </DialogHeader>
              <PreferenceForm
                initial={emptyPreferenceForm}
                loading={loading}
                onSubmit={handleAdd}
                onCancel={() => setShowAdd(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Empty State */}
          {preferences.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sliders className="text-muted-foreground/20 mb-2 h-10 w-10" />
              <p className="text-muted-foreground mb-3 text-sm">
                No custom preferences set yet. Add criteria like preferred team size, tech stack
                requirements, or culture fit notes.
              </p>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" />
                Add Preference
              </Button>
            </div>
          )}

          {/* Grouped Preferences */}
          {PREFERENCE_CATEGORIES.map(({ value: catValue, label: catLabel }) => {
            const catPrefs = grouped.get(catValue);
            if (!catPrefs || catPrefs.length === 0) return null;

            return (
              <div key={catValue} className="space-y-2">
                <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  {catLabel}
                </h4>
                {catPrefs.map((pref) => (
                  <div key={pref.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{pref.key}</span>
                        <p className="text-muted-foreground mt-0.5 text-sm">{pref.value}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingId(pref.id)}
                          aria-label={`Edit ${pref.key}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                          onClick={() => setDeletingId(pref.id)}
                          aria-label={`Delete ${pref.key}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Edit Dialog - rendered once, outside the loop */}
      {(() => {
        const editingPref = preferences.find((p) => p.id === editingId);
        return (
          <Dialog
            open={editingId !== null}
            onOpenChange={(open) => {
              if (!open) setEditingId(null);
            }}
          >
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Preference</DialogTitle>
                <DialogDescription>Update this preference entry.</DialogDescription>
              </DialogHeader>
              {editingPref && (
                <PreferenceForm
                  key={editingPref.id}
                  initial={{
                    key: editingPref.key,
                    value: editingPref.value,
                    category: editingPref.category ?? 'other',
                  }}
                  loading={loading}
                  onSubmit={(form) => handleUpdate(editingPref.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Delete AlertDialog - rendered once, outside the loop */}
      {(() => {
        const deletingPref = preferences.find((p) => p.id === deletingId);
        return (
          <AlertDialog
            open={deletingId !== null}
            onOpenChange={(open) => {
              if (!open) setDeletingId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Preference?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deletingPref
                    ? `This will permanently remove "${deletingPref.key}". This action cannot be undone.`
                    : 'This will permanently remove this preference. This action cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deletingId) handleDelete(deletingId);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </div>
  );
}

function PreferenceForm({
  initial,
  loading,
  onSubmit,
  onCancel,
}: {
  initial: PreferenceFormState;
  loading: boolean;
  onSubmit: (form: PreferenceFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState<PreferenceFormState>(initial);

  function updateField(field: keyof PreferenceFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Key *</Label>
          <Input
            placeholder="e.g. Team Size, Tech Stack"
            value={form.key}
            onChange={(e) => updateField('key', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Value *</Label>
          <Input
            placeholder="e.g. 5-20 people, React + Node"
            value={form.value}
            onChange={(e) => updateField('value', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <select
            className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
            value={form.category}
            onChange={(e) => updateField('category', e.target.value)}
          >
            {PREFERENCE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={loading || !form.key || !form.value}
          onClick={() => onSubmit(form)}
        >
          <Save className="h-4 w-4" />
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ─── Resume Sidebar ──────────────────────────────────────────────────────────

// ─── Resume Parse Preview ─────────────────────────────────────────────────

interface ParsedResumeData {
  headline: string;
  summary: string;
  yearsOfExperience: number;
  currentTitle: string;
  currentCompany: string | null;
  location: string;
  skills: Array<{
    name: string;
    category: string;
    confidenceScore: number;
    yearsUsed: number | null;
  }>;
  experience: Array<{
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string | null;
    current: boolean;
    description: string;
    bullets: string[];
    skills: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    url: string | null;
    skills: string[];
    highlights: string[];
  }>;
}

function ResumeParsePreview({
  resumeId,
  parsedData,
  onClose,
}: {
  resumeId: string;
  parsedData: ParsedResumeData;
  onClose: () => void;
}) {
  const router = useRouter();
  const [applying, setApplying] = React.useState(false);
  const [applied, setApplied] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showSkills, setShowSkills] = React.useState(true);
  const [showExperience, setShowExperience] = React.useState(true);
  const [showProjects, setShowProjects] = React.useState(true);

  // Editable local state initialized from parsed data
  const [editData, setEditData] = React.useState<ParsedResumeData>(() => ({
    ...parsedData,
    skills: parsedData.skills.map((s) => ({ ...s })),
    experience: parsedData.experience.map((e) => ({
      ...e,
      bullets: [...e.bullets],
      skills: [...e.skills],
    })),
    projects: parsedData.projects.map((p) => ({
      ...p,
      skills: [...p.skills],
      highlights: [...p.highlights],
    })),
  }));

  function updateProfile(field: keyof ParsedResumeData, value: unknown) {
    setEditData((prev) => ({ ...prev, [field]: value }));
  }

  function removeSkill(index: number) {
    setEditData((prev) => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  }

  function removeExperience(index: number) {
    setEditData((prev) => ({ ...prev, experience: prev.experience.filter((_, i) => i !== index) }));
  }

  function updateExperience(index: number, field: string, value: unknown) {
    setEditData((prev) => ({
      ...prev,
      experience: prev.experience.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    }));
  }

  function updateExperienceBullet(expIndex: number, bulletIndex: number, value: string) {
    setEditData((prev) => ({
      ...prev,
      experience: prev.experience.map((e, i) => {
        if (i !== expIndex) return e;
        const bullets = [...e.bullets];
        bullets[bulletIndex] = value;
        return { ...e, bullets };
      }),
    }));
  }

  function removeExperienceBullet(expIndex: number, bulletIndex: number) {
    setEditData((prev) => ({
      ...prev,
      experience: prev.experience.map((e, i) => {
        if (i !== expIndex) return e;
        return { ...e, bullets: e.bullets.filter((_, j) => j !== bulletIndex) };
      }),
    }));
  }

  function removeProject(index: number) {
    setEditData((prev) => ({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }));
  }

  function updateProject(index: number, field: string, value: unknown) {
    setEditData((prev) => ({
      ...prev,
      projects: prev.projects.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    }));
  }

  async function handleApply() {
    setApplying(true);
    setError('');
    try {
      await api.ai.applyParsedResume({
        resumeId,
        parsedData: editData,
      });
      setApplied(true);
      router.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply parsed data');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-sky-300 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-sky-600" />
          <h4 className="font-semibold">Parsed Resume Data</h4>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Review and edit the parsed data below before applying it to your profile.
      </p>

      {error && (
        <div className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {applied && <SuccessBanner message="Resume data applied to your profile successfully." />}

      {/* Actions - shown at top for visibility */}
      {!applied ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={applying} onClick={handleApply} className="flex-1">
            {applying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Apply to Profile
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Dismiss
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={onClose} className="w-full">
          Close
        </Button>
      )}

      <Separator />

      {/* Editable Profile Fields */}
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Profile
        </div>
        <div className="bg-background/60 space-y-3 rounded-lg p-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Headline</Label>
            <Input
              value={editData.headline}
              onChange={(e) => updateProfile('headline', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Title</Label>
              <Input
                value={editData.currentTitle}
                onChange={(e) => updateProfile('currentTitle', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Company</Label>
              <Input
                value={editData.currentCompany || ''}
                onChange={(e) => updateProfile('currentCompany', e.target.value || null)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Location</Label>
              <Input
                value={editData.location}
                onChange={(e) => updateProfile('location', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Years of Experience</Label>
              <Input
                type="number"
                min={0}
                value={editData.yearsOfExperience}
                onChange={(e) => updateProfile('yearsOfExperience', parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Summary</Label>
            <Textarea
              value={editData.summary}
              onChange={(e) => updateProfile('summary', e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* Skills - editable with remove */}
      {editData.skills.length > 0 && (
        <div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mb-2 flex w-full items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors"
            onClick={() => setShowSkills(!showSkills)}
          >
            {showSkills ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Skills ({editData.skills.length})
          </button>
          {showSkills && (
            <div className="flex flex-wrap gap-1.5">
              {editData.skills.map((skill, i) => (
                <Badge key={i} variant="secondary" className="gap-1 py-1 pr-1 text-xs">
                  {skill.name}
                  {skill.category && (
                    <span className="capitalize opacity-50">({skill.category})</span>
                  )}
                  {skill.yearsUsed != null && (
                    <span className="text-sky-600">{skill.yearsUsed}y</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSkill(i)}
                    className="hover:bg-destructive/20 hover:text-destructive ml-0.5 rounded-full p-0.5 transition-colors"
                    aria-label={`Remove ${skill.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Experience - editable */}
      {editData.experience.length > 0 && (
        <div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mb-2 flex w-full items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors"
            onClick={() => setShowExperience(!showExperience)}
          >
            {showExperience ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Experience ({editData.experience.length})
          </button>
          {showExperience && (
            <div className="space-y-3">
              {editData.experience.map((exp, i) => (
                <div
                  key={i}
                  className="bg-background/60 space-y-2 rounded-lg border-l-2 border-sky-400 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={exp.title}
                        onChange={(e) => updateExperience(i, 'title', e.target.value)}
                        placeholder="Job title"
                        className="h-7 text-sm font-semibold"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={exp.company}
                          onChange={(e) => updateExperience(i, 'company', e.target.value)}
                          placeholder="Company"
                          className="h-7 text-xs"
                        />
                        <Input
                          value={exp.location}
                          onChange={(e) => updateExperience(i, 'location', e.target.value)}
                          placeholder="Location"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 h-7 w-7 shrink-0"
                      onClick={() => removeExperience(i)}
                      aria-label={`Remove ${exp.title} at ${exp.company}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {exp.startDate && (
                    <p className="text-muted-foreground text-xs">
                      {formatDisplayDate(exp.startDate)} &mdash;{' '}
                      {exp.current ? 'Present' : formatDisplayDate(exp.endDate)}
                    </p>
                  )}
                  {exp.bullets && exp.bullets.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Bullets</Label>
                      {exp.bullets.map((bullet, j) => (
                        <div key={j} className="flex items-start gap-1">
                          <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                          <Input
                            value={bullet}
                            onChange={(e) => updateExperienceBullet(i, j, e.target.value)}
                            className="h-7 flex-1 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
                            onClick={() => removeExperienceBullet(i, j)}
                            aria-label="Remove bullet"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {exp.skills && exp.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {exp.skills.map((skill, j) => (
                        <Badge key={j} variant="outline" className="py-0 text-[10px]">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Projects - editable */}
      {editData.projects.length > 0 && (
        <div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mb-2 flex w-full items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors"
            onClick={() => setShowProjects(!showProjects)}
          >
            {showProjects ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Projects ({editData.projects.length})
          </button>
          {showProjects && (
            <div className="space-y-2">
              {editData.projects.map((proj, i) => (
                <div
                  key={i}
                  className="bg-background/60 space-y-2 rounded-lg border-l-2 border-sky-400 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      value={proj.name}
                      onChange={(e) => updateProject(i, 'name', e.target.value)}
                      placeholder="Project name"
                      className="h-7 flex-1 text-sm font-semibold"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 h-7 w-7 shrink-0"
                      onClick={() => removeProject(i)}
                      aria-label={`Remove ${proj.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={proj.description}
                    onChange={(e) => updateProject(i, 'description', e.target.value)}
                    placeholder="Description"
                    rows={2}
                    className="resize-none text-xs"
                  />
                  {proj.skills && proj.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {proj.skills.map((skill, j) => (
                        <Badge key={j} variant="outline" className="py-0 text-[10px]">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Resume Sidebar ──────────────────────────────────────────────────────────

function ResumeSidebar({ resumes }: { resumes: Resume[] }) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [loadingAction, setLoadingAction] = React.useState(false);
  const [parsingId, setParsingId] = React.useState<string | null>(null);
  const [parsedResult, setParsedResult] = React.useState<{
    resumeId: string;
    data: ParsedResumeData;
  } | null>(null);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  function validateFile(file: File): string | null {
    if (!ALLOWED_RESUME_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload a PDF, DOCX, or TXT file.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File is too large. Maximum size is 10MB.';
    }
    return null;
  }

  async function handleUpload(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError('');

    try {
      // 1. Get presigned URL
      const { uploadUrl, storageKey } = await api.resumes.getUploadUrl({
        fileName: file.name,
        contentType: file.type,
      });

      // 2. Upload file to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      // 3. Create resume record
      await api.resumes.create({
        name: file.name,
        storageKey,
        contentType: file.type,
      });

      captureEvent('resume_uploaded', { fileName: file.name, contentType: file.type });
      showSuccess('Resume uploaded successfully.');
      router.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload resume');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  async function handleDownload(resumeId: string) {
    try {
      const { url } = await api.resumes.getDownloadUrl(resumeId);
      window.open(url, '_blank');
    } catch {
      setError('Failed to get download URL.');
    }
  }

  async function handleSetPreferred(resumeId: string) {
    setLoadingAction(true);
    try {
      await api.resumes.setPreferred({ resumeId });
      showSuccess('Preferred resume updated.');
      router.invalidate();
    } catch {
      setError('Failed to set preferred resume.');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDelete(resumeId: string) {
    setLoadingAction(true);
    try {
      await api.resumes.delete({ resumeId });
      setDeletingId(null);
      showSuccess('Resume deleted.');
      router.invalidate();
    } catch {
      setError('Failed to delete resume.');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleParseResume(resumeId: string) {
    setParsingId(resumeId);
    setError('');
    setParsedResult(null);
    try {
      const result = await api.ai.parseResume({ resumeId });
      captureEvent('resume_parsed', { resumeId });
      setParsedResult({ resumeId, data: result as ParsedResumeData });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse resume.');
    } finally {
      setParsingId(null);
    }
  }

  function getTypeBadge(type: string | null | undefined) {
    switch (type) {
      case 'pdf':
        return <Badge variant="default">PDF</Badge>;
      case 'docx':
        return <Badge variant="secondary">DOCX</Badge>;
      case 'txt':
        return <Badge variant="outline">TXT</Badge>;
      default:
        return <Badge variant="outline">{type ?? 'File'}</Badge>;
    }
  }

  return (
    <Card className="sticky top-6 rounded-xl shadow">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground h-5 w-5" />
          <CardTitle className="text-base">Resumes</CardTitle>
        </div>
        <CardDescription>Upload and manage your resume files.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {success && <SuccessBanner message={success} />}

        {/* Parse Preview */}
        {parsedResult && (
          <ResumeParsePreview
            resumeId={parsedResult.resumeId}
            parsedData={parsedResult.data}
            onClose={() => setParsedResult(null)}
          />
        )}

        {/* Upload Zone */}
        <div
          className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            dragOver
              ? 'border-sky-500 bg-white'
              : 'border-muted-foreground/25 hover:bg-muted/50 hover:border-sky-400'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Upload className="text-muted-foreground/40 mb-2 h-8 w-8" />
          {uploading ? (
            <p className="text-muted-foreground text-center text-sm">Uploading...</p>
          ) : (
            <>
              <p className="text-center text-sm font-medium">Drop a resume here</p>
              <p className="text-muted-foreground mt-1 text-center text-xs">
                PDF, DOCX, or TXT (max 10MB)
              </p>
            </>
          )}
        </div>

        {/* Resume List */}
        {resumes.length > 0 && (
          <div className="space-y-3">
            <Separator />
            {resumes.map((resume) => (
              <div key={resume.id} className="bg-muted/30 space-y-2 rounded-lg border p-3">
                {/* Delete Confirmation */}
                {deletingId === resume.id && (
                  <div className="rounded-lg border border-red-300 bg-white p-3">
                    <p className="mb-2 text-xs font-medium text-red-700">Delete this resume?</p>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={loadingAction}
                        onClick={() => handleDelete(resume.id)}
                      >
                        Delete
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Parsing Loading State */}
                {parsingId === resume.id && (
                  <div className="rounded-lg border border-sky-300 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                      <p className="text-xs font-medium text-sky-700">Analyzing flight manual...</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {resume.isPreferred && (
                        <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                      )}
                      <p className="truncate text-sm font-medium">{resume.name}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {getTypeBadge(resume.type)}
                      {resume.createdAt && (
                        <span className="text-muted-foreground text-xs">
                          {new Date(resume.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleDownload(resume.id)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-sky-600 hover:text-sky-700"
                    disabled={parsingId !== null}
                    onClick={() => handleParseResume(resume.id)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Parse Resume
                  </Button>
                  {!resume.isPreferred && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={loadingAction}
                      onClick={() => handleSetPreferred(resume.id)}
                    >
                      <Star className="h-3.5 w-3.5" />
                      Set Preferred
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                    onClick={() => setDeletingId(resume.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Resume Library ──────────────────────────────────────────────────────────

function ResumeLibrary() {
  const [tailoredResumes, setTailoredResumes] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);
  const [exportingId, setExportingId] = React.useState<string | null>(null);

  async function handleExport(jobId: string, resumeId: string) {
    setExportingId(resumeId);
    try {
      const result = await api.resumeRenderer.export({ jobId });
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(result.html);
        printWindow.document.close();
      }
    } catch (err) {
      console.error('Failed to export resume:', err);
    } finally {
      setExportingId(null);
    }
  }

  React.useEffect(() => {
    api.ai
      .getResumeLibrary()
      .then(setTailoredResumes)
      .catch(() => setTailoredResumes([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (tailoredResumes.length === 0) return null;

  // Group by job
  const byJob = tailoredResumes.reduce(
    (acc: Record<string, any[]>, r: any) => {
      if (!acc[r.jobId]) acc[r.jobId] = [];
      acc[r.jobId].push(r);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  const jobEntries = Object.entries(byJob);

  return (
    <Card className="rounded-xl shadow">
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="text-muted-foreground h-5 w-5" />
            <CardTitle className="text-base">Resume Library</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {tailoredResumes.length}
            </Badge>
          </div>
          {expanded ? (
            <ChevronUp className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          )}
        </div>
        <CardDescription>
          All tailored resume versions across your job applications.
        </CardDescription>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3 pt-0">
          {jobEntries.map(([jobId, versions]) => {
            const latest = versions[0]; // Already sorted by createdAt desc
            return (
              <div key={jobId} className="bg-muted/30 space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{latest.jobTitle}</p>
                    <p className="text-muted-foreground text-xs">{latest.jobCompany}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {versions.length} version{versions.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                {/* Version list */}
                <div className="space-y-1">
                  {versions.map((v: any) => (
                    <div
                      key={v.id}
                      className="hover:bg-muted/60 group flex items-center justify-between rounded px-2 py-1.5 text-xs transition-colors"
                    >
                      <a
                        href={`/jobs/${v.jobId}`}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <FileText className="text-muted-foreground h-3 w-3 shrink-0" />
                        <span className="truncate">v{v.version}</span>
                        {v.skillCount > 0 && (
                          <span className="text-muted-foreground">{v.skillCount} skills</span>
                        )}
                      </a>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-muted-foreground">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleExport(v.jobId, v.id)}
                          disabled={exportingId === v.id}
                          title="Export / Print"
                        >
                          {exportingId === v.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Printer className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {latest.summary && (
                  <p className="text-muted-foreground line-clamp-2 text-xs italic">
                    {latest.summary}...
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
