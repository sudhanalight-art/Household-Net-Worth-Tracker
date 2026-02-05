import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // ⚠️ 修正：移除 .tsx 副檔名
import './index.css' 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)