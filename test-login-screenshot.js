const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
    
    // Wait for the page to fully load
    await page.waitForTimeout(1000);
    
    // Take screenshot of the login form
    await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-results/login-before.png', fullPage: true });
    console.log('Screenshot saved: login-before.png');

    // Fill in email
    console.log('Filling email...');
    await page.fill('input[type="email"]', 'admin@squadops.local');
    
    // Fill in password
    console.log('Filling password...');
    await page.fill('input[type="password"]', 'SquadOps2024!');
    
    // Take screenshot after filling credentials
    await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-results/login-filled.png', fullPage: true });
    console.log('Screenshot saved: login-filled.png');

    // Click the Sign in button
    console.log('Clicking Sign in button...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]')
    ]);

    // Wait for page to load after login
    await page.waitForTimeout(2000);
    
    // Take screenshot after login attempt
    await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-results/login-after.png', fullPage: true });
    console.log('Screenshot saved: login-after.png');

    // Get current URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // Check if login was successful by looking for dashboard elements
    const isLoggedIn = await page.locator('text=Dashboard').count() > 0 || 
                       await page.locator('text=Welcome').count() > 0 ||
                       !currentUrl.includes('/auth/login');
    
    console.log('Login successful:', isLoggedIn);

  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-results/login-error.png', fullPage: true });
    console.log('Error screenshot saved: login-error.png');
  } finally {
    await browser.close();
  }
})();
