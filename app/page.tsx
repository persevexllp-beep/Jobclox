import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getDefaultDashboardPath } from '@/lib/auth/guards';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  redirect(getDefaultDashboardPath(user.role));
}
