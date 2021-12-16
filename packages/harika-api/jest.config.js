module.exports = {
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/test/**/*.test.ts', '**/src/**/*.test.ts'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./test/jest.setup.ts'],
};
