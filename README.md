# 大埔火災支援平台 (Tai Po Fire Support Platform)

一個輕量級、高性能的資訊聚合平台，為大埔火災事件提供即時更新、資源需求和收集點位置資訊。

## 📋 項目簡介

本平台旨在為公眾提供：
- 📰 **即時新聞動態**：自動抓取政府新聞公報和 RTHK 即時新聞
- 🏠 **庇護中心資訊**：顯示臨時庇護中心的位置、狀態和需求
- 📦 **物資收集站**：提供物資收集點的位置和需求資訊
- 🆘 **支援資訊**：緊急聯絡電話和相關支援服務

## ✨ 主要功能

### 自動化新聞抓取
- **RTHK 即時新聞**：每 30 分鐘自動抓取並過濾火災相關新聞
- **政府新聞公報**：每小時自動抓取政府發布的相關公告
- **智能分析**：自動識別緊急公告並標記
- **重複過濾**：自動過濾重複內容，避免重複顯示

### 庇護中心管理
- **自動更新**：從政府新聞中自動提取庇護中心資訊
- **狀態追蹤**：實時顯示庇護中心狀態（開放/關閉/已滿）
- **智能識別**：自動識別社區會堂、學校、體育館等庇護場所

### 管理後台
- **內容管理**：管理員可以添加、編輯和刪除公告和資源點
- **快速更新**：快速標記資源點狀態（開放/關閉/已滿）

## 🛠️ 技術棧

- **前端框架**：React 19 + TypeScript
- **構建工具**：Vite
- **樣式**：Tailwind CSS
- **後端/數據庫**：Firebase (Firestore, Authentication, Hosting)
- **圖標**：Lucide React (輕量級 SVG 圖標)
- **自動化**：Firebase Cloud Functions + Cron Jobs

## 📦 安裝與設置

### 前置要求

- Node.js 24+
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

### 5. 運行開發服務器

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
npm run add:shelters           # 添加庇護中心
npm run add:supply             # 添加物資收集點
```

### 新聞抓取

```bash
npm run fetch:gov-news         # 手動抓取政府新聞
npm run fetch:rthk-news        # 手動抓取 RTHK 新聞
npm run analyze:shelters       # 分析政府新聞中的庇護中心資訊
```

### 自動化（Cron Job）

設置本地 cron job 每 15 分鐘自動抓取新聞：

```bash
./scripts/setup-cron.sh
```

詳見 [scripts/README.md](./scripts/README.md)

## 🏗️ 項目結構

```
taipo-fire-support/
├── src/
│   ├── components/          # React 組件
│   │   ├── feed/           # 新聞卡片組件
│   │   ├── layout/         # 布局組件
│   │   ├── resources/      # 資源卡片組件
│   │   ├── support/        # 支援資訊組件
│   │   └── ui/             # UI 組件
│   ├── pages/              # 頁面組件
│   ├── hooks/              # 自定義 Hooks
│   ├── scripts/            # 數據管理腳本
│   ├── types/              # TypeScript 類型定義
│   ├── utils/              # 工具函數
│   └── config/             # 配置文件
├── functions/              # Firebase Cloud Functions
│   └── src/
│       ├── govNewsFetcher.ts    # 政府新聞抓取器
│       ├── rthkNewsFetcher.ts   # RTHK 新聞抓取器
│       ├── telegramFetcher.ts   # Telegram 抓取器
│       └── index.ts             # Functions 入口
├── scripts/                # 自動化腳本
│   ├── fetch-news.sh       # 新聞抓取腳本
│   └── setup-cron.sh       # Cron job 設置腳本
├── firebase.json           # Firebase 配置
├── firestore.rules         # Firestore 安全規則
└── package.json
```

## 🔐 安全規則

Firestore 安全規則已配置為：
- 公告和資源：公開讀取
- 管理操作：需要管理員認證

詳見 `firestore.rules`

## 🚀 部署

### 部署到 Firebase Hosting

```bash
npm run build
firebase deploy
```

### 部署 Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

## 📝 數據模型

### Announcements（公告）

```typescript
{
  id: string
  title: string
  content: string
  source: string
  url?: string
  isUrgent: boolean
  tag?: 'urgent' | 'gov' | 'news'
  timestamp: Timestamp
}
```

### Resources（資源點）

```typescript
{
  id: string
  locationName: string
  address: string
  mapLink: string
  status: 'open' | 'closed' | 'full'
  category: 'supply' | 'shelter'
  needs: string[]
  contact: string
  updatedAt: Timestamp
}
```

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

