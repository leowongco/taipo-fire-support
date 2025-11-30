# 大埔火災支援平台 (Tai Po Fire Support Platform)

一個輕量級、高性能的災後重建資訊平台，為大埔火災事件提供即時更新、事件統計、經濟援助、支援服務和重建資訊。

## 📋 項目簡介

本平台旨在為公眾提供：
- 📊 **事件統計**：實時顯示事件持續時間、死亡、受傷、失蹤人數（多源驗證）
- 📰 **即時新聞動態**：自動抓取政府新聞公報和 RTHK 即時新聞，支持分類篩選
- 💰 **經濟援助資訊**：提供各類經濟援助項目，支持總額估算和狀態篩選
- 🆘 **支援服務**：整合情緒支援、託兒/學業、住宿、醫療/法律、殯儀、寵物等各類支援服務
- 🏗️ **重建資訊**：追蹤災後重建進度、時間表和資源資訊
- 📜 **歷史記錄**：記錄事件時間軸、重要里程碑和經驗總結
- 🏠 **庇護中心資訊**：顯示臨時庇護中心的位置和狀態

## ✨ 主要功能

### 事件統計與追蹤
- **實時統計**：自動從政府新聞和維基百科提取並驗證事件統計數據
- **多源驗證（互相制衡）**：確保統計數據的準確性，需要至少 2 個來源確認後才更新
  - 新聞來源（政府新聞、RTHK 新聞）自動提取統計數據
  - 維基百科每 2 小時自動更新，作為權威來源參與驗證
  - 當達到 2 個來源確認時，自動更新統計數據
- **精確時間**：顯示事件持續時間（精確到秒）和火災持續時間
- **自動更新**：通過 Cloud Functions 和 Cloudflare Workers 自動抓取和更新統計數據

### 自動化新聞抓取與分析
- **RTHK 即時新聞**：每 30 分鐘自動抓取並過濾火災相關新聞
- **政府新聞公報**：每小時自動抓取政府發布的相關公告
- **智能分類**：使用 AI（Groq）自動將新聞分類為事件更新、經濟支援、情緒支援、住宿支援、醫療/法律、重建資訊、統計數據、社區支援、政府公告、調查、一般新聞等
- **統計提取**：自動從新聞內容中提取死傷失蹤數據，參與多源驗證機制
- **重複過濾**：自動過濾重複內容，避免重複顯示

### 經濟援助管理
- **援助項目展示**：顯示各類經濟援助項目（現金、物資、代金券）
- **總額估算**：自動計算可申請的總額，支持按適用對象分類計算
- **狀態篩選**：支持按狀態（開放中、名額有限、已結束）和適用對象篩選
- **申請追蹤**：用戶可以標記已申請的援助項目，使用本地存儲保存記錄
- **互動聯絡**：所有電話、地址、WhatsApp 等聯絡方式均可點擊使用

### 支援服務整合
- **多類別服務**：整合情緒支援、託兒/學業、住宿、醫療/法律、殯儀、寵物等服務
- **智能搜索**：支持按服務名稱、提供機構搜索
- **分類篩選**：支持按服務類別篩選
- **多聯絡方式**：支持多個電話、地址、社交媒體連結，均可點擊使用

### 管理後台
- **內容管理**：管理員可以添加、編輯和刪除各類數據
- **數據驗證**：支持手動驗證和更新事件統計數據
- **批量操作**：支持批量導入和更新支援服務數據
- **Google Analytics**：集成 GA-4 追蹤用戶行為

## 🛠️ 技術棧

- **前端框架**：React 19 + TypeScript
- **構建工具**：Vite
- **樣式**：Tailwind CSS
- **圖標**：Lucide React (輕量級 SVG 圖標)
- **後端/數據庫**：Firebase (Firestore, Authentication, Hosting)
- **自動化**：Firebase Cloud Functions + Cloudflare Workers Cron Triggers
- **分析追蹤**：Google Analytics 4 (GA-4)

## 📦 安裝與設置

### 前置要求

- Node.js 18+
- npm 或 yarn
- Firebase 帳戶

### 1. 克隆項目

```bash
git clone <repository-url>
cd taipo-fire-support
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 配置環境變量

複製 `.env.example` 並創建 `.env` 文件：

```bash
cp .env.example .env
```

在 `.env` 文件中填入你的 Firebase 配置：

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GA_MEASUREMENT_ID=your_ga_measurement_id

# 管理員認證（用於腳本執行）
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password
```

