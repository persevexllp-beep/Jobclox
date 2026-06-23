import { getCurrentUser } from '@/lib/auth/session';
import { jsonError } from '@/lib/http/responses';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') return jsonError(403, 'Admin account required');
  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'filtered';
  try {
    const [{ getExternalJobApplicationsForExport, countExternalJobApplicationsForExport }, exports] = await Promise.all([
      import('@/services/externalJobApplicationService'), import('@/lib/exports/externalLeadExport'),
    ]);
    const filters = scope === 'all' ? {} : {
      search: url.searchParams.get('search') || undefined, company: url.searchParams.get('company') || undefined,
      source: url.searchParams.get('source') || undefined, status: url.searchParams.get('status') || undefined,
      dateFrom: url.searchParams.get('dateFrom') || undefined, dateTo: url.searchParams.get('dateTo') || undefined,
      jobId: url.searchParams.get('jobId') || undefined,
    };
    const total = await countExternalJobApplicationsForExport(filters);
    if (total > 50_000) return jsonError(413, 'Export exceeds 50,000 rows. Narrow the filters and retry.');
    const leads = await getExternalJobApplicationsForExport(filters, 50_000);
    const body = format === 'xlsx' ? await exports.createExternalLeadXlsx(leads) : exports.createExternalLeadCsv(leads);
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exports.externalLeadExportFilename(format)}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-Export-Row-Count': String(leads.length),
      },
    });
  } catch {
    return jsonError(500, 'External lead export failed');
  }
}
