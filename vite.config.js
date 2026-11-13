import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// اسم الريبو على GitHub — لازم يطابق علشان GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: '/chat-kemet/',
})