### 4. 設置 Firebase

1. 在 Firebase Console 中創建項目
2. 啟用 Firestore Database
3. 設置 Firestore 安全規則（見 `firestore.rules`）
4. 啟用 Authentication（Email/Password）
5. 部署 Firebase Functions：

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 5. 設置 Google Analytics 4

詳見 [GA4_SETUP.md](./GA4_SETUP.md)

### 6. 初始化數據

```bash
# 初始化事件統計
npm run init:event-stats

# 遷移支援服務數據（如果需要）
npm run migrate:relief-services
```

### 7. 運行開發服務器

```bash
npm run dev
```

訪問 http://localhost:5173

## 📜 可用腳本

### 開發

```bash
npm run dev          # 啟動開發服務器
npm run build        # 構建生產版本
npm run preview      # 預覽生產構建
```

### 數據管理

```bash
npm run seed                    # 初始化數據
npm run seed:support           # 初始化支援資訊
npm run seed:relief-data       # 初始化支援服務數據
npm run init:event-stats       # 初始化事件統計
npm run migrate:relief-services # 遷移支援服務數據到 Firestore
```

### 新聞抓取

```bash
npm run fetch:gov-news         # 手動抓取政府新聞
npm run fetch:rthk-news        # 手動抓取 RTHK 新聞
npm run fetch:wikipedia-stats  # 從維基百科抓取統計數據
npm run fetch:wikipedia-timeline # 從維基百科抓取時間軸
```

### 自動化新聞抓取（Cloudflare Workers）

**推薦**：使用 Cloudflare Workers 的 Cron Triggers 來定時執行新聞抓取任務，無需維護本地服務器。

詳見 [workers/README.md](./workers/README.md)

⚠️ **已棄用**：本地 Python cron job 已不再推薦使用。請改用 Cloudflare Workers。

### 數據修復

```bash
npm run fix:event-start-date   # 修復事件開始日期
npm run fix:failed-relief-services # 修復失敗的支援服務數據
```

### 數據添加

```bash
npm run add:shelters           # 添加庇護中心
npm run add:electricity-info   # 添加電費相關資訊
npm run add:gov-support-nov28  # 添加政府支援資訊（2025-11-28）
```

## 🏗️ 項目結構

```
taipo-fire-support/
├── src/
│   ├── components/          # React 組件
│   │   ├── admin/          # 管理後台組件
│   │   ├── feed/           # 新聞卡片組件
│   │   ├── layout/         # 布局組件
│   │   ├── stats/          # 統計組件
│   │   └── ui/             # UI 組件
│   ├── pages/              # 頁面組件
│   │   ├── HomePage.tsx           # 首頁（事件統計 + 新聞）
│   │   ├── FinancialAidPage.tsx   # 經濟援助
│   │   ├── MoreSupportPage.tsx    # 支援服務
│   │   ├── HistoryPage.tsx        # 歷史記錄
│   │   ├── ReconstructionPage.tsx # 重建資訊
│   │   └── AdminDashboard.tsx     # 管理後台
│   ├── hooks/              # 自定義 Hooks
│   │   ├── useFirestore.ts        # Firestore 數據獲取
│   │   └── usePageTracking.ts     # 頁面追蹤
│   ├── scripts/            # 數據管理腳本
│   ├── types/              # TypeScript 類型定義
│   ├── utils/              # 工具函數
│   │   ├── analytics.ts           # GA-4 追蹤
│   │   ├── formatContact.ts       # 聯絡方式格式化
│   │   ├── renderContact.tsx      # 聯絡方式渲染
│   │   └── renderLocation.tsx     # 地址渲染
│   └── config/             # 配置文件
├── functions/              # Firebase Cloud Functions
│   └── src/
│       ├── govNewsFetcher.ts        # 政府新聞抓取器
│       ├── rthkNewsFetcher.ts       # RTHK 新聞抓取器
│       ├── wikipediaStatsFetcher.ts # 維基百科統計抓取器
│       ├── statExtractor.ts         # 統計數據提取器
│       ├── statValidator.ts         # 統計數據驗證器（多源驗證）
│       └── index.ts                 # Functions 入口
├── workers/                # Cloudflare Workers（定時任務）
│   ├── src/
│   │   └── index.ts            # Worker 入口
│   ├── wrangler.toml           # Wrangler 配置
│   └── README.md               # Workers 設置說明
├── scripts/                # 自動化腳本（已棄用，改用 Cloudflare Workers）
├── firebase.json           # Firebase 配置
├── firestore.rules         # Firestore 安全規則
└── package.json
```

