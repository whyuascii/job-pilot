import * as React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Building2, Calendar, ChevronDown, ChevronUp, FileText, Plane, Target } from 'lucide-react';
import { Badge, Button, Card, CardContent, Separator } from '@job-pilot/ui';
import { FlightRecordViewer } from '~/components/flight-record-viewer';
import { api } from '~/lib/api-client';

export const Route = createFileRoute('/flight-records')({
  loader: async () => {
    const records = await api.flightRecords.list();
    return { records };
  },
  component: FlightRecordsPage,
});

function FlightRecordSummaryCard({ record }: { record: any }) {
  const [expanded, setExpanded] = React.useState(false);

  const jobTitle = record.jobTitle || record.jobSnapshot?.title || 'Unknown Position';
  const jobCompany = record.jobCompany || record.jobSnapshot?.company || 'Unknown Company';
  const score = record.scoreSnapshot?.overallScore;
  const appliedDate = record.appliedAt || record.createdAt;

  return (
    <Card>
      <CardContent className="p-0">
        {/* Summary row — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="hover:bg-accent/50 flex w-full items-center justify-between gap-4 rounded-t-xl px-4 py-3 text-left transition-colors"
        >
          <div className="flex min-w-0 items-center gap-3">
            <FileText
              className={`h-4 w-4 shrink-0 ${record.hasFlightRecord ? 'text-sky-500' : 'text-muted-foreground'}`}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{jobTitle}</p>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {jobCompany}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(appliedDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {record.status && !record.hasFlightRecord && (
              <Badge variant="secondary" className="text-[10px] capitalize">
                {record.status}
              </Badge>
            )}
            {score != null && (
              <Badge variant={score >= 60 ? 'success' : score >= 40 ? 'default' : 'warning'}>
                <Target className="mr-1 h-3 w-3" />
                {Math.round(score)}%
              </Badge>
            )}
            {record.scoreSnapshot?.recommendation && (
              <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
                {record.scoreSnapshot.recommendation}
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </div>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t px-4 py-3">
            {record.hasFlightRecord ? (
              <FlightRecordViewer record={record} bare />
            ) : (
              <div className="space-y-3 py-2">
                {/* Score info */}
                {record.scoreSnapshot && (
                  <div className="flex items-center gap-4 rounded-md border px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Score:</span>
                    {record.scoreSnapshot.overallScore != null && (
                      <span className="font-semibold">
                        {Math.round(record.scoreSnapshot.overallScore)}% overall
                      </span>
                    )}
                    {record.scoreSnapshot.fitScore != null && (
                      <span className="text-muted-foreground">
                        Fit: {Math.round(record.scoreSnapshot.fitScore)}%
                      </span>
                    )}
                    {record.scoreSnapshot.competitivenessScore != null && (
                      <span className="text-muted-foreground">
                        Competitive: {Math.round(record.scoreSnapshot.competitivenessScore)}%
                      </span>
                    )}
                  </div>
                )}
                {/* Job skills */}
                {record.jobSnapshot?.mustHaveSkills?.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                      Required Skills
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {record.jobSnapshot.mustHaveSkills.map((skill: string) => (
                        <Badge key={skill} variant="secondary" className="text-[10px]">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-muted-foreground text-xs italic">
                  No snapshot captured. Use "Mark Applied" in the Application Assist drawer to
                  capture a full snapshot with tailored resume and cover letter.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FlightRecordsPage() {
  const { records } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
            <Plane className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Flight Records</h1>
            <p className="text-muted-foreground text-sm">
              Your application history — snapshots of resume, cover letter, score, and job data.
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Records list */}
      {records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <FileText className="text-muted-foreground/30 h-12 w-12" />
            <div className="space-y-1 text-center">
              <p className="font-semibold">No applications yet</p>
              <p className="text-muted-foreground text-sm">
                Apply to jobs or create applications to start building your flight log.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/jobs">Browse Jobs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {records.length} flight record{records.length !== 1 ? 's' : ''}
          </p>
          {records.map((record: any) => (
            <FlightRecordSummaryCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
