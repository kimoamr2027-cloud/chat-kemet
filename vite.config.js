import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// VITE_BACKEND=pb: نسخة الشات اللي بتشتغل على سيرفر PocketBase (الملفات دي بتتبدّل بنسختها في src/pb)
const PB = process.env.VITE_BACKEND === 'pb'
const pbDir = fileURLToPath(new URL('./src/pb/', import.meta.url))

// اسم الريبو على GitHub — لازم يطابق علشان GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: PB ? '/chat-kemet/pb/' : '/chat-kemet/',
  resolve: {
    alias: PB ? [{ find: /^(?:\.\.?\/)+(rooms|presence|roles|filter|dm|notifs|ludo|domino|games|coins)\.js$/, replacement: pbDir + '$1.js' }] : [],
  },
  build: {
    // يشتغل على المتصفحات القديمة شوية كمان (Safari 14، Chrome 87، Firefox 78، Edge، Samsung Internet — أقل من كده Firebase نفسه مش بيشتغل)
    target: ['es2020', 'safari14', 'chrome87', 'firefox78', 'edge88'],
    cssTarget: ['safari14', 'chrome87', 'firefox78', 'edge88'],
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Firebase و React في ملفات لوحدهم علشان المتصفح يخزّنهم ومايحمّلهمش تاني مع كل تحديث
        manualChunks(id) {
          if (id.includes('node_modules/@firebase/firestore') || id.includes('node_modules/firebase/firestore')) return 'firestore'
          if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
        },
      },
    },
  },
})
