import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
} from 'lucide-react';
import BrandLogo from '@/src/components/BrandLogo';
import StudentJobSearchLottie from '@/src/components/experience/StudentJobSearchLottie';
import { getCurrentUser } from '@/lib/auth/session';
import { getDefaultDashboardPath } from '@/lib/auth/guards';
import { getPublicJobsRanked } from '@/lib/jobs/workflow';
import type { Job } from '@/src/types';
import { branding } from '@/src/config/branding';

export const metadata: Metadata = {
  title: `${branding.productName} | Verified jobs, internships, and hiring`,
  description: branding.metadata.description,
};

async function getFeaturedJobs(): Promise<Job[]> {
  try {
    const { getJobsByStatus } = await import('@/services/jobService');
    return getPublicJobsRanked(await getJobsByStatus('approved')).slice(0, 6);
  } catch {
    return [];
  }
}

const candidateSteps = [
  ['Build your signal', 'Bring your skills and resume into focus.'],
  ['Find your fit', 'See verified roles aligned to you.'],
  ['Make your move', 'Apply and follow every next step.'],
];

const recruiterBenefits = [
  ['One clear pipeline', 'Keep every decision in context.'],
  ['Stronger candidate signal', 'See fit, skills, and notes together.'],
  ['Trusted employer presence', 'Turn verification into candidate confidence.'],
];

const opportunityJourney = [
  { label: 'Discover', icon: Search },
  { label: 'Improve', icon: GraduationCap },
  { label: 'Apply', icon: ArrowRight },
  { label: 'Interview', icon: UsersRound },
  { label: 'Hired', icon: BadgeCheck },
];

function OpportunityJourneyVisual() {
  return (
    <div className="landing-journey-visual" role="img" aria-label="A candidate progresses from discovering a role to getting hired">
      <div className="landing-journey-glow" aria-hidden="true" />
      <StudentJobSearchLottie className="landing-student-lottie" label="Student searching for jobs and internships" />
      <div className="landing-opportunity-card">
        <div className="landing-opportunity-company">NS</div>
        <div><small>Best match</small><strong>Product Design Intern</strong><span>Northstar - Remote</span></div>
        <b>92%</b>
      </div>
      <ol className="landing-journey-path" aria-hidden="true">
        {opportunityJourney.map(({ label, icon: Icon }, index) => (
          <li key={label} className={index < 3 ? 'is-complete' : index === 3 ? 'is-current' : ''}><span><Icon /></span><small>{label}</small></li>
        ))}
      </ol>
      <div className="landing-growth-signal" aria-hidden="true"><Sparkles /><span><strong>Career signal +18%</strong><small>Skills aligned</small></span></div>
      <div className="landing-interview-signal" aria-hidden="true"><CheckCircle2 /><span><strong>Interview unlocked</strong><small>Your next chapter is moving</small></span></div>
    </div>
  );
}

