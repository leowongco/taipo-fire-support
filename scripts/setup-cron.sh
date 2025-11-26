#!/bin/bash

# 設置 cron job 的輔助腳本

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FETCH_SCRIPT="$SCRIPT_DIR/fetch-news.sh"

echo "=========================================="
echo "設置新聞抓取 Cron Job"
echo "=========================================="
echo ""
echo "此腳本將設置每 15 分鐘執行一次的新聞抓取任務"
echo "腳本路徑: $FETCH_SCRIPT"
echo ""

# 檢查腳本是否存在
if [ ! -f "$FETCH_SCRIPT" ]; then
    echo "❌ 錯誤: 找不到腳本文件 $FETCH_SCRIPT"
    exit 1
fi

# 確保腳本有執行權限
chmod +x "$FETCH_SCRIPT"

# 獲取當前用戶的 crontab
CRON_CMD="*/15 * * * * $FETCH_SCRIPT"

# 檢查是否已經存在相同的 cron job
if crontab -l 2>/dev/null | grep -q "$FETCH_SCRIPT"; then
    echo "⚠️  檢測到已存在的新聞抓取 cron job"
    echo ""
    echo "現有的 cron job:"
    crontab -l 2>/dev/null | grep "$FETCH_SCRIPT"
    echo ""
    read -p "是否要移除舊的並添加新的? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 移除舊的 cron job
        crontab -l 2>/dev/null | grep -v "$FETCH_SCRIPT" | crontab -
        echo "✅ 已移除舊的 cron job"
    else
        echo "取消操作"
        exit 0
    fi
fi

# 添加新的 cron job
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo ""
echo "✅ Cron job 設置成功！"
echo ""
echo "Cron job 詳情:"
echo "  執行頻率: 每 15 分鐘"
echo "  執行時間: */15 * * * *"
echo "  腳本路徑: $FETCH_SCRIPT"
echo ""
echo "查看當前的 cron jobs:"
echo "  crontab -l"
echo ""
echo "移除 cron job:"
echo "  crontab -e  (然後刪除對應的行)"
echo ""
echo "查看日誌:"
echo "  tail -f $PROJECT_DIR/logs/fetch-news-\$(date +%Y%m%d).log"
echo ""

