import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  Building2,
  Clock,
  Code,
  Cpu,
  DollarSign,
  Ghost,
  Handshake,
  MessageSquareMore,
  Phone,
  Target,
  Trophy,
} from 'lucide-react';
import { Badge, Button } from '@job-pilot/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveMission {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  status: string;
  subStatus: string | null;
  statusNote: string | null;
  lastActivityAt: string;
  daysSinceActivity: number;
  isGhosted: boolean;
  compMin: number | null;
  compMax: number | null;
  equityDetails: string | null;
  score: number | null;
}

// ─── Sub-status config ───────────────────────────────────────────────────────

const SUB_STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Phone }> =
  {
    phone_screen: {
      label: 'Phone Screen',
      className: 'border-blue-300 bg-blue-50 text-blue-700',
      icon: Phone,
    },
    coding_challenge: {
      label: 'Coding Challenge',
      className: 'border-purple-300 bg-purple-50 text-purple-700',
      icon: Code,
    },
    technical: {
      label: 'Technical',
      className: 'border-indigo-300 bg-indigo-50 text-indigo-700',
      icon: Cpu,
    },
    onsite: {
      label: 'Onsite',
      className: 'border-amber-300 bg-amber-50 text-amber-700',
      icon: Building2,
    },
    final_round: {
      label: 'Final Round',
      className: 'border-emerald-300 bg-emerald-50 text-emerald-700',
      icon: Trophy,
    },
    offer_pending: {
      label: 'Offer Pending',
      className: 'border-green-300 bg-green-50 text-green-700',
      icon: Handshake,
    },
    negotiating: {
      label: 'Negotiating',
      className: 'border-orange-300 bg-orange-50 text-orange-700',
      icon: MessageSquareMore,
    },
    ghosted: {
      label: 'Ghosted',
      className: 'border-red-300 bg-red-50 text-red-700',
      icon: Ghost,
    },
  };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatComp(min: number | null, max: number | null, equity: string | null): string | null {
  if (min == null && max == null) return null;

  const fmt = (v: number) => {
    if (v >= 1000) return `$${Math.round(v / 1000)}k`;
    return `$${v}`;
  };

  let range = '';
  if (min != null && max != null) {
    range = `${fmt(min)}-${fmt(max)}`;
  } else if (min != null) {
    range = `${fmt(min)}+`;
  } else if (max != null) {
    range = `up to ${fmt(max)}`;
  }

  if (equity) {
    range += ` + ${equity}`;
  }

  return range;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (score >= 60) return 'border-sky-300 bg-sky-50 text-sky-700';
  if (score >= 40) return 'border-amber-300 bg-amber-50 text-amber-700';
  return 'border-red-300 bg-red-50 text-red-700';
}

function getDaysColor(days: number): string {
  if (days >= 14) return 'text-red-500';
  if (days >= 7) return 'text-amber-500';
  return 'text-muted-foreground';
}

// ─── Mission Card ────────────────────────────────────────────────────────────

function MissionCard({ mission }: { mission: ActiveMission }) {
  const subConfig = mission.subStatus ? SUB_STATUS_CONFIG[mission.subStatus] : null;
  const comp = formatComp(mission.compMin, mission.compMax, mission.equityDetails);
  const SubIcon = subConfig?.icon;

  return (
    <Link
      to="/applications/$applicationId"
      params={{ applicationId: mission.id }}
      className="bg-card group block rounded-lg border p-3 transition-colors hover:border-sky-200 hover:bg-sky-50/30"
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left: company + title */}
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold transition-colors group-hover:text-sky-700">
            {mission.jobCompany}
          </p>
          <p className="text-muted-foreground truncate text-xs">{mission.jobTitle}</p>
        </div>

        {/* Right: score badge */}
        {mission.score != null && (
          <Badge className={`shrink-0 text-[10px] ${getScoreColor(mission.score)}`}>
            <Target className="mr-0.5 h-2.5 w-2.5" />
            {mission.score}%
          </Badge>
        )}
      </div>

      {/* Middle row: sub-status + ghosted indicator */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {subConfig && (
          <Badge className={`gap-1 text-[10px] ${subConfig.className}`}>
            {SubIcon && <SubIcon className="h-2.5 w-2.5" />}
            {subConfig.label}
          </Badge>
        )}
        {mission.isGhosted && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600">
            <Ghost className="h-3 w-3" />
            Ghosted {mission.daysSinceActivity}d
          </span>
        )}
      </div>

      {/* Status note */}
      {mission.statusNote && (
        <p className="text-muted-foreground mt-1.5 truncate text-[11px]">{mission.statusNote}</p>
      )}

      {/* Bottom row: days since activity + comp */}
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
        <span className={`flex items-center gap-1 ${getDaysColor(mission.daysSinceActivity)}`}>
          <Clock className="h-2.5 w-2.5" />
          {mission.daysSinceActivity === 0
            ? 'Today'
            : mission.daysSinceActivity === 1
              ? '1 day ago'
              : `${mission.daysSinceActivity}d ago`}
        </span>
        {comp && (
          <span className="text-muted-foreground flex items-center gap-0.5">
            <DollarSign className="h-2.5 w-2.5" />
            {comp}
          </span>
        )}
      </div>
    </Link>
  );
}

// ─── Active Missions ─────────────────────────────────────────────────────────

const MAX_VISIBLE = 15;

export function ActiveMissions({ missions }: { missions: ActiveMission[] }) {
  const visible = missions.slice(0, MAX_VISIBLE);
  const hasMore = missions.length > MAX_VISIBLE;

  if (missions.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 text-center shadow">
        <p className="text-foreground mb-1 text-sm font-semibold">No Active Missions</p>
        <p className="text-muted-foreground text-xs">
          Applied jobs will appear here so you can track their progress.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border shadow">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-foreground text-sm font-semibold">Active Missions</h2>
          <Badge variant="secondary" className="text-[10px]">
            {missions.length}
          </Badge>
        </div>
        <Link to="/applications">
          <Button variant="ghost" size="sm" className="text-muted-foreground h-7 gap-1 text-xs">
            View all
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Cards grid */}
      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((mission) => (
          <MissionCard key={mission.id} mission={mission} />
        ))}
      </div>

      {/* Footer */}
      {hasMore && (
        <div className="border-t px-4 py-2 text-center">
          <Link to="/applications">
            <Button variant="link" size="sm" className="h-auto py-1 text-xs">
              View all {missions.length} active missions
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
