import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
    mode: 'production',
    build: {
        lib: {
            entry: resolve(__dirname, './src/LogInspector.ts'),
            name: 'LogInspector',
            fileName: 'log-inspector',
        },
        minify: 'esbuild',
        outDir: resolve(__dirname, 'umd'),
        rollupOptions: {
            external: [],
            output: {
                globals: {},
            },
        },
        target: 'esnext',
    },
    esbuild: {
        keepNames: true,
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext',
        },
    },
    plugins: [
    ],
    define: {
        __INTLIFY_JIT_COMPILATION__: true,
        'process.env': process.env,
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
})
