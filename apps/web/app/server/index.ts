export { getCandidate, updateCandidate } from './candidates';

export { listJobs, getJob, createJob, deleteJob } from './jobs';

export {
  listApplications,
  getApplication,
  createApplication,
  updateApplicationStatus,
} from './applications';

export {
  getUploadPresignedUrl,
  createResume,
  listResumes,
  deleteResume,
  setPreferredResume,
  getResumeDownloadUrl,
} from './resumes';

export { listSkills, addSkill, updateSkill, deleteSkill, bulkAddSkills } from './skills';

export { listExperience, addExperience, updateExperience, deleteExperience } from './experience';

export { listProjects, addProject, updateProject, deleteProject } from './projects';

export { listPreferences, addPreference, updatePreference, deletePreference } from './preferences';

export { listAnswers, addAnswer, updateAnswer, deleteAnswer } from './answers';

export {
  ingestJobFromUrl,
  parseJobDescription,
  scoreJob,
  rescoreAllJobs,
  parseResume,
  applyParsedResume,
  tailorResume,
  getTailoredResume,
} from './ai';

export { listOutcomes, addOutcome } from './outcomes';

export {
  getApiKeyStatus,
  saveApiKey,
  getDecryptedApiKey,
  listJobSources,
  addJobSource,
  deleteJobSource,
  toggleJobSource,
  syncJobSource,
  syncAllSources,
} from './settings';
export type { SyncResult } from './settings';

export { getFunnelAnalytics } from './analytics';

export { getSkillGap } from './skill-gap';

export { exportTailoredResume } from './resume-renderer';

export {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from './notifications';

// Re-export helpers for use from other server functions
export { createNotification, notifyUser } from './notifications';
