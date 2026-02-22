const { chromium } = require('playwright');

async function test() {
  console.log('Starting debug test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();
  
  // Capture all requests
  page.on('request', req => {
    if (req.url().includes('api')) {
      console.log('>>> REQUEST:', req.method(), req.url());
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('api')) {
      console.log('<<< RESPONSE:', res.status(), res.url());
    }
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });
  
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('\n=== Filling login form ===');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  
  console.log('=== Clicking sign in ===');
  await page.click('button[type="submit"]');
  
  // Wait for any API calls
  await page.waitForTimeout(10000);
  
  console.log('\n=== Final URL:', page.url());
  
  // Check what's on the page
  const errorText = await page.$eval('body', el => el.innerText);
  console.log('Page contains error?', errorText.includes('error'));
  
  // Take screenshot
  await page.screenshot({ path: '/Users/sachinkumar/ai-poc/squadops/test-results/debug2.png', fullPage: true });
  
  await browser.close();
}

test().catch(console.error);
