-- =============================================================================
-- Row Level Security (RLS) Policies for Tenant Isolation
-- =============================================================================
--
-- Defense-in-depth: even if the application layer has a bug, the database will
-- refuse to return rows that don't belong to the current tenant.
--
-- Usage pattern (application layer, once per request):
--
--   SET LOCAL app.tenant_id = '<tenant-id>';
--
-- `SET LOCAL` scopes the setting to the current transaction, so it is
-- automatically cleared at COMMIT / ROLLBACK. Every query in the same
-- transaction will be filtered by the RLS policies below.
--
-- The second argument `true` in current_setting('app.tenant_id', true) makes
-- it return NULL instead of raising an error when the setting is missing.
-- This means that if app.tenant_id is NOT set, no rows will be visible
-- (NULL never equals a real tenant_id), which is the safe default.
--
-- Auth tables (sessions, accounts, verifications) are managed by better-auth
-- and do NOT have RLS enabled -- they are not tenant-scoped.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Tables with a direct `tenant_id` column
-- ---------------------------------------------------------------------------

-- tenants ----------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.tenants
  USING (id = current_setting('app.tenant_id', true))
  WITH CHECK (id = current_setting('app.tenant_id', true));

-- users ------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.users
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- candidates -------------------------------------------------------------
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.candidates
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- resumes ----------------------------------------------------------------
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.resumes
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- job_sources ------------------------------------------------------------
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.job_sources
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- jobs -------------------------------------------------------------------
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.jobs
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- applications -----------------------------------------------------------
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.applications
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- answer_bank ------------------------------------------------------------
ALTER TABLE public.answer_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.answer_bank
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- tailored_resumes -------------------------------------------------------
ALTER TABLE public.tailored_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.tailored_resumes
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- recruiter_messages -----------------------------------------------------
ALTER TABLE public.recruiter_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.recruiter_messages
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- llm_runs ---------------------------------------------------------------
ALTER TABLE public.llm_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.llm_runs
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- notifications ----------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.notifications
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- gmail_tokens -----------------------------------------------------------
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.gmail_tokens
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));


-- ---------------------------------------------------------------------------
-- 2. Tables WITHOUT a direct `tenant_id` column
--    These are isolated via a subquery join to their parent table.
-- ---------------------------------------------------------------------------

-- skills (FK: candidate_id -> candidates.id) -----------------------------
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.skills
  USING (candidate_id IN (
    SELECT id FROM public.candidates
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ))
  WITH CHECK (candidate_id IN (
    SELECT id FROM public.candidates
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ));

-- experience_blocks (FK: candidate_id -> candidates.id) ------------------
ALTER TABLE public.experience_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.experience_blocks
  USING (candidate_id IN (
    SELECT id FROM public.candidates
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ))
  WITH CHECK (candidate_id IN (
    SELECT id FROM public.candidates
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ));

-- projects (FK: candidate_id -> candidates.id) ---------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.projects
  USING (candidate_id IN (
    SELECT id FROM public.candidates
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ))
  WITH CHECK (candidate_id IN (
    SELECT id FROM public.candidates
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ));

-- preferences (FK: candidate_id -> candidates.id) ------------------------
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.preferences
  USING (candidate_id IN (
    SELECT id FROM public.candidates
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ))
  WITH CHECK (candidate_id IN (
    SELECT id FROM public.candidates
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ));

-- job_scores (FK: job_id -> jobs.id AND candidate_id -> candidates.id) ---
-- Both parent tables carry tenant_id; we check via candidates for
-- consistency but either FK path would be correct.
ALTER TABLE public.job_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.job_scores
  USING (
    candidate_id IN (
      SELECT id FROM public.candidates
      WHERE tenant_id = current_setting('app.tenant_id', true)
    )
    AND job_id IN (
      SELECT id FROM public.jobs
      WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    candidate_id IN (
      SELECT id FROM public.candidates
      WHERE tenant_id = current_setting('app.tenant_id', true)
    )
    AND job_id IN (
      SELECT id FROM public.jobs
      WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );

-- application_questions (FK: application_id -> applications.id) ----------
ALTER TABLE public.application_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.application_questions
  USING (application_id IN (
    SELECT id FROM public.applications
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ))
  WITH CHECK (application_id IN (
    SELECT id FROM public.applications
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ));

-- outcomes (FK: application_id -> applications.id) -----------------------
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.outcomes
  USING (application_id IN (
    SELECT id FROM public.applications
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ))
  WITH CHECK (application_id IN (
    SELECT id FROM public.applications
    WHERE tenant_id = current_setting('app.tenant_id', true)
  ));
