/**
 * Cloudflare Workers - 新聞抓取定時任務
 * 替代 Python cron job，使用 Cloudflare Workers 的 Cron Triggers
 */

export interface Env {
  // Firebase Functions 端點 URL
  FIREBASE_FUNCTION_GOV_NEWS_URL: string;
  FIREBASE_FUNCTION_RTHK_NEWS_URL: string;
  FIREBASE_FUNCTION_GOOGLE_NEWS_URL: string;
  FIREBASE_FUNCTION_UPDATE_EVENT_STATS_URL: string;
  // 可選：用於驗證的 API Key（如果需要）
  API_KEY?: string;
}

/**
 * 調用 Firebase Function 的手動觸發端點
 */
async function callFirebaseFunction(url: string, apiKey?: string): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // 如果設置了 API Key，添加到請求頭
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  return response;
}

/**
 * Cron Trigger: 每 10 分鐘檢查新聞
 * 執行時間：每 10 分鐘（例如：00:00, 00:10, 00:20, 00:30...）
 * 同時檢查政府新聞和 RTHK 新聞，並使用 AI 進行分類
 */
export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const cron = event.cron;

    // 每 10 分鐘執行：同時檢查政府新聞和 RTHK 新聞
    if (cron === '*/10 * * * *') {
      // 並行執行兩個新聞檢查任務
      ctx.waitUntil(handleGovNews(env));
      ctx.waitUntil(handleRTHKNews(env));
    }

    // 每 2 小時執行：更新事件統計（與 Firebase Functions 的定時任務同步）
    if (cron === '0 */2 * * *') {
      ctx.waitUntil(handleUpdateEventStats(env));
    }
  },

  // HTTP 端點（用於手動觸發和測試）
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 手動觸發政府新聞檢查
    if (path === '/gov-news' && request.method === 'GET') {
      return handleGovNews(env);
    }

    // 手動觸發 RTHK 新聞檢查
    if (path === '/rthk-news' && request.method === 'GET') {
      return handleRTHKNews(env);
    }

    // 手動觸發 Google News 檢查
    if (path === '/google-news' && request.method === 'GET') {
      return handleGoogleNews(env);
    }

    // 手動觸發更新事件統計
    if (path === '/update-event-stats' && request.method === 'GET') {
      return handleUpdateEventStats(env);
    }

    // 健康檢查
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

/**
 * 處理政府新聞檢查
 */
async function handleGovNews(env: Env): Promise<Response> {
  try {
    if (!env.FIREBASE_FUNCTION_GOV_NEWS_URL) {
      throw new Error('FIREBASE_FUNCTION_GOV_NEWS_URL is not set');
    }

    const response = await callFirebaseFunction(
      env.FIREBASE_FUNCTION_GOV_NEWS_URL,
      env.API_KEY
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Firebase Function error: ${JSON.stringify(result)}`);
    }

    console.log(`✅ 政府新聞檢查完成: ${result.message || 'Success'}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: '政府新聞檢查完成',
        result,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ 政府新聞檢查失敗:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * 處理 RTHK 新聞檢查
 */
async function handleRTHKNews(env: Env): Promise<Response> {
  try {
    if (!env.FIREBASE_FUNCTION_RTHK_NEWS_URL) {
      throw new Error('FIREBASE_FUNCTION_RTHK_NEWS_URL is not set');
    }

    const response = await callFirebaseFunction(
      env.FIREBASE_FUNCTION_RTHK_NEWS_URL,
      env.API_KEY
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Firebase Function error: ${JSON.stringify(result)}`);
    }

    console.log(`✅ RTHK 新聞檢查完成: ${result.message || 'Success'}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'RTHK 新聞檢查完成',
        result,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ RTHK 新聞檢查失敗:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * 處理 Google News 檢查
 */
async function handleGoogleNews(env: Env): Promise<Response> {
  try {
    if (!env.FIREBASE_FUNCTION_GOOGLE_NEWS_URL) {
      throw new Error('FIREBASE_FUNCTION_GOOGLE_NEWS_URL is not set');
    }

    const response = await callFirebaseFunction(
      env.FIREBASE_FUNCTION_GOOGLE_NEWS_URL,
      env.API_KEY
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Firebase Function error: ${JSON.stringify(result)}`);
    }

    console.log(`✅ Google News 檢查完成: ${result.message || 'Success'}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Google News 檢查完成',
        result,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ Google News 檢查失敗:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * 處理事件統計更新
 */
async function handleUpdateEventStats(env: Env): Promise<Response> {
  try {
    if (!env.FIREBASE_FUNCTION_UPDATE_EVENT_STATS_URL) {
      throw new Error('FIREBASE_FUNCTION_UPDATE_EVENT_STATS_URL is not set');
    }

    const response = await callFirebaseFunction(
      env.FIREBASE_FUNCTION_UPDATE_EVENT_STATS_URL,
      env.API_KEY
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Firebase Function error: ${JSON.stringify(result)}`);
    }

    console.log(`✅ 事件統計更新完成: ${result.message || 'Success'}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: '事件統計更新完成',
        result,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ 事件統計更新失敗:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

