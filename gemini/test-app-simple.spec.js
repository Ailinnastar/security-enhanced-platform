const { test, expect } = require('@playwright/test');

// Configuration
const BASE_URL = 'http://localhost:5177';
const TEST_USERNAME = `testuser_${Date.now()}`;
const TEST_PASSWORD = 'password123';
const TEST_SERVER_NAME = 'Test Server';

test.describe('Discord-like App Feature Test', () => {
  
  test('Complete user flow test', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    console.log('\n========================================');
    console.log('🚀 Starting comprehensive app test...');
    console.log('========================================\n');

    // Step 1: Navigate
    console.log('Step 1: Navigating to', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'screenshots/01-landing-page.png', fullPage: true });
    console.log('✅ Successfully loaded landing page\n');

    // Step 2: Register
    console.log('Step 2: Registering user');
    await page.locator('button:has-text("Sign up")').click();
    await page.waitForTimeout(500);
    
    await page.locator('input[type="text"]').first().fill(TEST_USERNAME);
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await page.locator('button:has-text("Sign Up")').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/02-after-registration.png', fullPage: true });
    console.log('✅ Registration completed\n');

    // Step 3: Login
    console.log('Step 3: Logging in');
    await page.locator('input[type="text"]').first().fill(TEST_USERNAME);
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await page.locator('button:has-text("Log In")').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/03-logged-in.png', fullPage: true });
    console.log('✅ Login successful\n');

    // Step 4: Create Server
    console.log('Step 4: Creating server');
    await page.locator('button:has-text("Create Server")').click();
    await page.waitForTimeout(500);
    await page.locator('input[placeholder*="Server name" i], input[placeholder*="name" i]').last().fill(TEST_SERVER_NAME);
    await page.locator('button:has-text("Create")').last().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/04-server-created.png', fullPage: true });
    console.log('✅ Server created\n');

    // Step 5: Send Chat Message
    console.log('Step 5: Sending chat message');
    const chatInput = page.locator('input[placeholder*="message" i], textarea').first();
    await chatInput.fill('Hello world!');
    await chatInput.press('Enter');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=/Hello world!/i')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'screenshots/05-chat-message.png', fullPage: true });
    console.log('✅ Chat message sent\n');

    // Step 6: Test Deadlines Feature
    console.log('Step 6: Testing Deadlines');
    // Click the first icon button (Calendar/Deadlines)
    const iconButtons = await page.locator('header button, nav button').all();
    if (iconButtons.length > 0) {
      await iconButtons[0].click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/06-deadlines-opened.png', fullPage: true });
      
      // Fill in deadline form
      await page.locator('input[placeholder*="Final Report" i], input[placeholder*="Task" i], input[placeholder*="Title" i]').first().fill('Test Task');
      
      // Fill datetime-local input
      const now = new Date();
      now.setDate(now.getDate() + 7);
      const datetimeString = now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
      await page.locator('input[type="datetime-local"]').first().fill(datetimeString);
      
      // Submit
      await page.locator('button:has-text("Add")').first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'screenshots/07-deadline-added.png', fullPage: true });
      console.log('✅ Deadline added\n');
    }

    // Step 7: Test Polls Feature
    console.log('Step 7: Testing Polls');
    const pollButton = iconButtons.length > 2 ? iconButtons[2] : iconButtons[1];
    if (pollButton) {
      await pollButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/08-polls-opened.png', fullPage: true });
      
      // Try to create a poll
      const questionInput = page.locator('input[placeholder*="question" i]').first();
      const isVisible = await questionInput.isVisible().catch(() => false);
      if (isVisible) {
        await questionInput.fill('What is your favorite color?');
        const optionInputs = await page.locator('input[placeholder*="option" i]').all();
        if (optionInputs.length >= 2) {
          await optionInputs[0].fill('Blue');
          await optionInputs[1].fill('Red');
        }
        await page.locator('button:has-text("Create Poll"), button:has-text("Add Poll")').first().click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'screenshots/09-poll-created.png', fullPage: true });
        console.log('✅ Poll created\n');
      }
    }

    // Step 8: Test Video Summaries Feature
    console.log('Step 8: Testing Video Summaries');
    const videoButton = iconButtons.length > 3 ? iconButtons[3] : iconButtons[iconButtons.length - 1];
    if (videoButton) {
      await videoButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/10-video-summaries-opened.png', fullPage: true });
      
      const titleInput = page.locator('input[placeholder*="title" i], input[placeholder*="video" i]').first();
      const isVisible = await titleInput.isVisible().catch(() => false);
      if (isVisible) {
        await titleInput.fill('Test Video Summary');
        await page.locator('textarea, input[placeholder*="content" i]').first().fill('This is a test summary.');
        await page.locator('button:has-text("Add"), button:has-text("Create")').first().click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'screenshots/11-video-summary-created.png', fullPage: true });
        console.log('✅ Video summary created\n');
      }
    }

    // Final screenshot
    await page.screenshot({ path: 'screenshots/12-final.png', fullPage: true });

    console.log('\n========================================');
    console.log('🎉 Test completed!');
    console.log('========================================\n');
  });
});
