import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 將 React 和 React DOM 分離到單獨的 chunk
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 將 Firebase 相關代碼分離
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          // 將 Lucide 圖標庫分離（如果使用較多）
          'lucide-icons': ['lucide-react'],
        },
      },
    },
    // 提高 chunk 大小警告限制（因為已經進行了手動分塊）
    chunkSizeWarningLimit: 600,
  },
})

