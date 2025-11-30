# Python 新聞獲取腳本

這些 Python 腳本用於自動獲取政府新聞和 RTHK 新聞，並添加到 Firestore 數據庫。

## 安裝依賴

```bash
pip install -r requirements.txt
```

## 設置 Firebase 憑證

腳本需要 Firebase 服務帳戶憑證才能訪問 Firestore。有以下幾種方式設置：

### 方法 1：使用環境變量（推薦）

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### 方法 2：將憑證文件放在項目根目錄

將服務帳戶密鑰文件（JSON）下載後，放在項目根目錄並命名為 `service-account-key.json`

### 方法 3：在 Cloud Functions 環境中

如果在 Cloud Functions 或已設置 Application Default Credentials 的環境中運行，則不需要額外設置。

### 獲取服務帳戶密鑰

1. 訪問 [Firebase Console](https://console.firebase.google.com/)
2. 選擇項目
3. 前往「項目設置」>「服務帳戶」
4. 點擊「生成新的私密金鑰」
5. 下載 JSON 文件

**注意：** 請妥善保管服務帳戶密鑰文件，不要提交到版本控制系統！

## 使用方法

### 單獨運行

```bash
# 獲取政府新聞
python3 scripts/fetch_gov_news.py

# 獲取 RTHK 新聞
python3 scripts/fetch_rthk_news.py

# 獲取所有新聞
python3 scripts/fetch_all_news.py
```

### 設置 Cron Job

編輯 crontab：

```bash
crontab -e
```

添加以下行（每小時執行一次）：

```cron
0 * * * * cd /path/to/taipo-fire-support && /usr/bin/python3 scripts/fetch_all_news.py >> logs/fetch-news.log 2>> logs/fetch-news-error.log
```

或者分別設置：

```cron
# 每小時獲取政府新聞
0 * * * * cd /path/to/taipo-fire-support && /usr/bin/python3 scripts/fetch_gov_news.py >> logs/fetch-gov-news.log 2>> logs/fetch-gov-news-error.log

# 每小時獲取 RTHK 新聞
0 * * * * cd /path/to/taipo-fire-support && /usr/bin/python3 scripts/fetch_rthk_news.py >> logs/fetch-rthk-news.log 2>> logs/fetch-rthk-news-error.log
```

### 使用 Cloud Scheduler (Google Cloud)

如果使用 Google Cloud，可以設置 Cloud Scheduler 來定期執行這些腳本：

1. 將腳本部署到 Cloud Functions 或 Cloud Run
2. 在 Cloud Scheduler 中創建任務
3. 設置 HTTP 觸發器或 Pub/Sub 觸發器

## 功能說明

### fetch_gov_news.py
- 從香港政府新聞公報 RSS Feed 獲取新聞
- 過濾與火災相關的新聞
- 自動添加標籤（緊急/政府新聞）
- 檢查重複，避免添加相同的新聞

### fetch_rthk_news.py
- 從 RTHK RSS Feed 獲取新聞
- 過濾與火災相關的新聞
- 自動添加標籤（緊急/新聞）
- 檢查重複，避免添加相同的新聞
- 支持緊急公告格式檢測

### fetch_all_news.py
- 統一執行所有新聞獲取任務
- 提供執行總結
- 適合用於 cron job

## 日誌

腳本會輸出詳細的執行日誌，包括：
- 找到的新聞數量
- 添加的新聞數量
- 跳過的新聞（已存在或不相關）
- 錯誤信息

建議將輸出重定向到日誌文件以便後續查看。

