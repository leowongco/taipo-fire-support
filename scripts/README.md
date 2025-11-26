# 新聞抓取 Cron Job 設置說明

此目錄包含用於設置本地 cron job 的腳本，用於定期自動抓取 RTHK 和政府新聞。

## 文件說明

- `fetch-news.sh` - 主要的新聞抓取腳本，執行以下任務：
  - 抓取 RTHK 即時新聞
  - 抓取政府新聞公報
  - 分析政府新聞中的庇護中心資訊並自動更新
- `setup-cron.sh` - 輔助腳本，用於自動設置 cron job
- `README.md` - 本說明文件

## 快速開始

### 方法 1: 使用自動設置腳本（推薦）

```bash
cd /Users/leowong/Documents/Projects/taipo-fire-support
./scripts/setup-cron.sh
```

這個腳本會自動：
- 檢查並設置 cron job
- 每 15 分鐘執行一次新聞抓取
- 如果已存在相同的 cron job，會提示是否替換

### 方法 2: 手動設置

1. 確保腳本有執行權限：
```bash
chmod +x scripts/fetch-news.sh
```

2. 編輯 crontab：
```bash
crontab -e
```

3. 添加以下行（每 15 分鐘執行一次）：
```
*/15 * * * * /Users/leowong/Documents/Projects/taipo-fire-support/scripts/fetch-news.sh
```

## Cron 時間格式說明

```
*/15 * * * *
│   │ │ │ │
│   │ │ │ └─── 星期幾 (0-7, 0 和 7 都代表星期日)
│   │ │ └───── 月份 (1-12)
│   │ └─────── 日期 (1-31)
│   └───────── 小時 (0-23)
└───────────── 分鐘 (0-59)
```

- `*/15` = 每 15 分鐘
- `0 * * * *` = 每小時的 0 分
- `0 9 * * *` = 每天上午 9 點
- `0 9 * * 1-5` = 每週一到週五上午 9 點

## 日誌文件

腳本會自動創建日誌文件在 `logs/` 目錄下：

- `fetch-news-YYYYMMDD.log` - 標準輸出日誌
- `fetch-news-error-YYYYMMDD.log` - 錯誤日誌

查看今天的日誌：
```bash
tail -f logs/fetch-news-$(date +%Y%m%d).log
```

查看錯誤日誌：
```bash
tail -f logs/fetch-news-error-$(date +%Y%m%d).log
```

## 管理 Cron Job

### 查看當前的 cron jobs
```bash
crontab -l
```

### 編輯 cron jobs
```bash
crontab -e
```

### 移除所有 cron jobs
```bash
crontab -r
```

### 移除特定的 cron job
```bash
crontab -e
# 然後刪除對應的行
```

## 手動執行

你也可以手動執行腳本進行測試：

```bash
./scripts/fetch-news.sh
```

或者直接使用 npm 命令：

```bash
# 只抓取 RTHK 新聞
npm run fetch:rthk-news

# 只抓取政府新聞
npm run fetch:gov-news

# 只分析政府新聞中的庇護中心資訊
npm run analyze:shelters
```

## 功能說明

### 自動分析庇護中心資訊

腳本會自動分析政府新聞中的庇護中心資訊：

1. **識別庇護中心**：從新聞標題和內容中識別與庇護中心相關的資訊
2. **提取資訊**：
   - 庇護中心名稱（如：XX社區會堂、XX學校等）
   - 地址資訊
   - 狀態（開放/關閉/已滿）
3. **自動更新**：
   - 如果庇護中心已存在，更新其資訊和狀態
   - 如果庇護中心不存在，創建新的庇護中心記錄

### 識別規則

系統會識別以下類型的庇護中心：
- 社區會堂、社區中心、鄰里社區中心
- 體育館、活動中心
- 學校、書院、中學、小學、幼稚園
- 過渡性房屋、臨時收容中心

### 狀態判斷

系統會根據新聞內容自動判斷庇護中心狀態：
- **開放**：包含「開放」、「啟用」、「開始運作」等關鍵詞
- **關閉**：包含「關閉」、「停止」、「結束」等關鍵詞
- **已滿**：包含「已滿」、「額滿」、「爆滿」等關鍵詞

## 注意事項

1. **環境變量**: 確保 `.env` 文件已正確配置，包含 Firebase 認證信息
2. **Node.js 路徑**: 如果 `npm` 不在系統 PATH 中，可能需要修改腳本中的 `npm` 為完整路徑
3. **權限**: 確保腳本有執行權限 (`chmod +x`)
4. **日誌目錄**: 腳本會自動創建 `logs/` 目錄，如果創建失敗請手動創建

## 故障排除

### Cron job 沒有執行

1. 檢查 cron 服務是否運行：
```bash
# macOS
sudo launchctl list | grep cron

# Linux
sudo systemctl status cron
```

2. 檢查腳本路徑是否正確（使用絕對路徑）

3. 檢查腳本是否有執行權限

4. 查看系統日誌：
```bash
# macOS
grep CRON /var/log/system.log

# Linux
grep CRON /var/log/syslog
```

### 腳本執行但沒有輸出

檢查日誌文件是否在 `logs/` 目錄中創建。

### 認證錯誤

確保 `.env` 文件中的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 已正確設置。

