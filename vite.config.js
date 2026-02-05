import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default ({ mode }) => {
  // load env vars so we can use VITE_API_BASE_URL in the proxy
  const env = loadEnv(mode, process.cwd(), '')

  return defineConfig({
    plugins: [react()],
    // Pre-bundle and ensure ESM exports for some dependencies (fixes missing named exports)
    optimizeDeps: {
      include: ['@chakra-ui/react', '@emotion/react', '@emotion/styled', 'framer-motion']
    },
    ssr: {
      // Do not externalize Chakra so its ESM build is used during SSR/optimization
      noExternal: ['@chakra-ui/react', '@emotion/react', '@emotion/styled']
    },
    // Ensure CommonJS modules with mixed ESM/CJS are transformed
    build: {
      commonjsOptions: {
        transformMixedEsModules: true
      }
    },
    server: {
      port: 3000,
      proxy: {
        // existing backend API proxy
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://localhost:7191',
          changeOrigin: true,
          secure: false
        }
      }
    },
  })
}
