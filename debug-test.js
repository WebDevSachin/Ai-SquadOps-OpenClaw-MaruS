const { chromium } = require('playwright');

const SCREENSHOTS_DIR = '/Users/sachinkumar/ai-poc/squadops/test-results';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  
  // Capture console logs
  page.on('console', msg => {
    console.log('CONSOLE:', msg.type(), msg.text());
  });
  
  // Capture network requests
  page.on('request', req => {
    if (req.url().includes('api')) {
      console.log('REQUEST:', req.method(), req.url());
    }
  });
  
  // Capture responses
  page.on('response', res => {
    if (res.url().includes('api')) {
      console.log('RESPONSE:', res.status(), res.url());
    }
  });
  
  console.log('\n=== Test: Login Debug ===');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  await sleep(2000);
  
  console.log('\nFilling login form...');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  
  console.log('Clicking sign in...');
  await page.click('button[type="submit"]');
  
  await sleep(8000);
  
  console.log('\nFinal URL:', page.url());
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-login.png`, fullPage: true });
  
  // Check localStorage
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token in localStorage:', token ? 'YES' : 'NO');
  
  await sleep(5000);
  await browser.close();
}

test().catch(console.error);
