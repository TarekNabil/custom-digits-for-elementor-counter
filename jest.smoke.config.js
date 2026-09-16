/**
 * Jest configuration for the smoke suite.
 *
 * Separate from jest.config.js because the two have nothing in common: the unit
 * tests run in jsdom in milliseconds, while these drive Docker and a real
 * WordPress install. Keeping them apart means `npm test` stays fast and needs no
 * Docker.
 */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/smoke"],
  testMatch: ["**/*.test.js"],
  globalSetup: "<rootDir>/tests/smoke/globalSetup.js",
  globalTeardown: "<rootDir>/tests/smoke/globalTeardown.js",
  // Booting wp-env from cold pulls Docker images and WordPress.
  testTimeout: 120000,
  // One site, shared state: parallel workers would fight over it.
  maxWorkers: 1,
  collectCoverage: false,
};
