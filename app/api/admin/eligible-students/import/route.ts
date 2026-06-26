import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { logger } from '@/services/logger';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }
  if (user.role !== 'admin') {
    return jsonError(403, 'Requires administrator access');
  }

  const body = await request.json().catch(() => null);
  const csvText = typeof body?.csvText === 'string' ? body.csvText : '';
  if (!csvText.trim()) {
    return jsonError(400, 'CSV content is required');
  }

  try {
    const { importEligibleStudentsCsv } = await import('@/services/eligibleStudentService');
    const result = await importEligibleStudentsCsv(csvText);
    logger.info('eligible-students', 'admin import completed', {
      adminUserId: user.id,
      totalRows: result.totalRows,
      imported: result.imported,
      failed: result.failed.length,
    });
    return jsonOk({ result });
  } catch (err) {
    logger.error('eligible-students', 'admin import failed', err);
    return jsonError(400, err instanceof Error ? err.message : 'Eligible student import failed');
  }
}
