# Google Analytics 4 (GA-4) 設置指南

## 設置步驟

### 1. 創建 Google Analytics 4 屬性

1. 訪問 [Google Analytics](https://analytics.google.com/)
2. 創建新帳戶或選擇現有帳戶
3. 創建新屬性（Property），選擇「Google Analytics 4」
4. 設置數據流（Data Stream），選擇「網站」
5. 輸入網站 URL 和流名稱
6. 複製「測量 ID」（Measurement ID），格式為 `G-XXXXXXXXXX`

### 2. 配置環境變量

在項目根目錄的 `.env` 文件中添加：

```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

將 `G-XXXXXXXXXX` 替換為你的實際測量 ID。

### 3. 重新構建和部署

```bash
npm run build
firebase deploy
```

## 追蹤的事件

網站會自動追蹤以下事件：

### 頁面瀏覽
- 所有頁面訪問都會自動追蹤
- 包括路徑和頁面標題

### 搜索事件
- **事件名稱**: `search`
- **參數**:
  - `search_term`: 搜索關鍵詞
  - `category`: 搜索的分類（如果適用）

### 分類過濾
- **事件名稱**: `filter`
- **參數**:
  - `event_category`: 過濾器類型（如 'category', 'news_tag', 'news_category', 'financial_aid_status'）
  - `filter_value`: 選擇的過濾值
  - `page`: 當前頁面

### 鏈接點擊
- **事件名稱**: `click`
- **參數**:
  - `event_category`: 'link'
  - `event_label`: 鏈接文本
  - `link_url`: 鏈接 URL
  - `link_type`: 鏈接類型（'phone', 'whatsapp', 'email', 'map', 'instagram', 'external', 'internal'）

### 服務查看
- **事件名稱**: `view_item`
- **參數**:
  - `item_name`: 服務名稱
  - `item_category`: 服務類別
  - `item_brand`: 提供機構

### 表單提交
- **事件名稱**: `form_submit_success` 或 `form_submit_error`
- **參數**:
  - `form_name`: 表單名稱

### 錯誤追蹤
- **事件名稱**: `exception`
- **參數**:
  - `description`: 錯誤描述
  - `fatal`: 是否為嚴重錯誤
  - `error_location`: 錯誤位置

## 在 Google Analytics 中查看數據

1. 登入 [Google Analytics](https://analytics.google.com/)
2. 選擇你的屬性
3. 在左側菜單中：
   - **即時**: 查看實時訪問數據
   - **報表** > **參與度** > **事件**: 查看所有追蹤的事件
   - **報表** > **參與度** > **頁面和畫面**: 查看頁面瀏覽數據
   - **探索**: 創建自定義報表分析用戶行為

## 常見分析問題

### 用戶最常搜索什麼？
- 查看「事件」報表中的 `search` 事件
- 分析 `search_term` 參數

### 用戶最常點擊哪些鏈接？
- 查看「事件」報表中的 `click` 事件
- 按 `link_type` 分組查看

### 哪些服務最受關注？
- 查看「事件」報表中的 `view_item` 事件
- 按 `item_category` 或 `item_name` 分組

### 用戶最常使用哪些過濾器？
- 查看「事件」報表中的 `filter` 事件
- 按 `filter_value` 分組查看

## 注意事項

- 如果未設置 `VITE_GA_MEASUREMENT_ID`，追蹤功能會自動禁用，不會影響網站功能
- 所有追蹤都符合 GDPR 和隱私要求（不收集個人識別信息）
- 管理員頁面（`/admin/*`）不會被追蹤

