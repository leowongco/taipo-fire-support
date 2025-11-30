import { usePageTracking } from '../hooks/usePageTracking'

/**
 * 頁面追蹤組件 - 自動追蹤頁面瀏覽
 */
export default function PageTracker() {
  usePageTracking()
  return null
}

