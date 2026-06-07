/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    // Use the test tsconfig (build options + Jest ambient types) instead of the build one.
    // isolatedModules = transpile-only (the build's `tsc` does the type-checking).
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.spec.json', isolatedModules: true }],
  },
  moduleNameMapper: {
    // Source uses ESM-style './foo.js' relative imports; strip the extension so the CJS
    // Jest resolver finds the './foo.ts' source. Test files use no '.js' imports.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
