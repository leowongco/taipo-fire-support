import { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <Footer />
    </div>
  )
}

