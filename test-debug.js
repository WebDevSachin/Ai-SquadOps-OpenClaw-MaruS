const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  
  // Capture all requests and responses
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('api')) {
      requests.push({ url: req.url(), method: req.method() });
    }
  });
  
  const responses = [];
  page.on('response', res => {
    if (res.url().includes('api')) {
      responses.push({ url: res.url(), status: res.status(), body: res.text() });
    }
  });
  
  console.log('1. Opening login page...');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('2. Filling login...');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(5000);
  
  console.log('\n=== API Requests made ===');
  console.log(JSON.stringify(requests, null, 2));
  
  console.log('\n=== API Responses ===');
  for (const r of responses) {
    console.log(`${r.url} -> ${r.status}`);
    if (r.status !== 200) {
      console.log('   Body:', r.body.substring(0, 200));
    }
  }
  
  console.log('\n=== Page URL:', page.url());
  
  await page.waitForTimeout(10000);
  await browser.close();
})();
