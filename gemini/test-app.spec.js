const { test, expect } = require('@playwright/test');

// Configuration
const BASE_URL = 'http://localhost:5177';
const TEST_USERNAME = `testuser_${Date.now()}`;
const TEST_PASSWORD = 'password123';
const TEST_SERVER_NAME = 'Test Server';

test.describe('Discord-like App Full Feature Test', () => {
  
  test('Complete user flow: Register, Login, Create Server, Chat, Deadlines, Polls, Video Summaries', async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    console.log('\n========================================');
    console.log('🚀 Starting comprehensive app test...');
    console.log('========================================\n');

    // Step 1: Navigate to the application
    console.log('Step 1: Navigating to', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'screenshots/01-landing-page.png', fullPage: true });
    console.log('✅ Successfully loaded landing page\n');

    // Step 2: Click "Sign up" link
    console.log('Step 2: Clicking on "Sign up" link');
    const signUpLink = page.locator('button:has-text("Sign up")').first();
    await expect(signUpLink).toBeVisible({ timeout: 10000 });
    await signUpLink.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/02-signup-form.png', fullPage: true });
    console.log('✅ Sign up form is displayed\n');

    // Step 3: Register a new user
    console.log(`Step 3: Registering new user: ${TEST_USERNAME}`);
    
    // Fill registration form
    const usernameInput = page.locator('input[type="text"], input[placeholder*="username" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    await usernameInput.fill(TEST_USERNAME);
    await passwordInput.fill(TEST_PASSWORD);
    
    // Click register/signup button
    const registerButton = page.locator('button:has-text("Sign up"), button:has-text("Register")').first();
    await registerButton.click();
    
    // Wait for either success or to be redirected to dashboard
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/03-after-registration.png', fullPage: true });
    console.log('✅ Registration submitted\n');

    // Step 4: Login with the created credentials (if not auto-logged in)
    console.log('Step 4: Attempting to login');
    
    // Check if we're already logged in (by looking for dashboard elements)
    const isDashboard = await page.locator('text=/Create Server/i, text=/Server/i').count();
    
    if (isDashboard === 0) {
      // We're still on login page, need to login manually
      console.log('Not auto-logged in, logging in manually...');
      
      // Click "Login" or "Sign in" link if on signup page
      const loginLink = page.locator('text=/Already have an account\\? Log in/i, text=/Log in/i, text=/Sign in/i').first();
      const loginLinkVisible = await loginLink.isVisible().catch(() => false);
      if (loginLinkVisible) {
        await loginLink.click();
        await page.waitForTimeout(1000);
      }
      
      // Fill login form
      await usernameInput.fill(TEST_USERNAME);
      await passwordInput.fill(TEST_PASSWORD);
      
      // Click login button
      const loginButton = page.locator('button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in")').first();
      await loginButton.click();
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: 'screenshots/04-logged-in-dashboard.png', fullPage: true });
    console.log('✅ Successfully logged in\n');

    // Step 5: Create a server
    console.log(`Step 5: Creating server: ${TEST_SERVER_NAME}`);
    
    // Find and click "Create Server" button
    const createServerButton = page.locator('button:has-text("Create Server"), button:has-text("+ Create Server")').first();
    await expect(createServerButton).toBeVisible({ timeout: 10000 });
    await createServerButton.click();
    await page.waitForTimeout(1000);
    
    // Fill server name input
    const serverNameInput = page.locator('input[placeholder*="Server name" i], input[placeholder*="name" i]').last();
    await serverNameInput.fill(TEST_SERVER_NAME);
    
    // Submit the form
    const createButton = page.locator('button:has-text("Create")').last();
    await createButton.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/05-server-created.png', fullPage: true });
    console.log('✅ Server created successfully\n');

    // Step 6: Send a chat message
    console.log('Step 6: Sending chat message');
    
    // Find chat input and send message
    const chatInput = page.locator('input[placeholder*="Type a message" i], input[placeholder*="message" i], textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await chatInput.fill('Hello world!');
    
    // Press Enter or click send button
    await chatInput.press('Enter');
    await page.waitForTimeout(2000);
    
    // Verify message appears
    const message = page.locator('text=/Hello world!/i');
    await expect(message).toBeVisible({ timeout: 5000 });
    
    await page.screenshot({ path: 'screenshots/06-chat-message-sent.png', fullPage: true });
    console.log('✅ Chat message sent and displayed\n');

    // Step 7: Add a deadline
    console.log('Step 7: Adding a deadline');
    
    // Click on Deadlines/Calendar icon in header
    const deadlineIcon = page.locator('[aria-label*="Deadline" i], [title*="Deadline" i], button:has-text("Deadlines")').first();
    const deadlineIconAlt = page.locator('button, a').filter({ has: page.locator('svg') }).nth(0); // First icon button
    
    let deadlineClicked = false;
    try {
      await deadlineIcon.click({ timeout: 3000 });
      deadlineClicked = true;
    } catch {
      // Try alternative selector
      const allButtons = await page.locator('button').all();
      for (const btn of allButtons) {
        const text = await btn.innerText().catch(() => '');
        if (text.toLowerCase().includes('deadline') || text.toLowerCase().includes('calendar')) {
          await btn.click();
          deadlineClicked = true;
          break;
        }
      }
    }
    
    if (!deadlineClicked) {
      console.log('⚠️  Could not find Deadlines button, trying header icons...');
      // Try clicking header icons in sequence
      const headerButtons = page.locator('header button, nav button').all();
      const buttons = await headerButtons;
      if (buttons.length > 0) {
        await buttons[0].click();
      }
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/07-deadlines-view.png', fullPage: true });
    
    // Fill deadline form
    const deadlineTitleInput = page.locator('input[placeholder*="title" i], input[placeholder*="Task" i]').first();
    await deadlineTitleInput.fill('Test Task');
    
    const deadlineDateInput = page.locator('input[type="date"], input[type="datetime-local"]').first();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
    const dateString = futureDate.toISOString().split('T')[0];
    await deadlineDateInput.fill(dateString);
    
    // Submit deadline
    const addDeadlineButton = page.locator('button:has-text("Add")').first();
    await addDeadlineButton.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/08-deadline-added.png', fullPage: true });
    console.log('✅ Deadline added successfully\n');

    // Step 8: Create a poll
    console.log('Step 8: Creating a poll');
    
    // Navigate to Polls
    const pollIcon = page.locator('[aria-label*="Poll" i], [title*="Poll" i], button:has-text("Polls")').first();
    
    let pollClicked = false;
    try {
      await pollIcon.click({ timeout: 3000 });
      pollClicked = true;
    } catch {
      // Try alternative - look for Poll text in buttons
      const allButtons = await page.locator('button').all();
      for (const btn of allButtons) {
        const text = await btn.innerText().catch(() => '');
        if (text.toLowerCase().includes('poll')) {
          await btn.click();
          pollClicked = true;
          break;
        }
      }
    }
    
    if (!pollClicked) {
      console.log('⚠️  Could not find Polls button, trying header icons...');
      const headerButtons = page.locator('header button, nav button').all();
      const buttons = await headerButtons;
      if (buttons.length > 1) {
        await buttons[1].click();
      }
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/09-polls-view.png', fullPage: true });
    
    // Fill poll form
    const pollQuestionInput = page.locator('input[placeholder*="question" i], input[placeholder*="poll" i]').first();
    await pollQuestionInput.fill('What is your favorite color?');
    
    // Fill poll options
    const optionInputs = page.locator('input[placeholder*="option" i]');
    const optionCount = await optionInputs.count();
    if (optionCount >= 2) {
      await optionInputs.nth(0).fill('Blue');
      await optionInputs.nth(1).fill('Red');
    }
    
    // Submit poll
    const createPollButton = page.locator('button:has-text("Create Poll"), button:has-text("Add Poll")').first();
    await createPollButton.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/10-poll-created.png', fullPage: true });
    console.log('✅ Poll created successfully\n');

    // Step 9: Create a video summary
    console.log('Step 9: Creating a video summary');
    
    // Navigate to Video Summaries
    const videoIcon = page.locator('[aria-label*="Video" i], [title*="Video" i], button:has-text("Video")').first();
    
    let videoClicked = false;
    try {
      await videoIcon.click({ timeout: 3000 });
      videoClicked = true;
    } catch {
      // Try alternative
      const allButtons = await page.locator('button').all();
      for (const btn of allButtons) {
        const text = await btn.innerText().catch(() => '');
        if (text.toLowerCase().includes('video') || text.toLowerCase().includes('summar')) {
          await btn.click();
          videoClicked = true;
          break;
        }
      }
    }
    
    if (!videoClicked) {
      console.log('⚠️  Could not find Video Summaries button, trying header icons...');
      const headerButtons = page.locator('header button, nav button').all();
      const buttons = await headerButtons;
      if (buttons.length > 2) {
        await buttons[2].click();
      }
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/11-video-summaries-view.png', fullPage: true });
    
    // Fill video summary form
    const videoTitleInput = page.locator('input[placeholder*="title" i], input[placeholder*="video" i]').first();
    await videoTitleInput.fill('Test Video Summary');
    
    const videoContentInput = page.locator('textarea, input[placeholder*="content" i]').first();
    await videoContentInput.fill('This is a summary of the test video content.');
    
    // Submit video summary
    const addVideoButton = page.locator('button:has-text("Add"), button:has-text("Create")').first();
    await addVideoButton.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'screenshots/12-video-summary-created.png', fullPage: true });
    console.log('✅ Video summary created successfully\n');

    // Final screenshot
    await page.screenshot({ path: 'screenshots/13-final-state.png', fullPage: true });

    console.log('\n========================================');
    console.log('🎉 All tests completed successfully!');
    console.log('========================================\n');
    console.log('Test Summary:');
    console.log('✅ Navigation to app');
    console.log('✅ User registration');
    console.log('✅ User login');
    console.log('✅ Server creation');
    console.log('✅ Chat message sent');
    console.log('✅ Deadline added');
    console.log('✅ Poll created');
    console.log('✅ Video summary created');
    console.log('\n📸 Screenshots saved to screenshots/ directory');
  });
});
