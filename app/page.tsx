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
import { getCurrentUser } from '@/lib/auth/session';
import { getDefaultDashboardPath } from '@/lib/auth/guards';
import { getPublicJobsRanked } from '@/lib/jobs/workflow';
import type { Job } from '@/src/types';

export const metadata: Metadata = {
  title: 'Persevex | Verified jobs, internships, and hiring',
  description: 'Discover verified jobs and internships, build a stronger career profile, or hire high-intent early-career talent with Persevex.',
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
  ['Create your career profile', 'Turn your skills, education, and resume into a clear candidate signal.'],
  ['Discover relevant roles', 'Focus on verified jobs and internships aligned with your goals.'],
  ['Apply with confidence', 'Understand your readiness, apply, and track every next step.'],
];

const recruiterBenefits = [
  ['Structured hiring pipeline', 'Move from role creation to candidate review without losing context.'],
  ['Candidate-fit intelligence', 'Review matched skills, missing skills, notes, and hiring signals together.'],
  ['Verified employer identity', 'Build candidate trust through a transparent moderation and verification flow.'],
];

export default async function HomePage() {
  const [user, featuredJobs] = await Promise.all([getCurrentUser(), getFeaturedJobs()]);
  const workspaceHref = user ? getDefaultDashboardPath(user.role) : '/login';
  const workspaceLabel = user ? 'Open workspace' : 'Sign in';

  return (
    <div className="landing-shell">
      <a className="pvx-skip-link" href="#main-content">Skip to main content</a>

      <header className="landing-nav-wrap">
        <nav className="landing-nav" aria-label="Primary navigation">
          <Link href="/" aria-label="Persevex home"><BrandLogo subline="Jobs · Internships · Hiring" /></Link>
          <div className="landing-nav-links">
            <a href="#opportunities">Opportunities</a>
            <a href="#students">For students</a>
            <a href="#employers">For employers</a>
            <a href="#trust">Why Persevex</a>
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
              <div className="landing-kicker"><Sparkles aria-hidden="true" /> India’s early-career opportunity engine</div>
              <h1>Move from potential to <span>your next opportunity.</span></h1>
              <p>Persevex brings verified jobs, internships, application tracking, and career intelligence into one focused workspace for students and hiring teams.</p>
              <form className="landing-search" action="/login" aria-label="Find opportunities">
                <label>
                  <Search aria-hidden="true" />
                  <span className="sr-only">Role, skill, or company</span>
                  <input name="search" placeholder="Role, skill, or company" autoComplete="off" />
                </label>
                <label>
                  <MapPin aria-hidden="true" />
                  <span className="sr-only">Preferred location</span>
                  <input name="location" placeholder="Location or remote" autoComplete="address-level2" />
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

            <div className="landing-product-preview" aria-label="Persevex product preview">
              <div className="landing-preview-bar"><span /><span /><span /><em>Career workspace</em></div>
              <div className="landing-preview-content">
                <div className="landing-preview-sidebar">
                  <strong>Good morning</strong>
                  <small>Your career signal is getting stronger.</small>
                  <div className="landing-progress"><span style={{ width: '78%' }} /></div>
                  <b>78% profile strength</b>
                  <ul>
                    <li className="is-active"><BriefcaseBusiness /> Discover jobs</li>
                    <li><CheckCircle2 /> Applications</li>
                    <li><GraduationCap /> Career support</li>
                  </ul>
                </div>
                <div className="landing-preview-main">
                  <div className="landing-preview-heading"><div><small>Recommended for you</small><strong>High-intent opportunities</strong></div><span>24 roles</span></div>
                  {[
                    ['Product Design Intern', 'Northstar Labs', 'Remote', '92%'],
                    ['Frontend Engineer', 'Orbit Systems', 'Bengaluru', '86%'],
                    ['Business Analyst', 'Kinetic Works', 'Hybrid', '81%'],
                  ].map(([role, company, location, match]) => (
                    <article key={role} className="landing-preview-job">
                      <div className="landing-company-mark">{company.slice(0, 2).toUpperCase()}</div>
                      <div><strong>{role}</strong><small>{company} · {location}</small></div>
                      <span>{match} match</span>
                    </article>
                  ))}
                </div>
              </div>
            </div>
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
              <Link href="/login?mode=register&role=candidate">View your recommendations <ArrowRight aria-hidden="true" /></Link>
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
                  return <article key={String(title)}><ItemIcon /><h3>{String(title)}</h3><p>{String(copy)}</p><Link href="/login?mode=register">Explore roles <ArrowRight /></Link></article>;
                })}
              </div>
            )}
          </div>
        </section>

        <section className="landing-section landing-section-tinted" id="students">
          <div className="landing-container landing-split-section">
            <div className="landing-section-heading is-stacked"><span>For students and freshers</span><h2>A career workspace that keeps the next step clear.</h2><p>Move beyond scattered job boards. Build a stronger signal, understand your fit, and keep every application organized.</p><Link className="landing-primary-button" href="/login?mode=register&role=candidate">Create your career workspace <ArrowRight /></Link></div>
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
            <div><span>Ready for the next move?</span><h2>Build a career signal—or a hiring engine—that compounds.</h2></div>
            <div><Link className="landing-primary-button is-light" href="/login?mode=register&role=candidate">Join as a candidate <ArrowRight /></Link><Link className="landing-link-button is-dark" href="/login?mode=register&role=company">Hire with Persevex</Link></div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container"><BrandLogo subline="Jobs · Internships · Placement" /><p>Trusted career infrastructure for ambitious students and thoughtful hiring teams.</p><div><a href="#students">Students</a><a href="#employers">Employers</a><Link href="/login">Sign in</Link></div><small>© {new Date().getFullYear()} Persevex. All rights reserved.</small></div>
      </footer>
    </div>
  );
}
