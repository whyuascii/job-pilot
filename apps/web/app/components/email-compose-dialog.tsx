import * as React from 'react';
import { AlertTriangle, Loader2, Send } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@job-pilot/ui';
import { api } from '~/lib/api-client';

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
}

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  candidate: any;
  applicationId?: string;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

export function EmailComposeDialog({
  open,
  onOpenChange,
  job,
  candidate,
  applicationId,
}: EmailComposeDialogProps) {
  const [templates, setTemplates] = React.useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>('');
  const [to, setTo] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (open) {
      loadTemplates();
      checkGmail();
      setSent(false);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTemplates() {
    try {
      const list = await api.gmail.getTemplates();
      setTemplates(list);
    } catch {}
  }

  async function checkGmail() {
    try {
      const status = await api.gmail.getStatus();
      setGmailConnected(status.connected);
    } catch {
      setGmailConnected(false);
    }
  }

  function getTemplateVars(): Record<string, string> {
    return {
      candidateName: candidate?.fullName || '',
      jobTitle: job?.title || '',
      company: job?.company || '',
      headline: candidate?.headline || '',
      yearsOfExperience: candidate?.yearsOfExperience?.toString() || '',
      recipientName: 'Hiring Manager',
    };
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      const vars = getTemplateVars();
      setSubject(fillTemplate(template.subject, vars));
      setBody(fillTemplate(template.body, vars));
    }
  }

  async function handleSend() {
    if (!to || !subject || !body) return;
    setSending(true);
    setError(null);
    try {
      const template = templates.find((t) => t.id === selectedTemplate);
      await api.gmail.send({
        to,
        subject,
        body,
        applicationId,
        templateType: template?.type,
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Sent</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <Send className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-muted-foreground text-sm">Your email has been sent successfully.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
          <DialogDescription>
            Send an email related to {job?.title} at {job?.company}
          </DialogDescription>
        </DialogHeader>

        {gmailConnected === false && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Gmail is not connected. Please connect Gmail with send permission in Settings.
          </div>
        )}

        <div className="space-y-4">
          {/* Template selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To */}
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@company.com"
              type="email"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label className="text-xs">Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              className="min-h-[200px]"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!to || !subject || !body || sending || gmailConnected === false}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
