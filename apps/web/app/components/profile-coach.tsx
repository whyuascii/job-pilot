import * as React from 'react';
import { useRouter } from '@tanstack/react-router';
import {
  MessageSquare,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  User,
  Bot,
  Lightbulb,
  Target,
  Zap,
  Star,
  Trophy,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  ScrollArea,
  Textarea,
} from '@job-pilot/ui';
import { api, ApiError } from '~/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Suggestion[];
}

interface Suggestion {
  type: 'update_headline' | 'update_summary' | 'add_skill' | 'update_experience_bullets' | 'add_project_highlight';
  label: string;
  data: Record<string, any>;
  targetId?: string;
}

interface ProfileCoachPanelProps {
  candidate: any;
  skills: any[];
  experience: any[];
  projects: any[];
}

// ─── Quick Actions ───────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Improve headline', icon: Lightbulb, message: 'Review my current headline and suggest a stronger, more impactful version that highlights my key strengths.' },
  { label: 'Enhance summary', icon: Target, message: 'Analyze my professional summary and suggest an improved version with stronger impact and quantifiable achievements.' },
  { label: 'Suggest skills', icon: Zap, message: 'Based on my experience and current skills, what additional skills should I add to my profile to be more competitive?' },
  { label: 'Strengthen bullets', icon: Star, message: 'Review my experience bullet points and suggest stronger versions using the STAR method with quantifiable results.' },
  { label: 'Rate my profile', icon: Trophy, message: 'Give me an honest assessment of my overall profile. Rate it out of 10 and tell me the top 3 things I should improve.' },
];

function CoachQuickActions({ onSelect, disabled }: { onSelect: (message: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_ACTIONS.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          disabled={disabled}
          onClick={() => onSelect(action.message)}
        >
          <action.icon className="h-3 w-3" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}

// ─── Chat Message ────────────────────────────────────────────────────────────

function CoachMessage({
  message,
  onApplySuggestion,
  appliedSuggestions,
}: {
  message: ChatMessage;
  onApplySuggestion: (suggestion: Suggestion, messageId: string) => void;
  appliedSuggestions: Set<string>;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isUser ? 'bg-sky-100' : 'bg-muted'}`}>
        {isUser ? <User className="h-3 w-3 text-sky-700" /> : <Bot className="h-3 w-3 text-muted-foreground" />}
      </div>
      <div className={`flex flex-col gap-1.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
            isUser
              ? 'bg-sky-600 text-white'
              : 'bg-muted text-foreground'
          }`}
        >
          <MarkdownContent content={message.content} />
        </div>
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-col gap-1 w-full">
            {message.suggestions.map((suggestion, idx) => {
              const key = `${message.id}-${idx}`;
              const applied = appliedSuggestions.has(key);
              return (
                <Button
                  key={key}
                  variant={applied ? 'ghost' : 'outline'}
                  size="sm"
                  className={`h-auto py-1.5 px-2.5 text-xs justify-start gap-1.5 ${applied ? 'text-emerald-600' : ''}`}
                  disabled={applied}
                  onClick={() => onApplySuggestion(suggestion, key)}
                >
                  {applied ? <Check className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                  <span className="text-left">{applied ? 'Applied' : `Apply: ${suggestion.label}`}</span>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Simple Markdown ─────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown: bold, italic, line breaks, bullet lists
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.trim() === '') return <br key={i} />;
        const isBullet = /^[-*]\s/.test(line.trim());
        const formatted = line
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`(.+?)`/g, '<code class="bg-black/5 px-1 rounded text-xs">$1</code>');
        return (
          <p
            key={i}
            className={isBullet ? 'pl-3' : ''}
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        );
      })}
    </div>
  );
}

// ─── Coach Input ─────────────────────────────────────────────────────────────

function CoachInput({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = React.useState('');

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex gap-2 items-end">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your profile..."
        className="min-h-[36px] max-h-[100px] resize-none text-sm"
        rows={1}
        disabled={disabled}
      />
      <Button
        size="sm"
        className="h-9 w-9 shrink-0"
        disabled={disabled || !value.trim()}
        onClick={handleSubmit}
      >
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

let messageCounter = 0;
function nextId() {
  return `msg_${++messageCounter}_${Date.now()}`;
}

export function ProfileCoachPanel({ candidate, skills, experience, projects }: ProfileCoachPanelProps) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [appliedSuggestions, setAppliedSuggestions] = React.useState<Set<string>>(new Set());
  const [profileScore, setProfileScore] = React.useState<number | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Proactive analysis when first expanded
  React.useEffect(() => {
    if (expanded && !hasAnalyzed && messages.length === 0) {
      setHasAnalyzed(true);
      runProactiveAnalysis();
    }
  }, [expanded]);

  async function runProactiveAnalysis() {
    setLoading(true);
    try {
      const result = await api.profileCoach.analyze();
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: result.message,
        suggestions: result.suggestions,
      };
      setMessages([assistantMsg]);
      if (result.profileScore) {
        setProfileScore(result.profileScore);
      }
    } catch {
      // Silently fail — user can still use chat normally
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(text: string) {
    setError('');
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await api.profileCoach.chat({
        message: text,
        conversationHistory,
      });

      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: result.message,
        suggestions: result.suggestions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to get response. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleApplySuggestion(suggestion: Suggestion, key: string) {
    try {
      switch (suggestion.type) {
        case 'update_headline':
          await api.candidates.update({ headline: suggestion.data.headline });
          break;
        case 'update_summary':
          await api.candidates.update({ summary: suggestion.data.summary });
          break;
        case 'add_skill':
          await api.skills.add({
            name: suggestion.data.name,
            category: suggestion.data.category,
            confidenceScore: suggestion.data.confidenceScore,
          });
          break;
        case 'update_experience_bullets':
          await api.experience.update({
            experienceId: suggestion.data.experienceId,
            bullets: suggestion.data.bullets,
          });
          break;
        case 'add_project_highlight':
          await api.projects.update({
            projectId: suggestion.data.projectId,
            highlights: suggestion.data.highlights,
          });
          break;
      }

      setAppliedSuggestions((prev) => new Set([...prev, key]));
      router.invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to apply suggestion.');
    }
  }

  if (!expanded) {
    return (
      <Card className="rounded-xl shadow">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-500" />
              AI Coach
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">Beta</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xs text-muted-foreground mb-3">
            Get personalized advice to strengthen your profile, improve bullet points, and stand out to recruiters.
          </p>
          {profileScore !== null && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">Profile Score:</span>
              <Badge variant={profileScore >= 7 ? 'success' : profileScore >= 5 ? 'default' : 'warning'} className="text-xs">
                {profileScore}/10
              </Badge>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setExpanded(true)}
          >
            <MessageSquare className="h-4 w-4" />
            {hasAnalyzed ? 'Continue Coaching' : 'Get Profile Feedback'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow">
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-500" />
            AI Coach
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpanded(false)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2 flex flex-col gap-2">
        {/* Chat Messages */}
        <div ref={scrollRef}>
          <ScrollArea className="h-[350px]">
            <div className="flex flex-col gap-3 pr-3">
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bot className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Ask me anything about your profile, or try a quick action below.
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <CoachMessage
                  key={msg.id}
                  message={msg}
                  onApplySuggestion={handleApplySuggestion}
                  appliedSuggestions={appliedSuggestions}
                />
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive px-1">{error}</p>
        )}

        {/* Quick Actions */}
        <CoachQuickActions onSelect={sendMessage} disabled={loading} />

        {/* Input */}
        <CoachInput onSend={sendMessage} disabled={loading} />
      </CardContent>
    </Card>
  );
}
