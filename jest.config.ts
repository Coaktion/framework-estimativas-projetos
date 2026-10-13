import { type Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  // Os testes do Pre-Sales Ops rodam no test runner do Node: npm run psops:test
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/lib/psops/'],
};

export default config;
