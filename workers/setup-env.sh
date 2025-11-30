#!/bin/bash

# Cloudflare Workers 環境變量快速設置腳本

PROJECT_ID="taipo-fire-suppoe"
REGION="asia-east1"

GOV_NEWS_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/manualCheckGovNews"
RTHK_NEWS_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/manualCheckRTHKNews"
GOOGLE_NEWS_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/manualCheckGoogleNews"
UPDATE_EVENT_STATS_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/manualUpdateEventStats"

echo "🚀 設置 Cloudflare Workers 環境變量..."
echo ""
echo "項目 ID: ${PROJECT_ID}"
echo "區域: ${REGION}"
echo ""
echo "政府新聞 URL: ${GOV_NEWS_URL}"
echo "RTHK 新聞 URL: ${RTHK_NEWS_URL}"
echo "Google News URL: ${GOOGLE_NEWS_URL}"
echo "事件統計更新 URL: ${UPDATE_EVENT_STATS_URL}"
echo ""

# 檢查是否已安裝 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ 錯誤: 未找到 wrangler CLI"
    echo "請先安裝: npm install -g wrangler"
    exit 1
fi

# 設置政府新聞 URL
echo "📝 設置 FIREBASE_FUNCTION_GOV_NEWS_URL..."
echo "${GOV_NEWS_URL}" | wrangler secret put FIREBASE_FUNCTION_GOV_NEWS_URL

if [ $? -eq 0 ]; then
    echo "✅ FIREBASE_FUNCTION_GOV_NEWS_URL 設置成功"
else
    echo "❌ FIREBASE_FUNCTION_GOV_NEWS_URL 設置失敗"
    exit 1
fi

echo ""

# 設置 RTHK 新聞 URL
echo "📝 設置 FIREBASE_FUNCTION_RTHK_NEWS_URL..."
echo "${RTHK_NEWS_URL}" | wrangler secret put FIREBASE_FUNCTION_RTHK_NEWS_URL

if [ $? -eq 0 ]; then
    echo "✅ FIREBASE_FUNCTION_RTHK_NEWS_URL 設置成功"
else
    echo "❌ FIREBASE_FUNCTION_RTHK_NEWS_URL 設置失敗"
    exit 1
fi

echo ""

# 設置 Google News URL
echo "📝 設置 FIREBASE_FUNCTION_GOOGLE_NEWS_URL..."
echo "${GOOGLE_NEWS_URL}" | wrangler secret put FIREBASE_FUNCTION_GOOGLE_NEWS_URL

if [ $? -eq 0 ]; then
    echo "✅ FIREBASE_FUNCTION_GOOGLE_NEWS_URL 設置成功"
else
    echo "❌ FIREBASE_FUNCTION_GOOGLE_NEWS_URL 設置失敗"
    exit 1
fi

echo ""

# 設置事件統計更新 URL
echo "📝 設置 FIREBASE_FUNCTION_UPDATE_EVENT_STATS_URL..."
echo "${UPDATE_EVENT_STATS_URL}" | wrangler secret put FIREBASE_FUNCTION_UPDATE_EVENT_STATS_URL

if [ $? -eq 0 ]; then
    echo "✅ FIREBASE_FUNCTION_UPDATE_EVENT_STATS_URL 設置成功"
else
    echo "❌ FIREBASE_FUNCTION_UPDATE_EVENT_STATS_URL 設置失敗"
    exit 1
fi

echo ""
echo "🎉 環境變量設置完成！"
echo ""
echo "驗證設置："
wrangler secret list
echo ""
echo "測試 Worker："
echo "  curl https://taipo-fire-news-fetcher.lwp.workers.dev/gov-news"
echo "  curl https://taipo-fire-news-fetcher.lwp.workers.dev/rthk-news"
echo "  curl https://taipo-fire-news-fetcher.lwp.workers.dev/google-news"
echo "  curl https://taipo-fire-news-fetcher.lwp.workers.dev/update-event-stats"
echo "  curl https://taipo-fire-news-fetcher.lwp.workers.dev/health"

