import type { Config } from 'jest'

const config: Config = {
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Jest runs CommonJS; path aliases via moduleNameMapper (kept in sync with vite/tsconfig)
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          esModuleInterop: true,
          strict: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          paths: {
            '@/*': ['./src/*'],
          },
        },
      },
    ],
  },
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/src/__tests__/e2e/'],
}

export default config
