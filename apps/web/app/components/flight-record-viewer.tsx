import * as React from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Target,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@job-pilot/ui';
import { api } from '~/lib/api-client';

interface FlightRecord {
  id: string;
  jobId: string;
  jobTitle?: string;
  jobCompany?: string;
  jobSnapshot?: {
    title: string;
    company: string;
    location?: string;
    applyUrl?: string;
    mustHaveSkills?: string[];
    description?: string;
  } | null;
  resumeSnapshot?: any;
  coverLetterSnapshot?: string | null;
  scoreSnapshot?: {
    overallScore?: number;
    fitScore?: number;
    competitivenessScore?: number;
    recommendation?: string;
  } | null;
  appliedAt?: string | null;
  createdAt: string;
}

interface FlightRecordViewerProps {
  record: FlightRecord;
  compact?: boolean;
  /** Render without Card wrapper — for embedding inside another Card */
  bare?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-blue-600';
  if (score >= 25) return 'text-amber-600';
  return 'text-red-600';
}

function RecordDetails({ record }: { record: FlightRecord }) {
  const [showResume, setShowResume] = React.useState(false);
  const [showCoverLetter, setShowCoverLetter] = React.useState(false);

  return (
    <div className="space-y-3">
      {/* Resume snapshot toggle */}
      {record.resumeSnapshot && (
        <>
          <button
            onClick={() => setShowResume(!showResume)}
            className="hover:bg-accent flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <FileText className="h-4 w-4 text-indigo-500" />
              Tailored Resume Snapshot
            </span>
            {showResume ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showResume && (
            <div className="bg-muted/30 space-y-3 rounded-md border p-4">
              {record.resumeSnapshot.summary && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Summary</p>
                  <p className="text-sm">{record.resumeSnapshot.summary}</p>
                </div>
              )}
              {record.resumeSnapshot.highlightedSkills?.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    Highlighted Skills
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {record.resumeSnapshot.highlightedSkills.map((skill: string) => (
                      <Badge key={skill} variant="secondary" className="text-[10px]">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Cover letter toggle */}
      {record.coverLetterSnapshot && (
        <>
          <button
            onClick={() => setShowCoverLetter(!showCoverLetter)}
            className="hover:bg-accent flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <FileText className="h-4 w-4 text-emerald-500" />
              Cover Letter Snapshot
            </span>
            {showCoverLetter ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showCoverLetter && (
            <div className="bg-muted/30 rounded-md border p-4">
              <p className="whitespace-pre-wrap text-sm">{record.coverLetterSnapshot}</p>
            </div>
          )}
        </>
      )}

      {/* Score snapshot */}
      {record.scoreSnapshot && (
        <div className="flex items-center gap-4 rounded-md border px-3 py-2 text-sm">
          <span className="text-muted-foreground">Score at time of application:</span>
          {record.scoreSnapshot.overallScore != null && (
            <span className={`font-semibold ${getScoreColor(record.scoreSnapshot.overallScore)}`}>
              {record.scoreSnapshot.overallScore}% overall
            </span>
          )}
          {record.scoreSnapshot.fitScore != null && (
            <span className="text-muted-foreground">Fit: {record.scoreSnapshot.fitScore}%</span>
          )}
          {record.scoreSnapshot.competitivenessScore != null && (
            <span className="text-muted-foreground">
              Competitive: {record.scoreSnapshot.competitivenessScore}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function RecordHeader({
  record,
  onDownload,
  exporting,
}: {
  record: FlightRecord;
  onDownload: () => void;
  exporting: boolean;
}) {
  const jobTitle = record.jobTitle || record.jobSnapshot?.title || 'Unknown Position';
  const jobCompany = record.jobCompany || record.jobSnapshot?.company || 'Unknown Company';
  const score = record.scoreSnapshot?.overallScore;

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4 text-sky-500" />
            {jobTitle}
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Building2 className="h-3.5 w-3.5" />
            {jobCompany}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {score != null && (
            <Badge variant={score >= 60 ? 'success' : score >= 40 ? 'default' : 'warning'}>
              <Target className="mr-1 h-3 w-3" />
              {score}%
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onDownload}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <div className="text-muted-foreground flex items-center gap-3 pt-1 text-xs">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {record.appliedAt
            ? `Applied ${new Date(record.appliedAt).toLocaleDateString()}`
            : `Created ${new Date(record.createdAt).toLocaleDateString()}`}
        </span>
        {record.scoreSnapshot?.recommendation && (
          <Badge variant="secondary" className="text-[10px]">
            {record.scoreSnapshot.recommendation}
          </Badge>
        )}
      </div>
    </>
  );
}

export function FlightRecordViewer({ record, compact, bare }: FlightRecordViewerProps) {
  const [exporting, setExporting] = React.useState(false);

  async function handleDownloadPdf() {
    setExporting(true);
    try {
      try {
        const result = await api.rxresume?.generatePdf({ jobId: record.jobId });
        if (result?.url) {
          window.open(result.url, '_blank');
          return;
        }
      } catch {}
      const result = await api.resumeRenderer.export({ jobId: record.jobId });
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(result.html);
        printWindow.document.close();
      }
    } catch (err) {
      console.error('Failed to export resume:', err);
    } finally {
      setExporting(false);
    }
  }

  if (bare) {
    return (
      <div className="space-y-3">
        <RecordHeader record={record} onDownload={handleDownloadPdf} exporting={exporting} />
        {!compact && <RecordDetails record={record} />}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <RecordHeader record={record} onDownload={handleDownloadPdf} exporting={exporting} />
      </CardHeader>
      {!compact && (
        <CardContent>
          <RecordDetails record={record} />
        </CardContent>
      )}
    </Card>
  );
}
