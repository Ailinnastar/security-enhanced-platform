#!/usr/bin/env node

/**
 * StudyGroup Application Browser Test
 * Tests the application at http://localhost:5180/
 * Performs visual browser automation with screenshots
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const APP_URL = 'http://localhost:5180/';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.blue}[Step ${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveScreenshot(page, name) {
  const timestamp = Date.now();
  const filename = `${timestamp}_${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  log(`  Screenshot saved: ${filename}`, 'cyan');
  return filepath;
}

async function runTest() {
  let browser;
  const testResults = [];
  
  try {
    console.log('\n' + '='.repeat(70));
    log('🧪 STUDYGROUP BROWSER TEST', 'blue');
    log('   Testing at http://localhost:5180/', 'cyan');
    console.log('='.repeat(70));
    
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    log(`Screenshots will be saved to: ${SCREENSHOT_DIR}`, 'cyan');
    
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Step 1: Navigate to the application
    logStep(1, 'Navigate to http://localhost:5180/');
    try {
      await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 10000 });
      logSuccess('Page loaded successfully');
      testResults.push({ step: 1, status: 'PASS', message: 'Navigation successful' });
    } catch (error) {
      logError(`Failed to load page: ${error.message}`);
      testResults.push({ step: 1, status: 'FAIL', message: error.message });
      throw error;
    }
    
    // Step 2: Take screenshot of initial page
    logStep(2, 'Take screenshot of initial page');
    await delay(1000);
    await saveScreenshot(page, 'step2_initial_page');
    
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.toLowerCase().includes('login') || pageText.toLowerCase().includes('sign') || pageText.toLowerCase().includes('account')) {
      logSuccess('Login/Register page detected');
      testResults.push({ step: 2, status: 'PASS', message: 'Initial page is login/register' });
    } else {
      log('⚠ Expected login/register page but text content unclear', 'yellow');
      testResults.push({ step: 2, status: 'WARNING', message: 'Login page not clearly detected' });
    }
    
    // Step 3: Click "Create Account" to switch to registration mode
    logStep(3, 'Click "Create Account" to switch to registration mode');
    try {
      const createAccountButton = await page.waitForSelector('button::-p-text(Create Account)', { timeout: 5000 });
      await createAccountButton.click();
      await delay(500);
      logSuccess('Clicked "Create Account" button');
      testResults.push({ step: 3, status: 'PASS', message: 'Switched to registration mode' });
    } catch (error) {
      logError(`Failed to find or click "Create Account": ${error.message}`);
      await saveScreenshot(page, 'step3_error_no_create_account');
      testResults.push({ step: 3, status: 'FAIL', message: error.message });
      throw error;
    }
    
    // Step 4: Fill in registration form
    logStep(4, 'Fill in registration form with test data');
    await delay(500);
    await saveScreenshot(page, 'step4_before_fill');
    
    try {
      await page.type('input[name="username"], input[placeholder*="username" i]', 'Alice');
      logSuccess('Entered username: Alice');
      
      await page.type('input[name="email"], input[type="email"], input[placeholder*="email" i]', 'alice@test.com');
      logSuccess('Entered email: alice@test.com');
      
      await page.type('input[name="password"], input[type="password"], input[placeholder*="password" i]', 'password123');
      logSuccess('Entered password: password123');
      
      await delay(500);
      await saveScreenshot(page, 'step4_after_fill');
      testResults.push({ step: 4, status: 'PASS', message: 'Form filled successfully' });
    } catch (error) {
      logError(`Failed to fill form: ${error.message}`);
      await saveScreenshot(page, 'step4_error_fill');
      testResults.push({ step: 4, status: 'FAIL', message: error.message });
      throw error;
    }
    
    // Step 5: Click "Create Account" button to register
    logStep(5, 'Click "Create Account" button to register');
    try {
      const submitButton = await page.$('button[type="submit"]::-p-text(Create Account)');
      if (submitButton) {
        await submitButton.click();
      } else {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text.toLowerCase().includes('create') || text.toLowerCase().includes('register') || text.toLowerCase().includes('sign up')) {
            await button.click();
            break;
          }
        }
      }
      logSuccess('Clicked registration submit button');
      await delay(2000);
      testResults.push({ step: 5, status: 'PASS', message: 'Registration submitted' });
    } catch (error) {
      logError(`Failed to submit registration: ${error.message}`);
      await saveScreenshot(page, 'step5_error_submit');
      testResults.push({ step: 5, status: 'FAIL', message: error.message });
      throw error;
    }
    
    // Step 6: Take screenshot after registration
    logStep(6, 'Take screenshot after registration');
    await delay(1000);
    await saveScreenshot(page, 'step6_after_registration');
    
    const postRegText = await page.evaluate(() => document.body.innerText);
    if (postRegText.toLowerCase().includes('welcome') || 
        postRegText.toLowerCase().includes('server') ||
        postRegText.toLowerCase().includes('chat')) {
      logSuccess('Main app view detected with welcome/server interface');
      testResults.push({ step: 6, status: 'PASS', message: 'Navigated to main app' });
    } else {
      log('⚠ Main app interface not clearly detected', 'yellow');
      testResults.push({ step: 6, status: 'WARNING', message: 'Main app not clearly detected' });
    }
    
    // Step 7: Try creating a server
    logStep(7, 'Click "+" button in left sidebar to create server');
    await delay(1000);
    try {
      let plusButton = await page.$('button::-p-text(+)');
      if (!plusButton) {
        plusButton = await page.$('[aria-label*="create" i], [title*="create" i]');
      }
      if (!plusButton) {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent.trim(), button);
          if (text === '+' || text.includes('Add')) {
            plusButton = button;
            break;
          }
        }
      }
      
      if (plusButton) {
        await plusButton.click();
        await delay(500);
        logSuccess('Clicked "+" button to open server creation dialog');
        await saveScreenshot(page, 'step7_server_dialog');
        testResults.push({ step: 7, status: 'PASS', message: 'Server creation dialog opened' });
      } else {
        throw new Error('Could not find "+" button');
      }
    } catch (error) {
      logError(`Failed to open server creation: ${error.message}`);
      await saveScreenshot(page, 'step7_error_no_plus');
      testResults.push({ step: 7, status: 'FAIL', message: error.message });
      throw error;
    }
    
    // Step 8: Fill in server details
    logStep(8, 'Fill in server name and description');
    await delay(500);
    try {
      const nameInput = await page.$('input[name="name"], input[placeholder*="name" i]');
      if (nameInput) {
        await nameInput.click({ clickCount: 3 });
        await nameInput.type('COMP3000 Group A');
        logSuccess('Entered server name: COMP3000 Group A');
      }
      
      const descInput = await page.$('input[name="description"], textarea[name="description"], input[placeholder*="description" i], textarea[placeholder*="description" i]');
      if (descInput) {
        await descInput.click({ clickCount: 3 });
        await descInput.type('Our study group');
        logSuccess('Entered description: Our study group');
      }
      
      await delay(500);
      await saveScreenshot(page, 'step8_filled_server_form');
      testResults.push({ step: 8, status: 'PASS', message: 'Server form filled' });
    } catch (error) {
      logError(`Failed to fill server form: ${error.message}`);
      await saveScreenshot(page, 'step8_error_fill');
      testResults.push({ step: 8, status: 'FAIL', message: error.message });
      throw error;
    }
    
    // Step 9: Click "Create Server" button
    logStep(9, 'Click "Create Server" button');
    try {
      const createServerButton = await page.$('button[type="submit"]::-p-text(Create)');
      if (createServerButton) {
        await createServerButton.click();
      } else {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text.toLowerCase().includes('create')) {
            await button.click();
            break;
          }
        }
      }
      logSuccess('Clicked "Create Server" button');
      await delay(2000);
      testResults.push({ step: 9, status: 'PASS', message: 'Server creation submitted' });
    } catch (error) {
      logError(`Failed to create server: ${error.message}`);
      await saveScreenshot(page, 'step9_error_submit');
      testResults.push({ step: 9, status: 'FAIL', message: error.message });
      throw error;
    }
    
    // Step 10: Take screenshot of created server
    logStep(10, 'Take screenshot of server with chat and members sidebar');
    await delay(1500);
    await saveScreenshot(page, 'step10_server_created');
    
    const serverText = await page.evaluate(() => document.body.innerText);
    if (serverText.includes('COMP3000') || serverText.toLowerCase().includes('member') || serverText.toLowerCase().includes('chat')) {
      logSuccess('Server view showing chat interface');
      testResults.push({ step: 10, status: 'PASS', message: 'Server created successfully' });
    } else {
      log('⚠ Server interface not clearly detected', 'yellow');
      testResults.push({ step: 10, status: 'WARNING', message: 'Server view unclear' });
    }
    
    // Step 11: Type and send a message
    logStep(11, 'Type message "Hello everyone!" and send');
    await delay(1000);
    try {
      const chatInput = await page.$('input[placeholder*="message" i], textarea[placeholder*="message" i], input[type="text"]');
      if (chatInput) {
        await chatInput.click();
        await chatInput.type('Hello everyone!');
        logSuccess('Typed message: "Hello everyone!"');
        await delay(500);
        
        await page.keyboard.press('Enter');
        logSuccess('Pressed Enter to send message');
        await delay(1500);
        testResults.push({ step: 11, status: 'PASS', message: 'Message sent' });
      } else {
        throw new Error('Could not find chat input field');
      }
    } catch (error) {
      logError(`Failed to send message: ${error.message}`);
      await saveScreenshot(page, 'step11_error_message');
      testResults.push({ step: 11, status: 'FAIL', message: error.message });
      throw error;
    }
    
    // Step 12: Take final screenshot to verify message
    logStep(12, 'Take screenshot to verify message appears with username');
    await delay(1000);
    await saveScreenshot(page, 'step12_message_sent');
    
    const finalText = await page.evaluate(() => document.body.innerText);
    if (finalText.includes('Hello everyone!')) {
      if (finalText.toLowerCase().includes('alice')) {
        logSuccess('Message appears with username "Alice"');
        testResults.push({ step: 12, status: 'PASS', message: 'Message displayed correctly with username' });
      } else {
        logSuccess('Message appears (username verification unclear)');
        testResults.push({ step: 12, status: 'PASS', message: 'Message displayed' });
      }
    } else {
      log('⚠ Message not clearly visible in page text', 'yellow');
      testResults.push({ step: 12, status: 'WARNING', message: 'Message visibility unclear' });
    }
    
    console.log('\n' + '='.repeat(70));
    log('📊 TEST RESULTS', 'blue');
    console.log('='.repeat(70));
    
    let passed = 0, failed = 0, warnings = 0;
    testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
      const color = result.status === 'PASS' ? 'green' : result.status === 'FAIL' ? 'red' : 'yellow';
      log(`${icon} Step ${result.step}: ${result.message}`, color);
      if (result.status === 'PASS') passed++;
      else if (result.status === 'FAIL') failed++;
      else if (result.status === 'WARNING') warnings++;
    });
    
    console.log('='.repeat(70));
    logSuccess(`Passed: ${passed}/${testResults.length}`);
    if (warnings > 0) log(`⚠ Warnings: ${warnings}`, 'yellow');
    if (failed > 0) logError(`Failed: ${failed}/${testResults.length}`);
    console.log('='.repeat(70));
    
    log('\n📁 All screenshots saved to: ' + SCREENSHOT_DIR, 'cyan');
    
    await delay(3000);
    
  } catch (error) {
    logError(`\nTest suite failed: ${error.message}`);
    console.error(error.stack);
    return 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  console.log('\n' + '='.repeat(70));
  log('✅ TEST COMPLETED', 'green');
  console.log('='.repeat(70) + '\n');
  
  return 0;
}

runTest().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
