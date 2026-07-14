import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      target: 'es2022',
    },
    plugins: [
      react(),
      ViteImageOptimizer({
        png: {
          quality: 80,
        },
        jpeg: {
          quality: 80,
        },
        jpg: {
          quality: 80,
        },
        webp: {
          lossless: true,
        },
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo-new.png'],
        manifest: {
          name: 'SIMPLISH',
          short_name: 'SIMPLISH',
          description: 'AI Coaching Application',
          theme_color: '#0F172A',
          background_color: '#FFFFFF',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: '/logo-new.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/logo-new.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/logo-new.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/logo-new.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
          // Exclude auth endpoints from SW so sessions/roles are always live
          navigateFallbackDenylist: [/^\/auth\//],
          runtimeCaching: [
            {
              // Auth endpoints: NEVER cache — always go to network
              urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Supabase Edge Functions (AI practice / TTS / evaluations): NetworkFirst
              urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/v1\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-functions-cache',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 // 1 day
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Supabase REST API (Curriculum, profiles): NetworkFirst
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 5 // 5 minutes max — prevents stale role data
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Google Fonts: CacheFirst
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Media & Images (local and Supabase Storage): CacheFirst
              urlPattern: /\.(?:png|gif|jpg|jpeg|webp|svg|avif|mp3|wav|ogg|webm)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-media-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // JS & CSS assets: StaleWhileRevalidate
              urlPattern: /\.(?:js|css)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ], resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
