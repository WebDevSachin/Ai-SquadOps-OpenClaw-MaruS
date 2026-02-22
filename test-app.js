const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser test...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Test 1: Login page
  console.log('1. Testing login page...');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  console.log('   Login page loaded:', page.url());
  
  // Test 2: Fill login form
  console.log('2. Filling login form...');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  // Wait for login to complete
  await page.waitForTimeout(3000);
  
  const currentUrl = page.url();
  console.log('   After login, URL:', currentUrl);
  
  // Test 3: Check if we can see the dashboard
  console.log('3. Checking dashboard...');
  const pageContent = await page.content();
  
  if (currentUrl.includes('/admin')) {
    console.log('   ✅ Redirected to admin dashboard!');
  } else if (currentUrl.includes('/onboarding')) {
    console.log('   ✅ Redirected to onboarding!');
  } else if (currentUrl === 'http://localhost:3000/' || currentUrl === 'http://localhost:3000') {
    console.log('   ✅ Redirected to main dashboard!');
  } else {
    console.log('   ⚠️  Redirected to:', currentUrl);
  }
  
  // Check for sidebar
  const sidebarExists = await page.$('aside') !== null;
  console.log('   Sidebar exists:', sidebarExists);
  
  // Check for admin link
  const adminLink = await page.$('a[href="/admin"]');
  console.log('   Admin link visible:', adminLink !== null);
  
  // Take screenshot
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-login.png', fullPage: true });
  console.log('   Screenshot saved to test-login.png');
  
  // Test 4: Check navigation items
  const navItems = await page.$$('nav a');
  console.log('   Navigation items count:', navItems.length);
  
  // Test 5: Try admin page directly
  console.log('5. Testing admin page...');
  await page.goto('http://localhost:3000/admin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-admin.png', fullPage: true });
  console.log('   Admin page URL:', page.url());
  console.log('   Screenshot saved to test-admin.png');
  
  // Test 6: Test normal user login
  console.log('6. Testing normal user login...');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'sachin@gmail.com');
  await page.fill('input[type="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  const normalUserUrl = page.url();
  console.log('   Normal user after login:', normalUserUrl);
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-normal-user.png', fullPage: true });
  
  await browser.close();
  console.log('\n✅ All tests completed!');
})();
