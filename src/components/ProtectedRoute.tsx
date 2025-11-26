import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '../config/firebase'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">載入中...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}

