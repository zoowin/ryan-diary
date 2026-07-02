/**
 * Vercel Serverless Function — 豆包大模型解析 OCR 文本
 * 部署后自动映射为 /api/parse
 *
 * 环境变量：
 *   VOLC_ARK_API_KEY — 火山引擎 Ark API Key
 */

import https from 'https';

function arkChat(messages, { temperature = 0.3, maxTokens = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.VOLC_ARK_API_KEY;
    if (!apiKey) {
      reject(new Error('未配置 VOLC_ARK_API_KEY'));
      return;
    }

    const body = JSON.stringify({
      model: 'ep-20260702115834-r9p6s',
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const opts = {
      hostname: 'ark.cn-beijing.volces.com',
      port: 443,
      path: '/api/v3/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ error: data }); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ark request timeout')); });
    req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json ? res.status(405).json({ error: 'Method not allowed' }) : res.status(405).end();
  }

  const { ocrText, studentNumber, studentName } = req.body || {};

  if (!ocrText) {
    return res.status(400).json({ error: '缺少 ocrText 参数' });
  }

  const prompt = `你是一个老师消息解析助手。请分析以下老师发在班级群里的文字内容，提取成结构化记录，用于自动填充家长记录表单。

老师消息原文：
"""
${ocrText}
"""

学生信息：
- 姓名：${studentName || '皓皓'}
- 学号：${studentNumber || '29'}

请提取以下信息并以JSON格式返回（只返回JSON，不要其他文字）。字段含义与约束：
- recordType：记录类型，可选值：teacher_feedback、grade、dictation、homework、sport、diary、tutoring
- subject：科目名称（如：数学、语文、英语）
- examName：考试/测验名称
- grade：等级制成绩，可选值：A+、A、A-、B+、B、B-、C、需努力（没有则 null）
- classRank：班级排名（数字，没有则 null）
- studentResult：该学生的等级或成绩（如：A+、A、A-、B、90分），根据学号在原文中查找匹配
- result：听写结果，可选 full_mark/errors/not_submitted
- errorCount：听写错误数（数字，没有则 0）
- errorWords：错误字词（逗号分隔）
- completion：作业完成状态，可选 done/partial/not_done
- duration：用时分钟（数字，没有则 null）
- homeworkStatus：晚辅作业状态，可选 done/partial/not_done
- performance：晚辅表现，可选 excellent/good/normal/poor
- activity：运动项目（如：跳绳、跑步、游泳）
- count：运动数量（数字，没有则 null）
- unit：运动单位（如：个、公里、米、分钟）
- mood：心情，可选 happy/normal/sad/excited
- rawText：老师消息的完整原文
- content：一句话摘要，包含学生姓名、科目和表现评价

返回示例：
{
  "recordType": "teacher_feedback",
  "subject": "数学",
  "examName": "第二次期末复习综合过关",
  "grade": "A+",
  "classRank": null,
  "studentResult": "A+",
  "result": "",
  "errorCount": 0,
  "errorWords": "",
  "completion": "",
  "duration": null,
  "homeworkStatus": "",
  "performance": "",
  "activity": "",
  "count": null,
  "unit": "",
  "mood": "",
  "rawText": "...",
  "content": "皓皓在数学第二次期末复习综合过关中获得A+，表现优秀！"
}`;

  try {
    const result = await arkChat([
      { role: 'system', content: '你是一个精确的JSON解析器，只返回JSON，不要任何解释。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.1, maxTokens: 1000 });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    const rawContent = result.choices?.[0]?.message?.content || '';
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: '解析失败：模型返回非JSON', raw: rawContent });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.status(200).json({ code: 10000, data: parsed });

  } catch (err) {
    console.error('Parse Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
