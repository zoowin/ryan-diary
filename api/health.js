/**
 * Vercel Serverless Function — 健康检查
 * 部署后自动映射为 /api/health
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const hasKeys = !!(process.env.VOLC_ACCESS_KEY && process.env.VOLC_SECRET_KEY);

  res.status(200).json({
    ok: true,
    service: 'parent-diary-api',
    volcConfigured: hasKeys,
    env: {
      hasAccessKey: !!process.env.VOLC_ACCESS_KEY,
      hasSecretKey: !!process.env.VOLC_SECRET_KEY,
      hasArkKey: !!process.env.VOLC_ARK_API_KEY,
    }
  });
}
