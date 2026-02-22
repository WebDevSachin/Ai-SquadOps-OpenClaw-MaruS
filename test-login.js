const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto('http://localhost:3000/auth/login');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  console.log('Taking screenshot of login page...');
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/login-before.png', fullPage: true });

  // Fill in login form
  console.log('Filling in credentials...');
  await page.fill('input[type="email"]', 'admin@squadops.local');
  await page.fill('input[type="password"]', 'SquadOps2024!');
  
  // Click sign in
  console.log('Clicking Sign in...');
  await page.click('button:has-text("Sign in")');
  
  // Wait for redirect
  await page.waitForTimeout(5000);
  
  console.log('Taking screenshot after login...');
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/login-after.png', fullPage: true });
  
  console.log('Current URL:', page.url());
  
  await browser.close();
  console.log('Test complete!');
})();
