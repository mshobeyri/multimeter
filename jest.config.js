const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: "node",
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.jest.json',
    },
  },
  transform: {
    ...tsJestTransformCfg,
  },
  testMatch: [
    '<rootDir>/core/src/**/?(*.)+(test).[tj]s?(x)',
    '<rootDir>/src/**/?(*.)+(test).[tj]s?(x)',
    '<rootDir>/mmtview/src/**/?(*.)+(test).[tj]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};