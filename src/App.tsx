import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from './config/firebase'
import HomePage from './pages/HomePage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboard from './pages/AdminDashboard'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">載入中...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/admin"
          element={user ? <Navigate to="/admin/dashboard" replace /> : <AdminLoginPage />}
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App

