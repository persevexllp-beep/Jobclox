const STARTED_AT = Date.now();

export async function GET() {
  return Response.json({
    status: 'ok',
    version: process.env.npm_package_version || '0.0.0',
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
  });
}
