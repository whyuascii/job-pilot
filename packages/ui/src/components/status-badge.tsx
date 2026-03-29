import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils.js';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
  {
    variants: {
      status: {
        discovered: 'bg-white border border-sky-300 text-sky-700',
        shortlisted: 'bg-white border border-sky-300 text-sky-700',
        resume_generated: 'bg-white border border-blue-300 text-blue-700',
        applied: 'bg-white border border-indigo-300 text-indigo-700',
        recruiter_screen: 'bg-white border border-violet-300 text-violet-700',
        technical: 'bg-white border border-purple-300 text-purple-700',
        onsite: 'bg-white border border-amber-300 text-amber-700',
        final: 'bg-white border border-rose-300 text-rose-700',
        rejected: 'bg-white border border-red-300 text-red-700',
        offer: 'bg-white border border-emerald-300 text-emerald-700',
        withdrawn: 'bg-white border border-border text-muted-foreground',
      },
    },
    defaultVariants: {
      status: 'discovered',
    },
  },
);

const statusLabels: Record<string, string> = {
  discovered: 'Saved',
  shortlisted: 'Shortlisted',
  resume_generated: 'Resume Ready',
  applied: 'Applied',
  recruiter_screen: 'Phone Screen',
  technical: 'Technical Interview',
  onsite: 'Onsite Interview',
  final: 'Final Round',
  rejected: 'Rejected',
  offer: 'Offer Received',
  withdrawn: 'Withdrawn',
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusBadgeVariants> {
  showDot?: boolean;
}

function StatusBadge({ className, status, showDot = true, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ status }), className)} {...props}>
      {showDot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {statusLabels[status ?? 'discovered'] ?? status}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants, statusLabels };
