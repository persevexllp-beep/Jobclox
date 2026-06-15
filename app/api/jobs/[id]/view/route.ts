import { jsonError } from '@/lib/http/responses';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { incrementViewCount } = await import('@/services/jobService');
    await incrementViewCount(id);
    return new Response('OK', { status: 200 });
  } catch {
    return jsonError(500, 'Job service unavailable');
  }
}