export default async function HomePage() {
  const [user, featuredJobs] = await Promise.all([getCurrentUser(), getFeaturedJobs()]);
  const workspaceHref = user ? getDefaultDashboardPath(user.role) : '/login';
  const workspaceLabel = user ? 'Open workspace' : 'Sign in';

  return (
    <div className="landing-shell">
      <a className="pvx-skip-link" href="#main-content">Skip to main content</a>

      <header className="landing-nav-wrap">
        <nav className="landing-nav" aria-label="Primary navigation">
          <Link href="/" aria-label={`${branding.productName} home`}><BrandLogo subline={branding.tagline} /></Link>
          <div className="landing-nav-links">
            <a href="#opportunities">Opportunities</a>
            <a href="#students">For students</a>
            <a href="#employers">For employers</a>
            <a href="#trust">Why {branding.productName}</a>
          </div>
          <div className="landing-nav-actions">
            <Link className="landing-link-button" href={workspaceHref}>{workspaceLabel}</Link>
            {!user && <Link className="landing-primary-button" href="/login?mode=register&role=company">Post a job <ArrowRight aria-hidden="true" /></Link>}
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="landing-hero">
          <div className="landing-orb landing-orb-one" aria-hidden="true" />
          <div className="landing-orb landing-orb-two" aria-hidden="true" />
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <div className="landing-kicker"><Sparkles aria-hidden="true" /> {branding.tagline}</div>
              <h1>Move from potential to <span>your next opportunity.</span></h1>
              <p>Discover verified roles, grow your signal, and move toward work that fits.</p>
              <form className="landing-search" action="/login" aria-label="Find opportunities">
                <label>
                  <Search aria-hidden="true" />
                  <span className="landing-search-field-copy">
                    <strong>Role, skill, or company</strong>
                    <input name="search" placeholder="Search roles or skills" autoComplete="off" />
                  </span>
                </label>
                <label>
                  <MapPin aria-hidden="true" />
                  <span className="landing-search-field-copy">
                    <strong>Preferred location</strong>
                    <input name="location" placeholder="City or remote" autoComplete="address-level2" />
                  </span>
                </label>
                <button type="submit">Explore jobs <ArrowRight aria-hidden="true" /></button>
              </form>
              <div className="landing-popular" aria-label="Popular searches">
                <span>Popular:</span>
                {['Software internships', 'Remote jobs', 'Graduate roles'].map((item) => <Link key={item} href={`/login?search=${encodeURIComponent(item)}`}>{item}</Link>)}
              </div>
              <div className="landing-proof-row">
                <span><ShieldCheck aria-hidden="true" /> Verified opportunities</span>
                <span><Target aria-hidden="true" /> Profile-led matching</span>
                <span><BadgeCheck aria-hidden="true" /> Clear application tracking</span>
              </div>
            </div>

            <OpportunityJourneyVisual />
          </div>
        </section>

        <section className="landing-trust-strip" id="trust">
          <div className="landing-container">
            <span>Designed for focused career progress</span>
            <div><b>Verified</b><b>Transparent</b><b>Student-first</b><b>Recruiter-ready</b><b>Secure</b></div>
          </div>
        </section>

        <section className="landing-section" id="opportunities">
          <div className="landing-container">
            <div className="landing-section-heading">
              <div><span>Fresh opportunities</span><h2>Discover work worth growing into.</h2><p>Browse focused, moderated opportunities built for students, freshers, and early-career professionals.</p></div>
              <Link href="/login">View your recommendations <ArrowRight aria-hidden="true" /></Link>
            </div>
            {featuredJobs.length ? (
              <div className="landing-job-grid">
                {featuredJobs.map((job) => (
                  <article className="landing-job-card" key={job.id}>
                    <div className="landing-job-top"><div className="landing-company-mark">{job.companyName.slice(0, 2).toUpperCase()}</div><span>{job.jobType}</span></div>
                    <div><h3>{job.title}</h3><p>{job.companyName}</p></div>
                    <div className="landing-job-meta"><span><MapPin />{job.location || 'Flexible'}</span><span><BriefcaseBusiness />{job.experience || 'Early career'}</span></div>
                    <div className="landing-job-skills">{job.requirements.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div>
                    <Link href={`/login?job=${encodeURIComponent(job.id)}`}>View opportunity <ArrowRight aria-hidden="true" /></Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="landing-category-grid">
                {[
                  [BriefcaseBusiness, 'Graduate roles', 'Build your first full-time chapter.'],
                  [GraduationCap, 'Internships', 'Turn learning into credible experience.'],
                  [Target, 'Skill-aligned work', 'Find roles shaped around your strengths.'],
                ].map(([Icon, title, copy]) => {
                  const ItemIcon = Icon as typeof BriefcaseBusiness;
                  return <article key={String(title)}><ItemIcon /><h3>{String(title)}</h3><p>{String(copy)}</p><Link href="/login">Explore roles <ArrowRight /></Link></article>;
                })}
              </div>
            )}
          </div>
        </section>

        <section className="landing-section landing-section-tinted" id="students">
          <div className="landing-container landing-split-section">
            <div className="landing-section-heading is-stacked"><span>For students and freshers</span><h2>A career workspace that keeps the next step clear.</h2><p>Move beyond scattered job boards. Build a stronger signal, understand your fit, and keep every application organized.</p><Link className="landing-primary-button" href="/login">Sign in to your career workspace <ArrowRight /></Link></div>
            <div className="landing-step-list">
              {candidateSteps.map(([title, copy], index) => <article key={title}><b>0{index + 1}</b><div><h3>{title}</h3><p>{copy}</p></div></article>)}
            </div>
          </div>
        </section>

        <section className="landing-section" id="employers">
          <div className="landing-container landing-employer-panel">
            <div>
              <span className="landing-kicker"><Building2 /> For hiring teams</span>
              <h2>Hire emerging talent with more signal and less noise.</h2>
              <p>Publish roles, review relevant candidates, preserve pipeline context, and move hiring decisions forward from one premium workspace.</p>
              <div className="landing-employer-actions"><Link className="landing-primary-button" href="/login?mode=register&role=company">Start hiring <ArrowRight /></Link><Link className="landing-link-button is-dark" href="/login">Recruiter sign in</Link></div>
            </div>
            <div className="landing-benefit-grid">
              {recruiterBenefits.map(([title, copy], index) => {
                const Icon = [BarChart3, UsersRound, ShieldCheck][index];
                return <article key={title}><Icon /><h3>{title}</h3><p>{copy}</p></article>;
              })}
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-container">
            <div><span>Ready for the next move?</span><h2>Build a career signal or a hiring engine that compounds.</h2></div>
            <div><Link className="landing-primary-button is-light" href="/login">Candidate sign in <ArrowRight /></Link><Link className="landing-link-button is-dark" href="/login?mode=register&role=company">Hire with {branding.productName}</Link></div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container"><BrandLogo subline={branding.tagline} /><p>Trusted career infrastructure for ambitious students and thoughtful hiring teams.</p><div><a href="#students">Students</a><a href="#employers">Employers</a><Link href="/login">Sign in</Link></div><small>{branding.footer}</small></div>
      </footer>
    </div>
  );
}
