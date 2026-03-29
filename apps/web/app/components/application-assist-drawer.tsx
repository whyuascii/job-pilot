import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
  Separator,
  Textarea,
} from '@job-pilot/ui';
import {
  Copy,
  Check,
  FileText,
  MessageSquare,
  User,
  RefreshCw,
  Loader2,
  Send,
  Bookmark,
  Download,
  Sparkles,
} from 'lucide-react';
import { api } from '~/lib/api-client';
import { EmailComposeDialog } from '~/components/email-compose-dialog';
import { ResumeInterview } from '~/components/resume-interview';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CandidateProfile {
  legalName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  location?: string;
  headline?: string;
  currentTitle?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  portfolioUrl?: string;
  yearsOfExperience?: number;
  salaryMin?: number;
  salaryMax?: number;
}

interface ApplicationAssistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  candidate: CandidateProfile | null;
  existingTailored: any | null;
  existingCoverLetter: { content: string; contentHtml?: string } | null;
  onMarkApplied: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md border bg-muted/30 text-sm">
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground block">{label}</span>
        <span className="font-medium truncate block">{text}</span>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0 ml-2 h-7 w-7 p-0" onClick={handleCopy}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Quick Info (Profile Clipboard)
// ---------------------------------------------------------------------------

function ProfileClipboardTab({ candidate }: { candidate: CandidateProfile | null }) {
  if (!candidate) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <User className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No candidate profile found. Complete your profile first.</p>
      </div>
    );
  }

  const displayName = candidate.preferredName || candidate.legalName;
  const fields: Array<{ label: string; value: string | undefined }> = [
    { label: 'Full Name', value: displayName },
    { label: 'Email', value: candidate.email },
    { label: 'Phone', value: candidate.phone },
    { label: 'Location', value: candidate.location },
    { label: 'Current Title', value: candidate.currentTitle || candidate.headline },
    { label: 'Headline', value: candidate.headline },
    { label: 'LinkedIn', value: candidate.linkedinUrl },
    { label: 'GitHub', value: candidate.githubUrl },
    { label: 'Website', value: candidate.websiteUrl },
    { label: 'Portfolio', value: candidate.portfolioUrl },
    { label: 'Years of Experience', value: candidate.yearsOfExperience?.toString() },
    { label: 'Salary Range', value: candidate.salaryMin && candidate.salaryMax ? `$${candidate.salaryMin.toLocaleString()} - $${candidate.salaryMax.toLocaleString()}` : candidate.salaryMin ? `$${candidate.salaryMin.toLocaleString()}+` : undefined },
  ];

  const validFields = fields.filter((f) => f.value);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">Click to copy any field to clipboard.</p>
      {validFields.map((field) => (
        <CopyButton key={field.label} label={field.label} text={field.value!} />
      ))}
      {validFields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No profile fields to display.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Resume
// ---------------------------------------------------------------------------

function ResumeTab({ job, existingTailored }: { job: any; existingTailored: any | null }) {
  const [tailored, setTailored] = React.useState<any | null>(existingTailored);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [mode, setMode] = React.useState<'preview' | 'interview'>('preview');

  React.useEffect(() => {
    if (!tailored && !loading) {
      generateResume();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateResume() {
    setLoading(true);
    try {
      const result = await api.ai.tailorResume({ jobId: job.id });
      setTailored(result);
    } catch (err) {
      console.error('Failed to tailor resume:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      // Try RxResume first, fall back to HTML export
      try {
        const result = await api.rxresume?.generatePdf({ jobId: job.id });
        if (result?.url) {
          window.open(result.url, '_blank');
          return;
        }
      } catch {}
      // Fallback: HTML export
      const result = await api.resumeRenderer.export({ jobId: job.id });
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

  async function handleDeepenResume() {
    if (!tailored) {
      // Generate first, then switch to interview
      setLoading(true);
      try {
        const result = await api.ai.tailorResume({ jobId: job.id });
        setTailored(result);
        setMode('interview');
      } catch (err) {
        console.error('Failed to tailor resume:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setMode('interview');
    }
  }

  function handleResumeUpdated(updated: any) {
    setTailored(updated);
  }

  // Interview mode
  if (mode === 'interview' && tailored) {
    return (
      <ResumeInterview
        jobId={job.id}
        tailoredResume={tailored}
        onBack={() => {
          setMode('preview');
          // Refresh the tailored resume to pick up any accepted enhancements
          api.ai.getTailoredResume(job.id).then(setTailored).catch(() => {});
        }}
        onResumeUpdated={handleResumeUpdated}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
        <p className="text-sm text-muted-foreground">Tailoring your resume...</p>
      </div>
    );
  }

  if (!tailored) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Failed to generate tailored resume.</p>
        <Button variant="outline" size="sm" onClick={generateResume}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  const content = tailored.content || tailored.contentJson;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">v{tailored.version}</Badge>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={generateResume} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Exporting...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {content?.summary && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
            <p className="text-sm">{content.summary}</p>
          </CardContent>
        </Card>
      )}

      {content?.highlightedSkills?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Key Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {content.highlightedSkills.slice(0, 12).map((skill: string) => (
              <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
            ))}
          </div>
        </div>
      )}

      {content?.experienceBlocks?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Experience Highlights</p>
          {content.experienceBlocks.slice(0, 3).map((block: any, i: number) => (
            <Card key={i}>
              <CardContent className="pt-3 pb-3">
                <p className="text-sm font-medium">{block.title}</p>
                <p className="text-xs text-muted-foreground">{block.company}</p>
                {block.bullets?.slice(0, 2).map((b: string, j: number) => (
                  <p key={j} className="text-xs text-muted-foreground mt-1">- {b}</p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Deepen Resume button */}
      <Separator />
      <Button
        variant="outline"
        size="sm"
        className="w-full border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
        onClick={handleDeepenResume}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Deepen Resume
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        AI will interview you to strengthen weak bullets with specific examples and metrics.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Cover Letter
// ---------------------------------------------------------------------------

function CoverLetterTab({ job, existingCoverLetter }: { job: any; existingCoverLetter: { content: string; contentHtml?: string } | null }) {
  const [coverLetter, setCoverLetter] = React.useState<{ content: string } | null>(existingCoverLetter);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!coverLetter && !loading) {
      generateCoverLetter();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateCoverLetter() {
    setLoading(true);
    try {
      const result = await api.coverLetter.generate({ jobId: job.id });
      setCoverLetter(result);
    } catch (err) {
      console.error('Failed to generate cover letter:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
        <p className="text-sm text-muted-foreground">Generating cover letter...</p>
      </div>
    );
  }

  if (!coverLetter) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Failed to generate cover letter.</p>
        <Button variant="outline" size="sm" onClick={generateCoverLetter}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={generateCoverLetter} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Regenerate
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
            {coverLetter.content}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Ghostwriter Chat
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function GhostwriterTab({ jobId }: { jobId: string }) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadHistory() {
    try {
      const history = await api.ghostwriter.getMessages(jobId);
      setMessages(history.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
    } catch {
      // No history, start fresh
    } finally {
      setLoadingHistory(false);
    }
  }

  async function sendMessage(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || streaming) return;

    setInput('');
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: messageText };
    const assistantMsg: ChatMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const response = await fetch('/api/ghostwriter/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, message: messageText }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + data.text };
                }
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Ghostwriter error:', err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = { ...last, content: 'Sorry, something went wrong. Please try again.' };
        }
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function saveToAnswers(msg: ChatMessage) {
    setSavingId(msg.id);
    try {
      await api.ghostwriter.saveToAnswers({
        question: 'Ghostwriter response',
        answer: msg.content,
      });
    } catch (err) {
      console.error('Failed to save to answers:', err);
    } finally {
      setTimeout(() => setSavingId(null), 2000);
    }
  }

  const quickActions = [
    { label: 'How should I answer "Why this company?"', prompt: 'How should I answer "Why do you want to work at this company?" for this role?' },
    { label: 'Write an intro email', prompt: 'Write a professional introduction email I could send to the hiring manager or recruiter for this role.' },
    { label: 'Prepare me for an interview', prompt: 'What are the most likely interview questions for this role, and how should I answer them based on my background?' },
  ];

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 && (
          <div className="text-center py-6 space-y-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Ask me anything about this application — answer drafts, networking emails, interview prep.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => sendMessage(action.prompt)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-sky-600 text-white'
                : 'bg-muted'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content || (streaming ? '...' : '')}</div>
              {msg.role === 'assistant' && msg.content && (
                <div className="flex items-center gap-1 mt-2 pt-1 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => saveToAnswers(msg)}
                    disabled={savingId === msg.id}
                  >
                    {savingId === msg.id ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Bookmark className="h-3 w-3" />
                    )}
                    {savingId === msg.id ? 'Saved!' : 'Save to Answers'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions (show after first exchange) */}
      {messages.length > 0 && !streaming && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="text-[10px] h-6 px-2"
              onClick={() => sendMessage(action.prompt)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask about this application..."
          className="min-h-[40px] max-h-[100px] resize-none text-sm"
          disabled={streaming}
        />
        <Button
          size="sm"
          className="shrink-0 self-end"
          onClick={() => sendMessage()}
          disabled={!input.trim() || streaming}
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Drawer
// ---------------------------------------------------------------------------

export function ApplicationAssistDrawer({
  open,
  onOpenChange,
  job,
  candidate,
  existingTailored,
  existingCoverLetter,
  onMarkApplied,
}: ApplicationAssistDrawerProps) {
  const [marking, setMarking] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);

  async function handleMarkApplied() {
    setMarking(true);
    try {
      await api.applications.markApplied({ jobId: job.id });
      onMarkApplied();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to mark applied:', err);
    } finally {
      setMarking(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[500px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-3">
          <SheetTitle className="text-base">Application Assist</SheetTitle>
          <SheetDescription className="text-xs">
            {job.title} at {job.company}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="flex-1 overflow-hidden px-6 pt-3">
          <Tabs defaultValue="profile" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 h-8">
              <TabsTrigger value="profile" className="text-xs px-1">
                <User className="h-3 w-3 mr-1" />
                Info
              </TabsTrigger>
              <TabsTrigger value="resume" className="text-xs px-1">
                <FileText className="h-3 w-3 mr-1" />
                Resume
              </TabsTrigger>
              <TabsTrigger value="cover" className="text-xs px-1">
                <FileText className="h-3 w-3 mr-1" />
                Cover
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs px-1">
                <MessageSquare className="h-3 w-3 mr-1" />
                Chat
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-3 pb-3">
              <TabsContent value="profile" className="mt-0">
                <ProfileClipboardTab candidate={candidate} />
              </TabsContent>

              <TabsContent value="resume" className="mt-0">
                <ResumeTab job={job} existingTailored={existingTailored} />
              </TabsContent>

              <TabsContent value="cover" className="mt-0">
                <CoverLetterTab job={job} existingCoverLetter={existingCoverLetter} />
              </TabsContent>

              <TabsContent value="chat" className="mt-0 h-full">
                <GhostwriterTab jobId={job.id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <Separator />

        <SheetFooter className="px-6 py-3 flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)}>
              <Send className="h-3.5 w-3.5" />
              Send Email
            </Button>
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleMarkApplied}
            disabled={marking}
          >
            {marking ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Mark Applied
              </>
            )}
          </Button>
        </SheetFooter>

        <EmailComposeDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          job={job}
          candidate={candidate}
        />
      </SheetContent>
    </Sheet>
  );
}
