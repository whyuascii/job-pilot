import * as React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plane, FileText, Building2, Calendar, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Card, CardContent, Badge, Separator } from '@job-pilot/ui';
import { api } from '~/lib/api-client';
import { FlightRecordViewer } from '~/components/flight-record-viewer';

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
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-accent/50 transition-colors rounded-t-xl"
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileText className={`h-4 w-4 shrink-0 ${record.hasFlightRecord ? 'text-sky-500' : 'text-muted-foreground'}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{jobTitle}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
          <div className="flex items-center gap-2 shrink-0">
            {record.status && !record.hasFlightRecord && (
              <Badge variant="secondary" className="text-[10px] capitalize">
                {record.status}
              </Badge>
            )}
            {score != null && (
              <Badge variant={score >= 60 ? 'success' : score >= 40 ? 'default' : 'warning'}>
                <Target className="h-3 w-3 mr-1" />
                {Math.round(score)}%
              </Badge>
            )}
            {record.scoreSnapshot?.recommendation && (
              <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
                {record.scoreSnapshot.recommendation}
              </Badge>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
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
                      <span className="font-semibold">{Math.round(record.scoreSnapshot.overallScore)}% overall</span>
                    )}
                    {record.scoreSnapshot.fitScore != null && (
                      <span className="text-muted-foreground">Fit: {Math.round(record.scoreSnapshot.fitScore)}%</span>
                    )}
                    {record.scoreSnapshot.competitivenessScore != null && (
                      <span className="text-muted-foreground">Competitive: {Math.round(record.scoreSnapshot.competitivenessScore)}%</span>
                    )}
                  </div>
                )}
                {/* Job skills */}
                {record.jobSnapshot?.mustHaveSkills?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Required Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {record.jobSnapshot.mustHaveSkills.map((skill: string) => (
                        <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground italic">
                  No snapshot captured. Use "Mark Applied" in the Application Assist drawer to capture a full snapshot with tailored resume and cover letter.
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
            <p className="text-sm text-muted-foreground">
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
            <FileText className="h-12 w-12 text-muted-foreground/30" />
            <div className="text-center space-y-1">
              <p className="font-semibold">No applications yet</p>
              <p className="text-sm text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">
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
