const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser test (visible mode)...');
  
  // Launch browser with visible window
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500  // Slow down for visibility
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  
  // Test 1: Login page
  console.log('1. Opening login page...');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  console.log('   URL:', page.url());
  
  // Wait for user to see
  await page.waitForTimeout(2000);
  
  // Test 2: Fill login form
  console.log('2. Filling login credentials...');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  console.log('   Filled email and password');
  
  await page.waitForTimeout(1000);
  
  // Click submit
  console.log('3. Clicking sign in...');
  await page.click('button[type="submit"]');
  
  // Wait for response
  await page.waitForTimeout(5000);
  
  const currentUrl = page.url();
  console.log('4. After login, URL:', currentUrl);
  
  // Check page content
  const bodyText = await page.textContent('body');
  if (bodyText.includes('Login failed') || bodyText.includes('error')) {
    console.log('   ⚠️  Login may have failed');
  }
  
  await page.waitForTimeout(3000);
  
  // Try clicking around
  console.log('5. Checking page...');
  
  // Take screenshot
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-result.png', fullPage: true });
  console.log('   Screenshot saved');
  
  console.log('\n✅ Test complete. Browser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);
  
  await browser.close();
})();
