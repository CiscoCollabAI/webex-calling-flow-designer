import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // All /webex-api/* requests are proxied to https://webexapis.com/v1/*
      // This runs in Node.js (not the browser) so CORS does not apply.
      '/webex-api': {
        target: 'https://webexapis.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/webex-api/, ''),
        secure: true,
      },
    },
  },
})
