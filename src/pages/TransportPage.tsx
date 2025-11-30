import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'

// 此頁面已廢棄，重定向到首頁
export default function TransportPage() {
  useEffect(() => {
    // 可以添加一個提示，告知用戶此功能已移除
  }, [])

  return <Navigate to="/" replace />
}
