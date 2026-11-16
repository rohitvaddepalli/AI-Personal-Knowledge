/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [
        react(),
    ],
    server: {
        port: 3000,
        host: true,
    },
    build: {
        chunkSizeWarningLimit: 1100,
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    var normalized = id.replace(/\\/g, '/');
                    if (normalized.includes('/node_modules/')) {
                        if (normalized.includes('/react-force-graph') ||
                            normalized.includes('/force-graph') ||
                            normalized.includes('/three') ||
                            normalized.includes('/d3') ||
                            normalized.includes('/kapsule') ||
                            normalized.includes('/accessor-fn')) {
                            return 'vendor-graph';
                        }
                        if (normalized.includes('/@tiptap/') ||
                            normalized.includes('/prosemirror') ||
                            normalized.includes('/orderedmap') ||
                            normalized.includes('/w3c-keyname')) {
                            return 'vendor-tiptap';
                        }
                        if (normalized.includes('/@uiw/') ||
                            normalized.includes('/@codemirror/') ||
                            normalized.includes('/codemirror') ||
                            normalized.includes('/refractor') ||
                            normalized.includes('/prismjs') ||
                            normalized.includes('/rehype') ||
                            normalized.includes('/remark') ||
                            normalized.includes('/micromark') ||
                            normalized.includes('/unified') ||
                            normalized.includes('/unist') ||
                            normalized.includes('/vfile') ||
                            normalized.includes('/hast') ||
                            normalized.includes('/mdast')) {
                            return 'vendor-markdown';
                        }
                        if (normalized.includes('/framer-motion') ||
                            normalized.includes('/lucide-react') ||
                            normalized.includes('/clsx') ||
                            normalized.includes('/tailwind-merge')) {
                            return 'vendor-ui';
                        }
                        if (normalized.includes('/react/') ||
                            normalized.includes('/react-dom/') ||
                            normalized.includes('/react-router/') ||
                            normalized.includes('/react-router-dom/') ||
                            normalized.includes('/zustand/') ||
                            normalized.includes('/scheduler/') ||
                            normalized.includes('/axios/') ||
                            normalized.includes('/tippy.js/')) {
                            return 'vendor-react';
                        }
                    }
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        css: true,
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    },
});
