import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: [
            {
                // The inspector imports these for the custom elements they define. See the stub for
                // why the real ones are kept out of the suite.
                find: /^@awesome\.me\/webawesome\/.*$/,
                replacement: fileURLToPath(new URL('./tests/stubs/webawesome.ts', import.meta.url)),
            },
        ],
    },
    test: {
        // The logger itself touches no DOM, so the suite runs in the lighter environment by default.
        // The inspector's own file asks for jsdom with a docblock.
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reportsDirectory: 'tests/coverage',
        },
    },
})
