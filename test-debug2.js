const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    console.log('Console:', msg.type(), msg.text());
  });
  
  // Capture page errors
  page.on('pageerror', err => {
    console.log('Page error:', err.message);
  });
  
  console.log('1. Opening login page...');
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('2. Filling login...');
  await page.fill('input[type="email"]', 'admin@squadops.ai');
  await page.fill('input[type="password"]', 'admin123');
  
  // Click and capture response
  const responsePromise = page.waitForResponse(response => 
    response.url().includes('/api/auth/login')
  );
  
  await page.click('button[type="submit"]');
  
  try {
    const response = await responsePromise;
    console.log('3. Response status:', response.status());
    console.log('   Response body:', await response.text().then(t => t.substring(0, 300)));
  } catch (e) {
    console.log('3. No response received');
  }
  
  await page.waitForTimeout(3000);
  console.log('\nFinal URL:', page.url());
  
  // Check localStorage
  const token = await page.evaluate(() => localStorage.getItem('token'));
  console.log('Token in localStorage:', token ? 'YES' : 'NO');
  
  await browser.close();
})();
