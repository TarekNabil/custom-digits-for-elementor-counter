/**
 * Jest configuration.
 *
 * The plugin's scripts are plain browser IIFEs with no exports, so the tests
 * require() them for their side effects inside a jsdom document and then assert
 * on the DOM. Going through require() rather than eval keeps Jest's coverage
 * instrumentation working on them.
 */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests/js"],
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: ["assets/js/**/*.js"],
  coverageDirectory: "coverage/js",
  coverageReporters: ["text", "lcov"],
  clearMocks: true,
  restoreMocks: true,
};
