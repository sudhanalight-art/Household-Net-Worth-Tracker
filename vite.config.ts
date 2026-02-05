import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ⚠️ 確保這裡與您的 Repo 名稱完全一致，前後都要有斜線
  base: '/Household-Net-Worth-Tracker/',
})