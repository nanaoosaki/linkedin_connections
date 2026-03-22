module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.ts'],
  setupFiles: ['./tests/setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: { module: 'CommonJS' }
    }
  }
};
