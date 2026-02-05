import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ⚠️ 這裡非常重要！必須設定為您的新專案名稱，前後都要有斜線
  // 這樣打包後的檔案才會去正確的路徑找資源，解決白屏問題
  base: '/Household-Net-Worth-Tracker/', 
})