import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Badge, Button, Input, Label } from '@job-pilot/ui';

interface QuickAddData {
  company: string;
  jobTitle: string;
  dateApplied: string;
  compMin: string;
  compMax: string;
  equityDetails: string;
  source: string;
  status: string;
  statusNote: string;
}

interface QuickAddFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: QuickAddData) => Promise<void>;
  prefill?: Partial<QuickAddData>;
}

const SOURCE_OPTIONS = [
  { value: 'other', label: 'Other' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'company_site', label: 'Company Site' },
  { value: 'referral', label: 'Referral' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'job_pilot', label: 'Job Pilot' },
];

const STATUS_OPTIONS = [
  { value: 'discovered', label: 'Discovered' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'applied', label: 'Applied' },
  { value: 'recruiter_screen', label: 'Recruiter Screen' },
  { value: 'technical', label: 'Technical' },
  { value: 'onsite', label: 'Onsite' },
  { value: 'final', label: 'Final' },
  { value: 'offer', label: 'Offer' },
];

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm';

function getDefaultFormState(prefill?: Partial<QuickAddData>): QuickAddData {
  return {
    company: prefill?.company ?? '',
    jobTitle: prefill?.jobTitle ?? '',
    dateApplied: prefill?.dateApplied ?? new Date().toISOString().split('T')[0],
    compMin: prefill?.compMin ?? '',
    compMax: prefill?.compMax ?? '',
    equityDetails: prefill?.equityDetails ?? '',
    source: prefill?.source ?? 'other',
    status: prefill?.status ?? 'applied',
    statusNote: prefill?.statusNote ?? '',
  };
}

export function QuickAddForm({ open, onClose, onSubmit, prefill }: QuickAddFormProps) {
  const [form, setForm] = useState<QuickAddData>(() => getDefaultFormState(prefill));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  function updateField(field: keyof QuickAddData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.company.trim()) {
      setError('Company is required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose}>
      <div
        className="bg-card mx-auto mt-20 max-w-md rounded-xl border p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="text-muted-foreground h-4 w-4" />
            <h3 className="text-lg font-semibold">Quick Add Application</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Company - full width */}
          <div>
            <Label htmlFor="qa-company">
              Company <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qa-company"
              value={form.company}
              onChange={(e) => updateField('company', e.target.value)}
              placeholder="Company name"
              autoFocus
            />
          </div>

          {/* Job Title - full width */}
          <div>
            <Label htmlFor="qa-job-title">Job Title</Label>
            <Input
              id="qa-job-title"
              value={form.jobTitle}
              onChange={(e) => updateField('jobTitle', e.target.value)}
              placeholder="Position title"
            />
          </div>

          {/* Date Applied + Source - 2 column */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qa-date">Date Applied</Label>
              <Input
                id="qa-date"
                type="date"
                value={form.dateApplied}
                onChange={(e) => updateField('dateApplied', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="qa-source">Source</Label>
              <select
                id="qa-source"
                className={selectClassName}
                value={form.source}
                onChange={(e) => updateField('source', e.target.value)}
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comp Min + Comp Max - 2 column */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qa-comp-min">Comp Min</Label>
              <Input
                id="qa-comp-min"
                type="number"
                value={form.compMin}
                onChange={(e) => updateField('compMin', e.target.value)}
                placeholder="$"
              />
            </div>
            <div>
              <Label htmlFor="qa-comp-max">Comp Max</Label>
              <Input
                id="qa-comp-max"
                type="number"
                value={form.compMax}
                onChange={(e) => updateField('compMax', e.target.value)}
                placeholder="$"
              />
            </div>
          </div>

          {/* Equity Details - full width */}
          <div>
            <Label htmlFor="qa-equity">Equity Details</Label>
            <Input
              id="qa-equity"
              value={form.equityDetails}
              onChange={(e) => updateField('equityDetails', e.target.value)}
              placeholder="e.g. 0.1% over 4yr"
            />
          </div>

          {/* Status - half width row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qa-status">Status</Label>
              <select
                id="qa-status"
                className={selectClassName}
                value={form.status}
                onChange={(e) => updateField('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div />
          </div>

          {/* Status Note - full width */}
          <div>
            <Label htmlFor="qa-status-note">Status Note</Label>
            <Input
              id="qa-status-note"
              value={form.statusNote}
              onChange={(e) => updateField('statusNote', e.target.value)}
              placeholder="Your honest take..."
            />
          </div>

          {/* Error message */}
          {error && <div className="text-destructive text-sm">{error}</div>}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
