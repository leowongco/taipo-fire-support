import { useState, FormEvent } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../config/firebase'
import Layout from '../components/layout/Layout'
import { LogIn, AlertTriangle } from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/admin/dashboard')
    } catch (err: any) {
      // 提供更友好的錯誤訊息
      let errorMessage = '登錄失敗，請檢查您的憑證'
      
      switch (err.code) {
        case 'auth/user-not-found':
          errorMessage = '找不到此用戶，請檢查電子郵件地址'
          break
        case 'auth/wrong-password':
          errorMessage = '密碼錯誤，請重新輸入'
          break
        case 'auth/invalid-email':
          errorMessage = '電子郵件格式不正確'
          break
        case 'auth/user-disabled':
          errorMessage = '此帳戶已被停用，請聯繫管理員'
          break
        case 'auth/too-many-requests':
          errorMessage = '登錄嘗試次數過多，請稍後再試'
          break
        case 'auth/network-request-failed':
          errorMessage = '網絡連接失敗，請檢查您的網絡連接'
          break
        case 'auth/invalid-credential':
          errorMessage = '電子郵件或密碼不正確'
          break
        default:
          errorMessage = err.message || '登錄失敗，請檢查您的憑證'
      }
      
      setError(errorMessage)
      console.error('登錄錯誤:', err.code, err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-white rounded-lg border border-gray-300 p-6">
          <div className="flex items-center gap-3 mb-6">
            <LogIn className="w-6 h-6 text-red-600" />
            <h1 className="text-2xl font-bold text-gray-900">管理員登錄</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium mb-1">登錄失敗</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                電子郵件
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密碼
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '登錄中...' : '登錄'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

