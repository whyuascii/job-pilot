/**
 * Job scraper integrations: ts-jobspy (LinkedIn/Indeed) and Adzuna API.
 * Used during source sync to find jobs via search queries instead of URL scraping.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  remotePolicy?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  postedAt?: string;
  source: string;
}

// ---------------------------------------------------------------------------
// ts-jobspy integration (LinkedIn + Indeed scraping)
// ---------------------------------------------------------------------------

export interface TsJobspySearchConfig {
  searchTerm: string;
  location?: string;
  resultsWanted?: number;
  isRemote?: boolean;
  jobType?: 'fulltime' | 'parttime' | 'internship' | 'contract';
  hoursOld?: number;
  sites?: Array<'linkedin' | 'indeed'>;
}

export async function searchWithTsJobspy(config: TsJobspySearchConfig): Promise<ScrapedJob[]> {
  try {
    const { scrapeJobs } = await import('ts-jobspy');
    const sites = config.sites ?? ['linkedin', 'indeed'];

    const jobs = await scrapeJobs({
      siteName: sites,
      searchTerm: config.searchTerm,
      location: config.location,
      resultsWanted: config.resultsWanted ?? 200,
      isRemote: config.isRemote,
      jobType: config.jobType,
      hoursOld: config.hoursOld ?? 168, // 1 week
      linkedinFetchDescription: true,
      descriptionFormat: 'markdown',
    });

    return jobs
      .map((job: any) => ({
        title: job.title || 'Untitled',
        company: job.company || 'Unknown',
        location: formatTsJobspyLocation(job.location),
        description: job.description || '',
        url: job.job_url || '',
        remotePolicy: job.is_remote ? 'remote' : undefined,
        employmentType: mapJobType(job.job_type),
        salaryMin: job.min_amount ?? undefined,
        salaryMax: job.max_amount ?? undefined,
        salaryCurrency: job.currency ?? undefined,
        postedAt: job.date_posted ?? undefined,
        source: `ts-jobspy:${job.site || 'unknown'}`,
      }))
      .filter((j: ScrapedJob) => j.url && j.title !== 'Untitled');
  } catch (err) {
    console.error('[ts-jobspy] Scraping failed:', err);
    throw new Error(`Job scraping failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

function formatTsJobspyLocation(loc: any): string {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  const parts = [loc.city, loc.state, loc.country].filter(Boolean);
  return parts.join(', ');
}

function mapJobType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const map: Record<string, string> = {
    fulltime: 'full-time',
    parttime: 'part-time',
    internship: 'internship',
    contract: 'contract',
  };
  return map[type.toLowerCase()] ?? type;
}

// ---------------------------------------------------------------------------
// Adzuna API integration
// ---------------------------------------------------------------------------

export interface AdzunaSearchConfig {
  searchTerm: string;
  location?: string;
  country?: string; // 2-letter code, default 'us'
  resultsPerPage?: number;
  maxDaysOld?: number;
  salaryMin?: number;
  salaryMax?: number;
  fullTime?: boolean;
  sortBy?: 'date' | 'salary' | 'relevance' | 'hybrid';
}

interface AdzunaJob {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  created: string;
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  salary_min: number;
  salary_max: number;
  salary_is_predicted: string;
  contract_type?: string;
  contract_time?: string;
}

interface AdzunaResponse {
  count: number;
  mean: number;
  results: AdzunaJob[];
}

export async function searchWithAdzuna(
  config: AdzunaSearchConfig,
  credentials: { appId: string; appKey: string },
): Promise<ScrapedJob[]> {
  const country = config.country ?? 'us';
  const allJobs: AdzunaJob[] = [];
  const perPage = config.resultsPerPage ?? 50;
  const maxPages = 10; // Cap at 10 pages = 500 results max

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      app_id: credentials.appId,
      app_key: credentials.appKey,
      'content-type': 'application/json',
      results_per_page: String(perPage),
    });

    if (config.searchTerm) params.set('what', config.searchTerm);
    if (config.location) params.set('where', config.location);
    if (config.maxDaysOld) params.set('max_days_old', String(config.maxDaysOld));
    if (config.salaryMin) params.set('salary_min', String(config.salaryMin));
    if (config.salaryMax) params.set('salary_max', String(config.salaryMax));
    if (config.fullTime) params.set('full_time', '1');
    if (config.sortBy) params.set('sort_by', config.sortBy);

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Adzuna API error: ${response.status} ${body.slice(0, 200)}`);
      }
      const data = (await response.json()) as AdzunaResponse;
      allJobs.push(...data.results);

      // Stop if we've fetched all results
      if (allJobs.length >= data.count || data.results.length < perPage) break;
    } finally {
      clearTimeout(timeout);
    }

    // Basic rate limiting between pages
    if (page < maxPages) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allJobs
    .map((job) => ({
      title: stripHtmlTags(job.title),
      company: job.company?.display_name || 'Unknown',
      location: job.location?.display_name || '',
      description: job.description || '',
      url: job.redirect_url || '',
      employmentType: mapAdzunaContractTime(job.contract_time),
      salaryMin: job.salary_min ?? undefined,
      salaryMax: job.salary_max ?? undefined,
      salaryCurrency: country === 'us' ? 'USD' : country === 'gb' ? 'GBP' : 'EUR',
      postedAt: job.created ?? undefined,
      source: 'adzuna',
    }))
    .filter((j) => j.url);
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, '').trim();
}

function mapAdzunaContractTime(time: string | undefined): string | undefined {
  if (!time) return undefined;
  const map: Record<string, string> = {
    full_time: 'full-time',
    part_time: 'part-time',
  };
  return map[time] ?? time;
}

/**
 * Parse Adzuna credentials from stored string format "appId:appKey"
 */
