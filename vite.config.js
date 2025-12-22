import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default ({ mode }) => {
  // load env vars so we can use VITE_API_BASE_URL in the proxy
  const env = loadEnv(mode, process.cwd(), '')

  return defineConfig({
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://localhost:7191',
          changeOrigin: true,
          secure: false
        }
      }
    },
  })
}
