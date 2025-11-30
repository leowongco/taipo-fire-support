import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../utils/analytics'

/**
 * 自動追蹤頁面瀏覽的 Hook
 */
export function usePageTracking() {
  const location = useLocation()

  useEffect(() => {
    // 追蹤頁面瀏覽
    trackPageView(location.pathname + location.search, document.title)
  }, [location])
}

