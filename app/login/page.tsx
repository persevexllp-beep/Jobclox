import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="pvx-boot-screen">
      <div className="pvx-boot-card">
        <h1>Login Route Placeholder</h1>
        <p>Authentication migration is planned for a later phase. Express auth remains the source of truth for now.</p>
        <Link href="/">Back to Home</Link>
      </div>
    </main>
  );
}
