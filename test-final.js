const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  
  // Test 1: Login page
  console.log('1. Opening login page...');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  console.log('   URL:', page.url());
  
  await page.waitForTimeout(2000);
  
  // Test 2: Fill and submit login
  console.log('2. Logging in as admin...');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForTimeout(5000);
  
  console.log('3. Current URL:', page.url());
  
  // Check where we are
  if (page.url().includes('/admin')) {
    console.log('   ✅ SUCCESS! Logged into admin dashboard');
  } else if (page.url().includes('/onboarding')) {
    console.log('   ✅ Redirected to onboarding');
  } else if (page.url().includes('/auth/login')) {
    console.log('   ❌ Still on login page - login failed');
    // Check for error message
    const error = await page.$('.text-red');
    if (error) {
      console.log('   Error:', await error.textContent());
    }
  } else {
    console.log('   Current page:', page.url());
  }
  
  await page.waitForTimeout(5000);
  
  // Take screenshot
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-final.png', fullPage: true });
  console.log('   Screenshot saved');
  
  await browser.close();
  console.log('\nDone!');
})();
