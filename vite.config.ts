import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ⚠️ 這裡一定要是您的專案名稱，前後都要有斜線 /
  base: '/Household-Net-Worth-Tracker/',
  build: {
    // 忽略大檔案警告
    chunkSizeWarningLimit: 1600,
  }
})