#!/bin/bash

# 新聞抓取腳本 - 用於 cron job
# 每 15 分鐘執行一次，更新 RTHK 和政府新聞

# 設置環境變量（cron 環境可能沒有完整的 PATH）
export PATH="/opt/homebrew/opt/node@20/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# 獲取腳本所在目錄的絕對路徑
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 切換到項目目錄
cd "$PROJECT_DIR" || exit 1

# 確定 npm 的完整路徑
NPM_CMD="npm"
if ! command -v npm &> /dev/null; then
    # 嘗試使用常見的 npm 路徑
    if [ -f "/opt/homebrew/opt/node@20/bin/npm" ]; then
        NPM_CMD="/opt/homebrew/opt/node@20/bin/npm"
        export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
    elif [ -f "/usr/local/bin/npm" ]; then
        NPM_CMD="/usr/local/bin/npm"
        export PATH="/usr/local/bin:$PATH"
    elif [ -f "$HOME/.nvm/versions/node/$(ls -1 $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin/npm" ]; then
        NPM_CMD="$HOME/.nvm/versions/node/$(ls -1 $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin/npm"
    else
        echo "錯誤: 找不到 npm 命令" >&2
        echo "請確保 Node.js 已正確安裝" >&2
        exit 1
    fi
fi

# 驗證 npm 是否可用
if ! "$NPM_CMD" --version &> /dev/null; then
    echo "錯誤: npm 命令無法執行" >&2
    exit 1
fi

# 設置日誌文件路徑
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/fetch-news-$(date +%Y%m%d).log"
ERROR_LOG="$LOG_DIR/fetch-news-error-$(date +%Y%m%d).log"

# 記錄開始時間
echo "========================================" >> "$LOG_FILE"
echo "開始執行新聞抓取: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# 執行 RTHK 新聞抓取
echo "[$(date '+%H:%M:%S')] 開始抓取 RTHK 新聞..." >> "$LOG_FILE"
"$NPM_CMD" run fetch:rthk-news >> "$LOG_FILE" 2>> "$ERROR_LOG"
RTHK_EXIT_CODE=$?

if [ $RTHK_EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%H:%M:%S')] ✅ RTHK 新聞抓取完成" >> "$LOG_FILE"
else
    echo "[$(date '+%H:%M:%S')] ❌ RTHK 新聞抓取失敗 (退出碼: $RTHK_EXIT_CODE)" >> "$LOG_FILE"
fi

# 等待 2 秒，避免請求過快
sleep 2

# 執行政府新聞抓取
echo "[$(date '+%H:%M:%S')] 開始抓取政府新聞..." >> "$LOG_FILE"
"$NPM_CMD" run fetch:gov-news >> "$LOG_FILE" 2>> "$ERROR_LOG"
GOV_EXIT_CODE=$?

if [ $GOV_EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%H:%M:%S')] ✅ 政府新聞抓取完成" >> "$LOG_FILE"
else
    echo "[$(date '+%H:%M:%S')] ❌ 政府新聞抓取失敗 (退出碼: $GOV_EXIT_CODE)" >> "$LOG_FILE"
fi

# 等待 2 秒，避免請求過快
sleep 2

# 分析政府新聞中的庇護中心資訊
echo "[$(date '+%H:%M:%S')] 開始分析政府新聞中的庇護中心資訊..." >> "$LOG_FILE"
"$NPM_CMD" run analyze:shelters >> "$LOG_FILE" 2>> "$ERROR_LOG"
ANALYZE_EXIT_CODE=$?

if [ $ANALYZE_EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%H:%M:%S')] ✅ 庇護中心分析完成" >> "$LOG_FILE"
else
    echo "[$(date '+%H:%M:%S')] ❌ 庇護中心分析失敗 (退出碼: $ANALYZE_EXIT_CODE)" >> "$LOG_FILE"
fi

# 記錄結束時間
echo "========================================" >> "$LOG_FILE"
echo "新聞抓取和分析完成: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "RTHK 退出碼: $RTHK_EXIT_CODE, 政府新聞退出碼: $GOV_EXIT_CODE, 分析退出碼: $ANALYZE_EXIT_CODE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 如果所有任務都成功，返回 0；否則返回 1
if [ $RTHK_EXIT_CODE -eq 0 ] && [ $GOV_EXIT_CODE -eq 0 ] && [ $ANALYZE_EXIT_CODE -eq 0 ]; then
    exit 0
else
    exit 1
fi

