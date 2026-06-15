import Link from 'next/link';

const dashboardLinks = [
  { href: '/login', label: 'Login' },
  { href: '/candidate', label: 'Candidate Dashboard' },
  { href: '/recruiter', label: 'Recruiter Dashboard' },
  { href: '/admin', label: 'Admin Dashboard' },
];

export default function HomePage() {
  return (
    <main className="pvx-boot-screen">
      <div className="pvx-boot-card">
        <h1>Persevex Next.js Shell</h1>
        <p>Phase A scaffolding is in place. Existing Express APIs and services remain untouched.</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {dashboardLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
