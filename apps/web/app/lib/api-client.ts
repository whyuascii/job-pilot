export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, data?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };

  if (data !== undefined && method !== 'GET') {
    opts.body = JSON.stringify(data);
  }

  const res = await fetch(path, opts);

  if (!res.ok) {
    const body = await res.text();
    let message: string;
    try {
      message = JSON.parse(body).error || body;
    } catch {
      message = body;
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

function get<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

function post<T>(path: string, data?: unknown): Promise<T> {
  return request<T>('POST', path, data);
}

export interface JobListParams {
  q?: string;
  remote?: string;
  minScore?: number;
  recommendation?: string;
  hasScore?: 'scored' | 'unscored';
  employmentType?: string;
  minComp?: number;
  maxComp?: number;
  domain?: string;
  sponsorship?: string;
  minYears?: number;
  maxYears?: number;
  postedAfter?: string;
  sortBy?: 'score' | 'date' | 'company' | 'title';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface JobListResult {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
}

export const api = {
  // Auth
  auth: {
    getSession: () => get<any>('/api/auth-session/get'),
  },

  // Dashboard
  dashboard: {
    getStats: () => get<any>('/api/dashboard/stats'),
    getControlTower: () => get<any>('/api/dashboard/control-tower'),
  },

  // Jobs
  jobs: {
    list: (params?: JobListParams) => {
      if (!params || Object.keys(params).length === 0) return get<JobListResult>('/api/jobs');
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
      }
      return get<JobListResult>(`/api/jobs?${sp.toString()}`);
    },
    get: (jobId: string) => get<any>(`/api/jobs/${jobId}`),
    create: (data: any) => post<any>('/api/jobs', data),
    delete: (data: { jobId: string }) => post<any>('/api/jobs/delete', data),
  },

  // Candidates
  candidates: {
    get: () => get<any>('/api/candidates'),
    update: (data: any) => post<any>('/api/candidates', data),
  },

  // Applications
  applications: {
    list: () => get<any[]>('/api/applications'),
    get: (applicationId: string) => get<any>(`/api/applications/${applicationId}`),
    create: (data: any) => post<any>('/api/applications', data),
    updateStatus: (data: any) => post<any>('/api/applications/update-status', data),
    delete: (data: { applicationId: string }) => post<any>('/api/applications/delete', data),
    markApplied: (data: { jobId: string }) => post<any>('/api/applications/mark-applied', data),
    quickAdd: (data: {
      company: string;
      jobTitle?: string;
      dateApplied?: string;
      compMin?: number;
      compMax?: number;
      equityDetails?: string;
      source?: string;
      status?: string;
      statusNote?: string;
    }) => post<any>('/api/applications/quick-add', data),
    updateDetails: (data: {
      applicationId: string;
      compMin?: number;
      compMax?: number;
      equityDetails?: string;
      compNotes?: string;
      subStatus?: string;
      statusNote?: string;
      declinedByUser?: boolean;
    }) => post<any>('/api/applications/update-details', data),
  },

  // Skills
  skills: {
    list: () => get<any[]>('/api/skills'),
    add: (data: any) => post<any>('/api/skills', data),
    update: (data: any) => post<any>('/api/skills/update', data),
    delete: (data: { skillId: string }) => post<any>('/api/skills/delete', data),
    bulk: (data: any) => post<any>('/api/skills/bulk', data),
  },

  // Experience
  experience: {
    list: () => get<any[]>('/api/experience'),
    add: (data: any) => post<any>('/api/experience', data),
    update: (data: any) => post<any>('/api/experience/update', data),
    delete: (data: { experienceId: string }) => post<any>('/api/experience/delete', data),
  },

  // Projects
  projects: {
    list: () => get<any[]>('/api/projects'),
    add: (data: any) => post<any>('/api/projects', data),
    update: (data: any) => post<any>('/api/projects/update', data),
    delete: (data: { projectId: string }) => post<any>('/api/projects/delete', data),
  },

  // Preferences
  preferences: {
    list: () => get<any[]>('/api/preferences'),
    listByCategory: (category: string) =>
      get<any[]>(`/api/preferences?category=${encodeURIComponent(category)}`),
    add: (data: any) => post<any>('/api/preferences', data),
    update: (data: any) => post<any>('/api/preferences/update', data),
    delete: (data: { preferenceId: string }) => post<any>('/api/preferences/delete', data),
  },

  // Resumes
  resumes: {
    list: () => get<any[]>('/api/resumes'),
    getUploadUrl: (data: any) => post<any>('/api/resumes/upload-url', data),
    create: (data: any) => post<any>('/api/resumes', data),
    delete: (data: { resumeId: string }) => post<any>('/api/resumes/delete', data),
    setPreferred: (data: { resumeId: string }) => post<any>('/api/resumes/set-preferred', data),
    getDownloadUrl: (id: string) => get<any>(`/api/resumes/download-url?id=${id}`),
  },

  // Answers
  answers: {
    list: () => get<any[]>('/api/answers'),
    add: (data: any) => post<any>('/api/answers', data),
    update: (data: any) => post<any>('/api/answers/update', data),
    delete: (data: { answerId: string }) => post<any>('/api/answers/delete', data),
  },

  // Notifications
  notifications: {
    list: () => get<any[]>('/api/notifications'),
    markRead: (data: { notificationId: string }) => post<any>('/api/notifications/read', data),
    markAllRead: () => post<any>('/api/notifications/read-all'),
    getUnreadCount: () => get<{ count: number }>('/api/notifications/unread-count'),
  },

  // Outcomes
  outcomes: {
    list: (data: { applicationId: string }) => post<any[]>('/api/outcomes/list', data),
    add: (data: any) => post<any>('/api/outcomes', data),
  },

  // AI
  ai: {
    ingestJobFromUrl: (data: { url: string }) => post<any>('/api/ai/ingest-url', data),
    ingestJobFromText: (data: { text: string; sourceLabel?: string }) =>
      post<any>('/api/ai/ingest-text', data),
    parseDescription: (data: any) => post<any>('/api/ai/parse-description', data),
    scoreJob: (data: { jobId: string }) => post<any>('/api/ai/score-job', data),
    rescoreAll: () => post<any>('/api/ai/rescore-all'),
    parseResume: (data: any) => post<any>('/api/ai/parse-resume', data),
    applyParsedResume: (data: any) => post<any>('/api/ai/apply-parsed-resume', data),
    tailorResume: (data: { jobId: string }) => post<any>('/api/ai/tailor-resume', data),
    getTailoredResume: (jobId: string) => get<any>(`/api/ai/tailored-resume?jobId=${jobId}`),
    getOriginalProfile: () => get<any>('/api/ai/original-profile'),
    getResumeLibrary: () => get<any[]>('/api/ai/resume-library'),
  },

  // Settings
  settings: {
    getApiKeyStatus: () => get<any>('/api/settings/api-key-status'),
    saveApiKey: (data: any) => post<any>('/api/settings/save-api-key', data),
    deleteApiKey: (data: { service: string }) => post<any>('/api/settings/delete-api-key', data),
    listJobSources: () => get<any[]>('/api/settings/job-sources'),
    addJobSource: (data: any) => post<any>('/api/settings/job-sources', data),
    deleteJobSource: (data: { sourceId: string }) =>
      post<any>('/api/settings/job-sources/delete', data),
    toggleJobSource: (data: { sourceId: string; enabled: boolean }) =>
      post<any>('/api/settings/job-sources/toggle', data),
    syncJobSource: (data: { sourceId: string }) =>
      post<any>('/api/settings/job-sources/sync', data),
    syncAllSources: () => post<any>('/api/settings/job-sources/sync-all'),
    getSearchConfig: () => get<any>('/api/settings/search-config'),
    enableSource: (data: { type: string }) => post<any>('/api/settings/enable-source', data),
  },

  // Analytics
  analytics: {
    getFunnel: () => get<any>('/api/analytics/funnel'),
    getScoreCorrelation: () => get<any>('/api/analytics/score-correlation'),
    getSourceEffectiveness: () => get<any>('/api/analytics/source-effectiveness'),
    getResumeVariants: () => get<any>('/api/analytics/resume-variants'),
  },

  // Skill Gap
  skillGap: {
    get: (jobId: string) => get<any>(`/api/skill-gap/${jobId}`),
  },

  // Resume Renderer
  resumeRenderer: {
    export: (data: { jobId: string }) => post<any>('/api/resume-renderer/export', data),
  },

  // Gmail
  gmail: {
    getAuthUrl: () => get<{ url: string }>('/api/gmail/auth-url'),
    callback: (data: { code: string }) => post<any>('/api/gmail/callback', data),
    getStatus: () => get<any>('/api/gmail/status'),
    disconnect: () => post<any>('/api/gmail/disconnect'),
    syncMessages: () => post<any>('/api/gmail/sync-messages'),
    send: (data: {
      to: string;
      subject: string;
      body: string;
      applicationId?: string;
      templateType?: string;
    }) => post<any>('/api/gmail/send', data),
    getTemplates: () => get<any[]>('/api/gmail/templates'),
  },

  // Email Analysis
  emailAnalysis: {
    listMessages: () => get<any[]>('/api/email-analysis/messages'),
    analyze: (data: { messageId: string }) => post<any>('/api/email-analysis/analyze', data),
    analyzeUnprocessed: () => post<any>('/api/email-analysis/analyze-unprocessed'),
    applyStatus: (data: any) => post<any>('/api/email-analysis/apply-status', data),
    dismiss: (data: { messageId: string }) => post<any>('/api/email-analysis/dismiss', data),
  },

  // Profile Coach
  profileCoach: {
    chat: (data: {
      message: string;
      conversationHistory: Array<{ role: string; content: string }>;
      activeSection?: string;
    }) =>
      post<{
        message: string;
        suggestions: Array<{
          type: string;
          label: string;
          data: Record<string, any>;
          targetId?: string;
        }>;
      }>('/api/profile-coach/chat', data),
    analyze: () =>
      post<{
        message: string;
        suggestions: Array<{
          type: string;
          label: string;
          data: Record<string, any>;
          targetId?: string;
        }>;
        profileScore: number;
        priorities: string[];
      }>('/api/profile-coach/analyze'),
    careerGrowth: (data: { jobId: string }) => post<any>('/api/profile-coach/career-growth', data),
  },

  // Career Goals
  careerGoals: {
    list: () => get<any[]>('/api/career-goals'),
    save: (data: { jobId: string; notes?: string }) => post<any>('/api/career-goals', data),
    delete: (data: { goalId: string }) => post<any>('/api/career-goals/delete', data),
    toggleSelected: (data: { goalId: string; selected: boolean }) =>
      post<any>('/api/career-goals/toggle-selected', data),
    getCoachingPlan: () => get<any>('/api/career-goals/coaching-plan'),
    generateCoachingPlan: () => post<any>('/api/career-goals/generate-coaching-plan'),
  },

  // Cover Letter
  coverLetter: {
    generate: (data: { jobId: string }) => post<any>('/api/cover-letter/generate', data),
    get: (jobId: string) => get<any>(`/api/cover-letter?jobId=${jobId}`),
  },

  // Flight Records
  flightRecords: {
    list: () => get<any[]>('/api/flight-records'),
    get: (id: string) => get<any>(`/api/flight-records/${id}`),
  },

  // RxResume
  rxresume: {
    generatePdf: (data: { jobId: string; templateId?: string }) =>
      post<any>('/api/rxresume/generate-pdf', data),
    getTemplates: () => get<any[]>('/api/rxresume/templates'),
  },

  // Ghostwriter
  ghostwriter: {
    getMessages: (jobId: string) => get<any[]>(`/api/ghostwriter/messages?jobId=${jobId}`),
    saveToAnswers: (data: { question: string; answer: string }) =>
      post<any>('/api/ghostwriter/save-to-answers', data),
  },

  // Resume Interview
  resumeInterview: {
    getMessages: (jobId: string) => get<any[]>(`/api/resume-interview/messages?jobId=${jobId}`),
    acceptEnhancement: (data: {
      jobId: string;
      blockIndex: number;
      bulletIndex: number;
      enhancedBullet: string;
    }) => post<any>('/api/resume-interview/accept-enhancement', data),
    acceptAll: (data: {
      jobId: string;
      blockIndex: number;
      bulletIndex: number;
      enhancedBullet: string;
      story: { questionPattern: string; answer: string };
    }) => post<any>('/api/resume-interview/accept-all', data),
  },

  // Answer AI
  answerAi: {
    detectQuestions: (data: any) => post<any[]>('/api/answer-ai/detect-questions', data),
    suggestAnswer: (data: any) => post<any>('/api/answer-ai/suggest-answer', data),
    searchSimilar: (data: { searchText: string }) =>
      post<any[]>('/api/answer-ai/search-similar', data),
    getQuestions: (applicationId: string) =>
      get<any[]>(`/api/answer-ai/questions?applicationId=${applicationId}`),
    approveAnswer: (data: any) => post<any>('/api/answer-ai/approve-answer', data),
    dismissQuestion: (data: { questionId: string }) =>
      post<any>('/api/answer-ai/dismiss-question', data),
  },

  // Activity Feed
  activity: {
    confirm: (data: { action: string; itemId: string; itemType: string; data?: any }) =>
      post<any>('/api/activity/confirm', data),
  },
};
