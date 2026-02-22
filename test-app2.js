const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser test...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen to console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console Error:', msg.text());
    }
  });
  
  // Listen to network requests
  page.on('response', response => {
    if (response.url().includes('/api/auth/login')) {
      console.log('Login API response:', response.status(), response.url());
    }
  });
  
  // Test 1: Login page
  console.log('\n1. Testing login page...');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  console.log('   Login page loaded:', page.url());
  
  // Check for any error messages on page
  const errorMessage = await page.$('.text-red');
  if (errorMessage) {
    const errorText = await errorMessage.textContent();
    console.log('   Error message found:', errorText);
  }
  
  // Test 2: Fill login form
  console.log('\n2. Filling login form...');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  
  // Click submit and wait
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/auth/login') && response.status() === 200),
    page.click('button[type="submit"]')
  ]);
  
  console.log('   Login API call completed');
  await page.waitForTimeout(2000);
  
  const currentUrl = page.url();
  console.log('   After login, URL:', currentUrl);
  
  // Take screenshot
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-login2.png', fullPage: true });
  console.log('   Screenshot saved');
  
  // Check localStorage for token
  const localStorage = await page.evaluate(() => window.localStorage.getItem('token'));
  console.log('   Token in localStorage:', localStorage ? 'YES' : 'NO');
  
  await browser.close();
  console.log('\n✅ Test completed!');
})();
