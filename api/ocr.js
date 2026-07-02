/**
 * Vercel Serverless Function — 火山引擎 OCR 代理
 * 部署后自动映射为 /api/ocr
 *
 * 环境变量（在 Vercel 后台设置）：
 *   VOLC_ACCESS_KEY  — 火山引擎 Access Key
 *   VOLC_SECRET_KEY  — 火山引擎 Secret Key
 */

import crypto from 'crypto';
import https from 'https';

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function uriEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function signRequest(method, host, path_, query, headers, body) {
  const now = new Date();
  const xDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateShort = xDate.slice(0, 8);
  const region = 'cn-north-1';
  const service = 'cv';

  const normHeaders = {};
  for (const k of Object.keys(headers)) normHeaders[k.toLowerCase()] = headers[k].trim();
  normHeaders['host'] = host;
  normHeaders['x-date'] = xDate;

  const sortedQuery = Object.keys(query)
    .filter(k => query[k] !== undefined && query[k] !== null)
    .sort()
    .map(k => uriEncode(k) + '=' + uriEncode(String(query[k])))
    .join('&');

  const signedHeaders = Object.keys(normHeaders)
    .filter(k => k !== 'authorization')
    .sort();

  const canonicalHeaders = signedHeaders
    .map(k => k + ':' + normHeaders[k])
    .join('\n') + '\n';

  const payloadHash = sha256(body || '');

  const canonicalRequest = [
    method,
    path_ || '/',
    sortedQuery,
    canonicalHeaders,
    signedHeaders.join(';'),
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateShort}/${region}/${service}/request`;
  const stringToSign = [
    'HMAC-SHA256',
    xDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(process.env.VOLC_SECRET_KEY, dateShort);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorization = `HMAC-SHA256 Credential=${process.env.VOLC_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;

  return { authorization, xDate };
}

function volcRequest(method, path_, query, body, contentType) {
  return new Promise((resolve, reject) => {
    const host = 'visual.volcengineapi.com';
    const headers = {};
    if (contentType) headers['Content-Type'] = contentType;

    const { authorization, xDate } = signRequest(method, host, path_, query, headers, body);

    headers['Authorization'] = authorization;
    headers['X-Date'] = xDate;
    headers['Host'] = host;

    const url = new URL(`https://${host}${path_}`);
    if (query && Object.keys(query).length > 0) {
      url.search = new URLSearchParams(query).toString();
    }

    const opts = {
      hostname: host,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 30000,
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });

    if (body) req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json ? res.status(405).json({ error: 'Method not allowed' }) : res.status(405).end('Method not allowed');
  }

  // 健康检查（GET /api/ocr 也返回状态）
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'volc-ocr' });
  }

  const { imageBase64, imageUrl, halfToFull } = req.body || {};

  if (!imageBase64 && !imageUrl) {
    return res.status(400).json({ error: '缺少 imageBase64 或 imageUrl 参数' });
  }

  try {
    const formParams = {};
    if (imageBase64) {
      formParams.image_base64 = imageBase64;
    } else {
      formParams.image_url = imageUrl;
    }
    if (halfToFull === true || halfToFull === 'true') {
      formParams.half_to_full = 'true';
    }

    const formBody = new URLSearchParams(formParams).toString();

    const result = await volcRequest(
      'POST', '/',
      { Action: 'OCRNormal', Version: '2020-08-26' },
      formBody,
      'application/x-www-form-urlencoded'
    );

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('OCR Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