## 🔐 安全規則

Firestore 安全規則已配置為：
- **公開讀取**：公告、事件統計、重建資訊、歷史記錄、經濟援助、支援服務
- **認證寫入**：所有數據的寫入操作需要管理員認證

詳見 `firestore.rules`

## 🚀 部署

### 部署到 Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

### 部署 Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### 部署 Firestore 規則

```bash
firebase deploy --only firestore:rules
```

## 📝 數據模型

### EventStats（事件統計）

```typescript
{
  id: string
  eventStartDate: Timestamp
  casualties: number
  injured: number
  missing: number
  source: string
  sources: string[]  // 多源驗證
  lastUpdated: Timestamp
}
```

### Announcements（公告）

```typescript
{
  id: string
  title: string
  content: string
  source: string
  url?: string
  isUrgent: boolean
  newsCategory?: 'financial' | 'emotional' | 'government' | 'industry' | 'general' | 'urgent'
  timestamp: Timestamp
}
```

### FinancialAid（經濟援助）

```typescript
{
  id: string
  provider: string
  title: string
  amount: string
  location?: string | string[]
  contact?: string | string[]
  time?: string
  requirement?: string
  type: 'cash' | 'goods' | 'voucher'
  status: 'open' | 'limited' | 'closed'
  targetGroup?: 'affected-families' | 'general-residents'
  sourceRef?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### ReliefService（支援服務）

```typescript
{
  id: string
  category: 'emotional' | 'childcare' | 'education' | 'accommodation' | 'medical' | 'legal' | 'funeral' | 'pets'
  name: string
  provider: string
  description: string
  contact: string | string[]
  location: string | string[]
  openingHours?: string
  note?: string
  source_ref: string
  order?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### ReconstructionInfo（重建資訊）

```typescript
{
  id: string
  title: string
  content: string
  category: 'progress' | 'timeline' | 'resources' | 'updates'
  status: 'active' | 'completed' | 'pending'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  source: string
  url?: string
  timestamp: Timestamp
}
```

### HistoryRecord（歷史記錄）

```typescript
{
  id: string
  title: string
  content: string
  date: Timestamp
  category: 'milestone' | 'news' | 'summary'
  importance: 'low' | 'medium' | 'high' | 'critical'
  tags?: string[]
  timestamp: Timestamp
}
```

## 🌐 頁面路由

- `/` - 首頁（事件統計 + 新聞）
- `/financial-aid` - 經濟援助
- `/more-support` - 支援服務
- `/history` - 歷史記錄
- `/reconstruction` - 重建資訊
- `/admin` - 管理後台（需要登入）

## 📊 Google Analytics 4

平台已集成 GA-4 追蹤功能，可以追蹤：
- 頁面瀏覽
- 用戶互動（點擊、搜索、篩選）
- 服務查看
- 連結點擊

詳見 [GA4_SETUP.md](./GA4_SETUP.md)

## 💰 Firebase 免費額度優化

為了保持在 Firebase 免費額度內，平台已實施以下優化：

### 讀取操作優化
- **一次性查詢**：一般頁面使用一次性查詢而非實時監聽，大幅減少讀取操作
- **查詢限制**：為所有查詢添加數量限制，避免讀取過多數據
- **智能緩存**：管理後台保留實時監聽，但添加查詢限制

### 寫入操作優化
- **定時任務頻率**：
  - Telegram 頻道：每 15 分鐘
  - 政府新聞：每小時
  - RTHK 新聞：每 30 分鐘
  - Google News：已取消定時任務（保留手動觸發）
  - 事件統計更新（維基百科）：每 2 小時

### 預期效果
- **讀取操作**：減少約 70-90%
- **寫入操作**：減少約 30-40%

詳見 [FIREBASE_FREE_TIER_OPTIMIZATION.md](./FIREBASE_FREE_TIER_OPTIMIZATION.md)

## 🔗 外部連結

- **政府官方支援網頁**：https://www.taipofire.gov.hk/

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 許可證

ISC

## 📞 聯絡方式

如有問題或建議，請通過 GitHub Issues 聯繫。

## 🙏 致謝

感謝所有為大埔火災救援工作付出的人員和志願者。

---

**注意**：本平台僅供資訊參考，緊急情況請撥打 999。
