import * as React from 'react';

import { cn } from '../lib/utils.js';

interface ScoreIndicatorProps {
  score: number;
  label: string;
  maxScore?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getScoreColor(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'text-emerald-500';
  if (pct >= 60) return 'text-sky-500';
  if (pct >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreLabel(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'Cleared';
  if (pct >= 60) return 'Good';
  if (pct >= 40) return 'Fair';
  return 'Low';
}

const sizeMap = {
  sm: 'h-16 w-16 text-lg',
  md: 'h-24 w-24 text-2xl',
  lg: 'h-32 w-32 text-3xl',
} as const;

function ScoreIndicator({
  score,
  label,
  maxScore = 100,
  size = 'md',
  className,
}: ScoreIndicatorProps) {
  const pct = Math.round((score / maxScore) * 100);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className={cn('relative flex items-center justify-center', sizeMap[size])}>
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/30"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn('transition-all duration-700', getScoreColor(score, maxScore))}
          />
        </svg>
        <span className={cn('font-bold', getScoreColor(score, maxScore))}>{pct}</span>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-semibold', getScoreColor(score, maxScore))}>
        {getScoreLabel(score, maxScore)}
      </span>
    </div>
  );
}

export { ScoreIndicator };
