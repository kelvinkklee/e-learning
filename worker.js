// 香港小學樂學 - LLM 後端代理 (Cloudflare Worker)
// 作用：代理前端請求去華為 MaaS，繞過 CORS 預檢問題，並保護 API key
//
// 部署後，喺 App 嘅「AI 設定」入面：
//   Endpoint 填：https://<你的-worker>.workers.dev
//   API Key 填：你嘅華為 MaaS key（仍然存喺用戶本機，唔經 Worker 儲存）

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// 華為 MaaS 上游地址（可改）
const UPSTREAM = 'https://api-ap-southeast-1.modelarts-maas.com/openai/v1/chat/completions';

// 允許嘅來源（可改為你嘅 GitHub Pages 域名）
const ALLOWED_ORIGINS = ['https://kelvinkklee.github.io', 'http://localhost:8123'];

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
});

async function handleRequest(request) {
  const origin = request.headers.get('Origin') || '';

  // 處理 CORS 預檢請求
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // 只接受 POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '只支援 POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  try {
    // 讀取前端傳嚟嘅請求體（包含 messages、model 等）
    const body = await request.json();

    // 提取 API key（由前端傳嚟，Worker 不儲存）
    const apiKey = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || body.api_key;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: '缺少 API Key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // 轉發去華為 MaaS（server-to-server，無 CORS 問題）
    const upstreamBody = {
      model: body.model || 'glm-5.2',
      messages: body.messages,
      temperature: body.temperature ?? 0.6,
      max_tokens: body.max_tokens || 1500,
    };
    if (body.thinking) upstreamBody.thinking = body.thinking;
    if (body.response_format) upstreamBody.response_format = body.response_format;

    const upstreamResp = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(upstreamBody),
    });

    const data = await upstreamResp.text();

    return new Response(data, {
      status: upstreamResp.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: '代理錯誤: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}
