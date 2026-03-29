import * as React from 'react';
import { ArrowLeft, Bookmark, Check, Loader2, Send, SkipForward, Sparkles } from 'lucide-react';
import { Badge, Button, Card, CardContent, Textarea } from '@job-pilot/ui';
import { api, getApiBase } from '~/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Enhancement {
  blockIndex: number;
  bulletIndex: number;
  originalBullet: string;
  enhancedBullet: string;
  skills?: string[];
  story?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}

interface PlanData {
  totalAreas: number;
  areas: Array<{
    blockIndex: number;
    bulletIndex: number;
    title: string;
    weakness: string;
    priority: string;
  }>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  enhancement?: Enhancement;
}

interface ResumeInterviewProps {
  jobId: string;
  tailoredResume: any;
  onBack: () => void;
  onResumeUpdated: (updated: any) => void;
}

type InterviewState = 'idle' | 'streaming' | 'complete';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip :::plan, :::enhancement, :::summary blocks from visible text */
function stripBlocks(text: string): string {
  return text.replace(/:::(?:plan|enhancement|summary)\s*[\s\S]*?:::/g, '').trim();
}

// ---------------------------------------------------------------------------
// Enhancement Card
// ---------------------------------------------------------------------------

function EnhancementCard({
  enhancement,
  jobId,
  onAccepted,
}: {
  enhancement: Enhancement;
  jobId: string;
  onAccepted: (updated: any) => void;
}) {
  const [accepting, setAccepting] = React.useState<'bullet' | 'all' | null>(null);
  const [accepted, setAccepted] = React.useState(false);

  async function handleAcceptBullet() {
    setAccepting('bullet');
    try {
      const result = await api.resumeInterview.acceptEnhancement({
        jobId,
        blockIndex: enhancement.blockIndex,
        bulletIndex: enhancement.bulletIndex,
        enhancedBullet: enhancement.enhancedBullet,
      });
      setAccepted(true);
      onAccepted(result);
    } catch (err) {
      console.error('Failed to accept enhancement:', err);
    } finally {
      setAccepting(null);
    }
  }

  async function handleAcceptAll() {
    setAccepting('all');
    try {
      const storyText = enhancement.story
        ? `Situation: ${enhancement.story.situation}\nTask: ${enhancement.story.task}\nAction: ${enhancement.story.action}\nResult: ${enhancement.story.result}`
        : '';

      const result = await api.resumeInterview.acceptAll({
        jobId,
        blockIndex: enhancement.blockIndex,
        bulletIndex: enhancement.bulletIndex,
        enhancedBullet: enhancement.enhancedBullet,
        story: {
          questionPattern: enhancement.originalBullet,
          answer: storyText || enhancement.enhancedBullet,
        },
      });
      setAccepted(true);
      onAccepted(result.resume);
    } catch (err) {
      console.error('Failed to accept all:', err);
    } finally {
      setAccepting(null);
    }
  }

  if (accepted) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
        <CardContent className="pb-3 pt-3">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" />
            Enhancement accepted
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20">
      <CardContent className="space-y-2 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-500" />
          <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
            Proposed Enhancement
          </span>
        </div>

        <div className="space-y-1.5">
          <div>
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Original
            </span>
            <p className="text-muted-foreground text-xs line-through">
              {enhancement.originalBullet}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Enhanced
            </span>
            <p className="text-xs font-medium">{enhancement.enhancedBullet}</p>
          </div>
        </div>

        {enhancement.skills && enhancement.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {enhancement.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="h-5 text-[10px]">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="h-7 bg-sky-600 text-xs text-white hover:bg-sky-700"
            onClick={handleAcceptAll}
            disabled={accepting !== null}
          >
            {accepting === 'all' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Bookmark className="h-3 w-3" />
            )}
            Accept All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleAcceptBullet}
            disabled={accepting !== null}
          >
            {accepting === 'bullet' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Accept Bullet
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 text-xs"
            onClick={() => setAccepted(true)}
            disabled={accepting !== null}
          >
            <SkipForward className="h-3 w-3" />
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ResumeInterview({
  jobId,
  tailoredResume,
  onBack,
  onResumeUpdated,
}: ResumeInterviewProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [state, setState] = React.useState<InterviewState>('idle');
  const [plan, setPlan] = React.useState<PlanData | null>(null);
  const [areasExplored, setAreasExplored] = React.useState(0);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Load existing messages on mount
  React.useEffect(() => {
    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadHistory() {
    try {
      const history = await api.resumeInterview.getMessages(jobId);
      if (history.length > 0) {
        setMessages(
          history.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );
        // Count enhancements already proposed
        let count = 0;
        for (const m of history) {
          if (m.role === 'assistant' && m.content.includes(':::enhancement')) count++;
        }
        setAreasExplored(count);
        // Try to recover plan from first assistant message
        const firstAssistant = history.find((m: any) => m.role === 'assistant');
        if (firstAssistant) {
          const planMatch = firstAssistant.content.match(/:::plan\s*([\s\S]*?)\s*:::/);
          if (planMatch) {
            try {
              setPlan(JSON.parse(planMatch[1]));
            } catch {}
          }
        }
      } else {
        // No history — start the interview
        startInterview();
      }
    } catch {
      startInterview();
    } finally {
      setLoadingHistory(false);
    }
  }

  async function startInterview() {
    setState('streaming');
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
    };
    setMessages([assistantMsg]);

    try {
      const response = await fetch(`${getApiBase()}/api/resume-interview/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }

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
            } else if (data.type === 'plan') {
              setPlan(data.data);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Interview start error:', err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content:
              'Sorry, I could not start the interview. Please make sure you have a tailored resume generated first, then try again.',
          };
        }
        return updated;
      });
    } finally {
      setState('idle');
    }
  }

  async function sendMessage(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || state === 'streaming') return;

    setInput('');
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: messageText };
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setState('streaming');

    try {
      const response = await fetch(`${getApiBase()}/api/resume-interview/chat`, {
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
            } else if (data.type === 'enhancement') {
              setAreasExplored((c) => c + 1);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, enhancement: data.data };
                }
                return updated;
              });
            } else if (data.type === 'summary') {
              setState('complete');
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Interview chat error:', err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: 'Sorry, something went wrong. Please try again.',
          };
        }
        return updated;
      });
    } finally {
      if (state !== 'complete') setState('idle');
    }
  }

  function handleResumeUpdated(updated: any) {
    onResumeUpdated(updated);
  }

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  const totalAreas = plan?.totalAreas || plan?.areas?.length || 0;
  const progressPct = totalAreas > 0 ? Math.min(100, (areasExplored / totalAreas) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Resume Depth Interview</p>
          {totalAreas > 0 && (
            <p className="text-muted-foreground text-[10px]">
              {areasExplored} of {totalAreas} areas explored
            </p>
          )}
        </div>
        {state === 'complete' && (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          >
            Complete
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      {totalAreas > 0 && (
        <div className="bg-muted mb-3 h-1.5 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="mb-3 flex-1 space-y-3 overflow-y-auto">
        {messages.map((msg) => (
          <React.Fragment key={msg.id}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user' ? 'bg-sky-600 text-white' : 'bg-muted'
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {stripBlocks(msg.content) || (state === 'streaming' ? '...' : '')}
                </div>
              </div>
            </div>
            {msg.enhancement && (
              <EnhancementCard
                enhancement={msg.enhancement}
                jobId={jobId}
                onAccepted={handleResumeUpdated}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Input */}
      {state !== 'complete' && (
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
            placeholder="Answer the question..."
            className="max-h-[100px] min-h-[40px] resize-none text-sm"
            disabled={state === 'streaming'}
          />
          <Button
            size="sm"
            className="shrink-0 self-end"
            onClick={() => sendMessage()}
            disabled={!input.trim() || state === 'streaming'}
          >
            {state === 'streaming' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {state === 'complete' && (
        <div className="py-3 text-center">
          <p className="text-muted-foreground mb-2 text-xs">
            Interview complete. Head back to review your enhanced resume.
          </p>
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Resume
          </Button>
        </div>
      )}
    </div>
  );
}
