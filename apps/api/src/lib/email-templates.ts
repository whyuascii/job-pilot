export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'introduction' | 'follow_up' | 'thank_you';
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'introduction',
    name: 'Introduction / Cold Outreach',
    type: 'introduction',
    subject: 'Interest in {{jobTitle}} Role at {{company}}',
    body: `Dear {{recipientName}},

I hope this message finds you well. My name is {{candidateName}}, and I'm reaching out to express my strong interest in the {{jobTitle}} position at {{company}}.

With {{yearsOfExperience}} years of experience in {{headline}}, I believe my background aligns well with the requirements of this role. I was particularly drawn to this opportunity because of {{company}}'s work in the industry.

I've attached my resume for your review. I would welcome the opportunity to discuss how my experience and skills could contribute to your team.

Thank you for your time and consideration.

Best regards,
{{candidateName}}`,
  },
  {
    id: 'follow_up',
    name: 'Follow-Up',
    type: 'follow_up',
    subject: 'Following Up — {{jobTitle}} Application at {{company}}',
    body: `Dear {{recipientName}},

I wanted to follow up on my application for the {{jobTitle}} position at {{company}}. I submitted my application recently and remain very enthusiastic about the opportunity.

I'm confident that my experience in {{headline}} would allow me to make meaningful contributions to your team. I would love the chance to discuss how I can help {{company}} achieve its goals.

Please let me know if there's any additional information I can provide. I'm happy to work around your schedule for a conversation.

Thank you for your time.

Best regards,
{{candidateName}}`,
  },
  {
    id: 'thank_you',
    name: 'Thank You (Post-Interview)',
    type: 'thank_you',
    subject: 'Thank You — {{jobTitle}} Interview at {{company}}',
    body: `Dear {{recipientName}},

Thank you for taking the time to speak with me about the {{jobTitle}} position at {{company}}. I truly enjoyed our conversation and learning more about the team and the exciting work you're doing.

Our discussion reinforced my enthusiasm for the role. I'm excited about the possibility of contributing my experience in {{headline}} to help {{company}} succeed.

Please don't hesitate to reach out if you need any additional information from me. I look forward to hearing about the next steps.

Thank you again for the opportunity.

Best regards,
{{candidateName}}`,
  },
];

export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}
