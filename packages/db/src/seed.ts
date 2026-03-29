import { db } from './client.js';
import {
  applications,
  candidates,
  experienceBlocks,
  jobs,
  jobScores,
  jobSources,
  preferences,
  projects,
  skills,
  tenants,
  users,
} from './schema/index.js';
import { createId } from './utils.js';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Clean existing data (in reverse dependency order)
  console.log('Cleaning existing data...');
  await db.delete(applications);
  await db.delete(jobScores);
  await db.delete(jobs);
  await db.delete(jobSources);
  await db.delete(preferences);
  await db.delete(projects);
  await db.delete(experienceBlocks);
  await db.delete(skills);
  await db.delete(candidates);
  await db.delete(users);
  await db.delete(tenants);

  // Create tenant
  const tenantId = createId();
  await db.insert(tenants).values({
    id: tenantId,
    name: 'Demo Workspace',
    slug: 'demo',
    plan: 'free',
  });
  console.log('✅ Created tenant: Demo Workspace');

  // Create user (sign up through the UI for a real account with a password)
  const userId = createId();
  await db.insert(users).values({
    id: userId,
    tenantId,
    email: 'pilot@demo.com',
    name: 'Demo Pilot',
    emailVerified: false,
    role: 'admin',
  });
  console.log('✅ Created user: pilot@demo.com (no password - sign up via UI for a real account)');

  // Create candidate profile
  const candidateId = createId();
  await db.insert(candidates).values({
    id: candidateId,
    userId,
    tenantId,
    headline: 'Senior Full-Stack Engineer',
    summary:
      'Experienced full-stack developer with 8+ years building web applications. Passionate about TypeScript, React, and cloud architecture. Looking for a senior or staff-level role at a product-focused company.',
    yearsOfExperience: 8,
    currentTitle: 'Senior Software Engineer',
    currentCompany: 'TechCorp Inc.',
    location: 'San Francisco, CA',
    remotePreference: 'flexible',
    salaryMin: 180000,
    salaryMax: 250000,
    salaryCurrency: 'USD',
    visaRequired: false,
  });
  console.log('✅ Created candidate profile');

  // Create skills
  const skillsData = [
    { name: 'TypeScript', category: 'language', confidenceScore: 95, yearsUsed: 6 },
    { name: 'JavaScript', category: 'language', confidenceScore: 98, yearsUsed: 8 },
    { name: 'Python', category: 'language', confidenceScore: 75, yearsUsed: 4 },
    { name: 'React', category: 'framework', confidenceScore: 95, yearsUsed: 6 },
    { name: 'Next.js', category: 'framework', confidenceScore: 85, yearsUsed: 3 },
    { name: 'Node.js', category: 'framework', confidenceScore: 90, yearsUsed: 7 },
    { name: 'PostgreSQL', category: 'tool', confidenceScore: 85, yearsUsed: 6 },
    { name: 'Redis', category: 'tool', confidenceScore: 70, yearsUsed: 3 },
    { name: 'Docker', category: 'tool', confidenceScore: 80, yearsUsed: 5 },
    { name: 'AWS', category: 'platform', confidenceScore: 80, yearsUsed: 5 },
    { name: 'Kubernetes', category: 'platform', confidenceScore: 60, yearsUsed: 2 },
    { name: 'GraphQL', category: 'tool', confidenceScore: 75, yearsUsed: 3 },
    { name: 'Tailwind CSS', category: 'framework', confidenceScore: 90, yearsUsed: 3 },
    { name: 'Agile', category: 'methodology', confidenceScore: 85, yearsUsed: 7 },
    { name: 'System Design', category: 'methodology', confidenceScore: 80, yearsUsed: 4 },
  ];

  for (const s of skillsData) {
    await db.insert(skills).values({
      candidateId,
      name: s.name,
      category: s.category,
      confidenceScore: s.confidenceScore,
      yearsUsed: s.yearsUsed,
    });
  }
  console.log(`✅ Created ${skillsData.length} skills`);

  // Create experience blocks
  const exp1Id = createId();
  await db.insert(experienceBlocks).values({
    id: exp1Id,
    candidateId,
    company: 'TechCorp Inc.',
    title: 'Senior Software Engineer',
    location: 'San Francisco, CA',
    startDate: new Date('2021-03-01'),
    current: true,
    description:
      'Leading frontend architecture and full-stack development for the core product platform.',
    bullets: [
      'Led migration from JavaScript to TypeScript across 200+ files, reducing production bugs by 40%',
      'Architected and implemented real-time collaboration features serving 50K+ daily users',
      'Built CI/CD pipeline reducing deployment time from 45 minutes to 8 minutes',
      'Mentored 4 junior engineers and led technical interviews',
    ],
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker'],
  });

  const exp2Id = createId();
  await db.insert(experienceBlocks).values({
    id: exp2Id,
    candidateId,
    company: 'StartupCo',
    title: 'Full-Stack Developer',
    location: 'Remote',
    startDate: new Date('2018-06-01'),
    endDate: new Date('2021-02-28'),
    current: false,
    description: 'Full-stack development for a B2B SaaS platform in the fintech space.',
    bullets: [
      'Built customer-facing dashboard processing $10M+ in daily transactions',
      'Implemented GraphQL API layer replacing legacy REST endpoints',
      'Reduced page load times by 60% through code splitting and lazy loading',
      'Integrated Stripe payment processing and subscription management',
    ],
    skills: ['JavaScript', 'React', 'Node.js', 'GraphQL', 'PostgreSQL', 'Redis'],
  });

  const exp3Id = createId();
  await db.insert(experienceBlocks).values({
    id: exp3Id,
    candidateId,
    company: 'WebAgency',
    title: 'Junior Developer',
    location: 'New York, NY',
    startDate: new Date('2016-09-01'),
    endDate: new Date('2018-05-31'),
    current: false,
    description: 'Client-facing web development for various businesses.',
    bullets: [
      'Developed 15+ client websites using React and Next.js',
      'Built custom CMS solutions for e-commerce clients',
      'Managed client relationships and gathered requirements',
    ],
    skills: ['JavaScript', 'React', 'Next.js', 'CSS', 'HTML'],
  });
  console.log('✅ Created 3 experience blocks');

  // Create projects
  await db.insert(projects).values({
    candidateId,
    name: 'Open Source Component Library',
    description:
      'A React component library with 50+ accessible, customizable components. 2K+ GitHub stars.',
    url: 'https://github.com/demo/components',
    skills: ['TypeScript', 'React', 'Tailwind CSS', 'Storybook'],
    highlights: [
      '2,000+ GitHub stars, 100+ contributors',
      'Full accessibility compliance (WCAG 2.1 AA)',
      'Used in production by 50+ companies',
    ],
  });
  console.log('✅ Created 1 project');

  // Create preferences
  const prefsData = [
    {
      key: 'target_cities',
      value: 'San Francisco, New York, Seattle, Austin',
      category: 'location' as const,
    },
    { key: 'open_to_relocation', value: 'yes', category: 'location' as const },
    { key: 'min_salary', value: '180000', category: 'salary' as const },
    {
      key: 'target_roles',
      value: 'Senior Engineer, Staff Engineer, Tech Lead',
      category: 'role' as const,
    },
    { key: 'preferred_company_size', value: 'startup, mid-size', category: 'company' as const },
    { key: 'industries', value: 'SaaS, Developer Tools, AI/ML', category: 'company' as const },
  ];

  for (const p of prefsData) {
    await db.insert(preferences).values({
      candidateId,
      ...p,
    });
  }
  console.log(`✅ Created ${prefsData.length} preferences`);

  // Create job sources
  const sourceId = createId();
  await db.insert(jobSources).values({
    id: sourceId,
    tenantId,
    name: 'Manual Entry',
    type: 'manual',
    config: {},
    enabled: true,
  });
  console.log('✅ Created 1 job source');

  // Create sample jobs
  const jobsData = [
    {
      id: createId(),
      tenantId,
      sourceId,
      company: 'Vercel',
      title: 'Senior Frontend Engineer',
      location: 'San Francisco, CA',
      remotePolicy: 'remote' as const,
      compensationMin: 190000,
      compensationMax: 260000,
      compensationCurrency: 'USD',
      compensationType: 'salary' as const,
      employmentType: 'full_time' as const,
      yearsRequired: 5,
      mustHaveSkills: ['React', 'TypeScript', 'Next.js'],
      niceToHaveSkills: ['Rust', 'WebAssembly', 'Turborepo'],
      domain: 'Developer Tools',
      sponsorship: 'yes' as const,
      applyUrl: 'https://vercel.com/careers',
      sourceUrl: 'https://vercel.com/careers/senior-frontend',
      rawDescription: 'We are looking for a Senior Frontend Engineer to join our team...',
      parsedDescription: 'Senior Frontend Engineer at Vercel. Build the future of web development.',
    },
    {
      id: createId(),
      tenantId,
      sourceId,
      company: 'Stripe',
      title: 'Staff Software Engineer, Dashboard',
      location: 'San Francisco, CA',
      remotePolicy: 'hybrid' as const,
      compensationMin: 220000,
      compensationMax: 340000,
      compensationCurrency: 'USD',
      compensationType: 'salary' as const,
      employmentType: 'full_time' as const,
      yearsRequired: 8,
      mustHaveSkills: ['TypeScript', 'React', 'Ruby'],
      niceToHaveSkills: ['GraphQL', 'Kafka', 'gRPC'],
      domain: 'Fintech',
      sponsorship: 'yes' as const,
      applyUrl: 'https://stripe.com/jobs',
      sourceUrl: 'https://stripe.com/jobs/staff-swe-dashboard',
      rawDescription:
        'Join the Stripe Dashboard team to build the interface millions of businesses use...',
      parsedDescription:
        'Staff Software Engineer on Stripe Dashboard. Build financial tools at scale.',
    },
    {
      id: createId(),
      tenantId,
      sourceId,
      company: 'Anthropic',
      title: 'Full-Stack Engineer, Developer Platform',
      location: 'San Francisco, CA',
      remotePolicy: 'hybrid' as const,
      compensationMin: 200000,
      compensationMax: 300000,
      compensationCurrency: 'USD',
      compensationType: 'salary' as const,
      employmentType: 'full_time' as const,
      yearsRequired: 5,
      mustHaveSkills: ['TypeScript', 'React', 'Python'],
      niceToHaveSkills: ['AI/ML', 'LLM', 'System Design'],
      domain: 'AI/ML',
      sponsorship: 'yes' as const,
      applyUrl: 'https://anthropic.com/careers',
      sourceUrl: 'https://anthropic.com/careers/full-stack-dev-platform',
      rawDescription: 'Help build the developer platform for Claude...',
      parsedDescription: 'Full-Stack Engineer at Anthropic. Build the developer platform for AI.',
    },
  ];

  for (const job of jobsData) {
    await db.insert(jobs).values(job);
  }
  console.log(`✅ Created ${jobsData.length} sample jobs`);

  // Create sample job scores
  for (let i = 0; i < jobsData.length; i++) {
    const job = jobsData[i];
    const fitScore = [88, 72, 85][i];
    const compScore = [82, 65, 78][i];
    const overallScore = Math.round(fitScore * 0.5 + compScore * 0.5);
    const recommendation =
      overallScore >= 75 ? 'strong_apply' : overallScore >= 60 ? 'apply' : 'maybe';

    await db.insert(jobScores).values({
      jobId: job.id,
      candidateId,
      fitScore,
      competitivenessScore: compScore,
      overallScore,
      fitBreakdown: {
        titleMatch: [90, 70, 85][i],
        compensationFit: [85, 60, 80][i],
        locationFit: [95, 80, 80][i],
        stackOverlap: [85, 65, 75][i],
        seniorityFit: [88, 80, 90][i],
        industryFit: [85, 75, 100][i],
      },
      competitivenessBreakdown: {
        requiredSkillsOverlap: [90, 60, 80][i],
        experienceDepth: [85, 70, 80][i],
        domainRelevance: [70, 55, 75][i],
        leadershipMatch: [80, 75, 70][i],
        adjacentSkills: [85, 60, 80][i],
        gapPenalty: [18, 30, 20][i],
      },
      recommendation: recommendation as 'strong_apply' | 'apply' | 'maybe' | 'skip',
      reasoning: [
        "Strong match: TypeScript/React expertise aligns perfectly with Vercel's stack. Remote-friendly and compensation within range.",
        'Good match but Ruby is a gap. Compensation is excellent. Strong frontend skills compensate for missing backend experience.',
        'Great cultural and technical fit. Python experience plus TypeScript/React covers the stack. AI domain is a strong interest area.',
      ][i],
    });
  }
  console.log(`✅ Created ${jobsData.length} job scores`);

  // Create a sample application
  await db.insert(applications).values({
    jobId: jobsData[0].id,
    candidateId,
    tenantId,
    status: 'applied',
    appliedAt: new Date('2026-03-20'),
    notes: 'Applied through the website. Referred by a friend who works there.',
  });
  console.log('✅ Created 1 sample application');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nDemo credentials:');
  console.log('  Email: pilot@demo.com');
  console.log('  Password: (set up via the auth system)\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
