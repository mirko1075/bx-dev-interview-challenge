const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  rootDir: './',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '.*\\.(spec|test)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest'],
  },
    transformIgnorePatterns: [
    '/node_modules/(?!uuid)/',
  ],
  collectCoverage: true,
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/src/main.ts',
    '/src/bootstrap.ts',
    '/src/configs',
    '/dist/',
    '/coverage',
    '.eslintrc.js',
    'jest.config.js',
    '.*.provider.ts$',
    '.*.module.ts$',
    '.*.model.ts$',
    '.*.interface.ts$',
    '.*.mock.ts$',
    '.*.dto.ts$',
    '.*\\.(spec|test)\\.(t|j)s$',
  ],
  moduleFileExtensions: ['js', 'json', 'ts'],
  clearMocks: true,
  setupFiles: ['dotenv/config'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  reporters: ['default'],
  testPathIgnorePatterns: ['/test/'],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
  passWithNoTests: true,
};
