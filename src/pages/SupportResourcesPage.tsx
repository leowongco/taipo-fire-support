import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * SupportResourcesPage 已合併到 MoreSupportPage
 * 此頁面會自動重定向到 /more-support
 */
export default function SupportResourcesPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // 重定向到更多支援頁面
    navigate('/more-support', { replace: true })
  }, [navigate])

  return null
}
