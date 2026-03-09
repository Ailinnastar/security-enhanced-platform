const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 120000, // 2 minutes for the entire test
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: 'http://localhost:5177',
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
});
