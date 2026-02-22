const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  
  console.log('1. Opening login page...');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  
  console.log('2. Logging in as admin...');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForTimeout(5000);
  
  console.log('3. Current URL:', page.url());
  
  // Take screenshot
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-login-success.png', fullPage: true });
  
  // Check for sidebar
  const sidebar = await page.$('aside');
  console.log('   Sidebar visible:', sidebar !== null);
  
  // Check for admin link
  const adminLink = await page.$('a[href="/admin"]');
  console.log('   Admin link visible:', adminLink !== null);
  
  // Wait a bit more
  await page.waitForTimeout(5000);
  
  console.log('\nFinal URL:', page.url());
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-final-result.png', fullPage: true });
  
  await browser.close();
  console.log('\nDone!');
})();