export function parseAdzunaCredentials(stored: string): { appId: string; appKey: string } | null {
  const parts = stored.split(':');
  if (parts.length < 2) return null;
  return { appId: parts[0], appKey: parts.slice(1).join(':') };
}

// ---------------------------------------------------------------------------
// SerpAPI (Google Jobs) integration
// ---------------------------------------------------------------------------

export interface SerpApiSearchConfig {
  searchTerm: string;
  location?: string;
  country?: string; // 2-letter code, default 'us'
  language?: string; // 2-letter code, default 'en'
  maxPages?: number; // max pages to fetch, default 3
}

interface SerpApiJob {
  title: string;
  company_name: string;
  location: string;
  via: string;
  description: string;
  share_link?: string;
  job_id: string;
  detected_extensions: {
    posted_at?: string;
    schedule_type?: string;
    work_from_home?: boolean;
    salary?: string;
  };
  apply_options?: Array<{
    title: string;
    link: string;
  }>;
}

interface SerpApiResponse {
  jobs_results?: SerpApiJob[];
  serpapi_pagination?: {
    next_page_token?: string;
    next?: string;
  };
  error?: string;
}

export async function searchWithSerpApi(
  config: SerpApiSearchConfig,
  apiKey: string,
): Promise<ScrapedJob[]> {
  const allJobs: SerpApiJob[] = [];
  const maxPages = config.maxPages ?? 10;
  let nextPageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      engine: 'google_jobs',
      api_key: apiKey,
      q: config.searchTerm,
    });

    if (config.location) params.set('location', config.location);
    if (config.country) params.set('gl', config.country);
    if (config.language) params.set('hl', config.language ?? 'en');
    if (nextPageToken) params.set('next_page_token', nextPageToken);

    const url = `https://serpapi.com/search?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`SerpAPI error: ${response.status} ${body.slice(0, 200)}`);
      }
      const data = (await response.json()) as SerpApiResponse;

      if (data.error) {
        throw new Error(`SerpAPI error: ${data.error}`);
      }

      if (!data.jobs_results || data.jobs_results.length === 0) break;

      allJobs.push(...data.jobs_results);

      // Check for next page
      nextPageToken = data.serpapi_pagination?.next_page_token;
      if (!nextPageToken) break;
    } finally {
      clearTimeout(timeout);
    }

    // Basic rate limiting between pages
    if (page < maxPages - 1 && nextPageToken) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return allJobs
    .map((job) => {
      // Find the best apply URL from apply_options, or fall back to share_link
      const applyUrl = job.apply_options?.[0]?.link || job.share_link || '';

      return {
        title: job.title || 'Untitled',
        company: job.company_name || 'Unknown',
        location: job.location || '',
        description: job.description || '',
        url: applyUrl,
        remotePolicy: job.detected_extensions?.work_from_home ? 'remote' : undefined,
        employmentType: mapSerpApiScheduleType(job.detected_extensions?.schedule_type),
        salaryMin: parseSerpApiSalary(job.detected_extensions?.salary)?.min,
        salaryMax: parseSerpApiSalary(job.detected_extensions?.salary)?.max,
        salaryCurrency: 'USD',
        postedAt: job.detected_extensions?.posted_at,
        source: `serpapi:google_jobs`,
      };
    })
    .filter((j) => j.url && j.title !== 'Untitled');
}

function mapSerpApiScheduleType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  if (lower.includes('full')) return 'full-time';
  if (lower.includes('part')) return 'part-time';
  if (lower.includes('contract') || lower.includes('contractor')) return 'contract';
  if (lower.includes('intern')) return 'internship';
  return type;
}

function parseSerpApiSalary(
  salary: string | undefined,
): { min?: number; max?: number } | undefined {
  if (!salary) return undefined;
  // Salary strings look like "$120K - $180K a year" or "$50 - $70 an hour"
  const numbers = salary.match(/[\d,]+\.?\d*/g);
  if (!numbers || numbers.length === 0) return undefined;

  const parsed = numbers.map((n) => {
    const num = parseFloat(n.replace(/,/g, ''));
    // If the salary string contains "K", multiply by 1000
    const kIndex = salary.indexOf(n) + n.length;
    if (salary[kIndex]?.toLowerCase() === 'k') return num * 1000;
    return num;
  });

  if (parsed.length >= 2) {
    return { min: parsed[0], max: parsed[1] };
  }
  return { min: parsed[0] };
}
