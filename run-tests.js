const { chromium } = require('playwright');

const SCREENSHOTS_DIR = '/Users/sachinkumar/ai-poc/squadops/test-results';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('Starting browser test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Test 1: Landing Page
  console.log('\n=== Test 1.1: Landing Page ===');
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1.1-landing.png`, fullPage: true });
  console.log('Screenshot: 1.1-landing.png');
  
  // Test 2: Login Page
  console.log('\n=== Test 1.2: Login Page ===');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1.2-login.png`, fullPage: true });
  console.log('Screenshot: 1.2-login.png');
  
  // Test 3: Login as Admin
  console.log('\n=== Test 1.3: Login Admin ===');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await sleep(5000);
  const adminUrl = page.url();
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1.3-admin-login.png`, fullPage: true });
  console.log('URL after admin login:', adminUrl);
  console.log('Screenshot: 1.3-admin-login.png');
  
  // Check if sidebar exists
  const sidebar = await page.$('aside');
  console.log('Sidebar visible:', sidebar !== null);
  
  // Check for Admin link
  const adminLink = await page.$('a[href="/admin"]');
  console.log('Admin link visible:', adminLink !== null);
  
  // Test 4: Navigate to Admin Dashboard
  console.log('\n=== Test 4.1: Admin Dashboard ===');
  await page.goto('http://localhost:3000/admin');
  await page.waitForLoadState('networkidle');
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/4.1-admin-dashboard.png`, fullPage: true });
  console.log('Screenshot: 4.1-admin-dashboard.png');
  
  // Test 5: Admin Users
  console.log('\n=== Test 4.2: Admin Users ===');
  await page.goto('http://localhost:3000/admin/users');
  await page.waitForLoadState('networkidle');
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/4.2-admin-users.png`, fullPage: true });
  console.log('Screenshot: 4.2-admin-users.png');
  
  // Logout and test normal user
  console.log('\n=== Logging out ===');
  // Clear storage
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:3000/auth/login');
  await sleep(2000);
  
  // Test 6: Login as Normal User
  console.log('\n=== Test 1.4: Login Normal User ===');
  await page.fill('input[type="email"]', 'sachin@gmail.com');
  await page.fill('input[type="password"]', 'test123');
  await page.click('button[type="submit"]');
  await sleep(5000);
  const normalUrl = page.url();
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/1.4-normal-login.png`, fullPage: true });
  console.log('URL after normal login:', normalUrl);
  console.log('Screenshot: 1.4-normal-login.png');
  
  // Test 7: Normal User Dashboard
  console.log('\n=== Test 3.1: User Dashboard ===');
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/3.1-user-dashboard.png`, fullPage: true });
  console.log('Screenshot: 3.1-user-dashboard.png');
  
  // Test 8: Tasks Page
  console.log('\n=== Test 3.2: Tasks Page ===');
  await page.goto('http://localhost:3000/tasks');
  await page.waitForLoadState('networkidle');
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/3.2-tasks.png`, fullPage: true });
  console.log('Screenshot: 3.2-tasks.png');
  
  // Test 9: Settings Page
  console.log('\n=== Test 3.8: Settings Page ===');
  await page.goto('http://localhost:3000/settings');
  await page.waitForLoadState('networkidle');
  await sleep(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/3.8-settings.png`, fullPage: true });
  console.log('Screenshot: 3.8-settings.png');
  
  console.log('\n=== All tests complete! ===');
  console.log('Screenshots saved to:', SCREENSHOTS_DIR);
  
  await sleep(5000);
  await browser.close();
}

test().catch(console.error);
