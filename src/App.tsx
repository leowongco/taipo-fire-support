import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from './config/firebase'
import HomePage from './pages/HomePage'
import NewsPage from './pages/NewsPage'
import ReconstructionPage from './pages/ReconstructionPage'
import HistoryPage from './pages/HistoryPage'
import SupportResourcesPage from './pages/SupportResourcesPage'
import FinancialAidPage from './pages/FinancialAidPage'
import ServicesPage from './pages/ServicesPage'
import MoreSupportPage from './pages/MoreSupportPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboard from './pages/AdminDashboard'
import ProtectedRoute from './components/ProtectedRoute'
import PageTracker from './components/PageTracker'

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
      <PageTracker />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/reconstruction" element={<ReconstructionPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/support-resources" element={<SupportResourcesPage />} />
        <Route path="/financial-aid" element={<FinancialAidPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/more-support" element={<MoreSupportPage />} />
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

