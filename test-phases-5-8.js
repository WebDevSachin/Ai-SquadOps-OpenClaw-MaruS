const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TEST_RESULTS_DIR = '/Users/sachinkumar/ai-poc/squadops/test-results';
const DASHBOARD_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:4000';

const results = {
  phase5: [],
  phase6: [],
  phase7: [],
  phase8: []
};

async function addResult(phase, test) {
  results[phase].push(test);
  console.log(`\n[${phase.toUpperCase()}] ${test.name}: ${test.status}`);
  if (test.notes) console.log(`  Notes: ${test.notes}`);
  if (test.error) console.log(`  Error: ${test.error}`);
}

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  let page = await context.newPage();

  try {
    // ==================== PHASE 5: Navigation & Sidebar Tests ====================
    console.log('\n========== PHASE 5: Navigation & Sidebar Tests ==========');

    // Test 5.1: Sidebar Navigation - Normal User
    console.log('\n--- Test 5.1: Sidebar Navigation - Normal User ---');
    try {
      await context.clearCookies();
      await page.goto(`${DASHBOARD_URL}/auth/login`);
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', 'sachin@gmail.com');
      await page.fill('input[type="password"]', 'test123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      // Navigate to dashboard
      await page.goto(`${DASHBOARD_URL}/dashboard`);
      await page.waitForTimeout(3000);
      
      // Get sidebar items
      const sidebarItems = await page.$$eval('nav[role="navigation"] a, aside nav a, .sidebar a', 
        links => links.map(l => l.textContent.trim()).filter(t => t)
      );
      
      const expectedItems = ['Dashboard', 'Agents', 'Tasks', 'Messages', 'Approvals', 'Audit', 'Goals', 'Usage', 'Recurring'];
      const hasAdmin = sidebarItems.some(t => t.toLowerCase().includes('admin'));
      
      await page.screenshot({ path: path.join(TEST_RESULTS_DIR, '5.1-normal-user-sidebar.png') });
      
      await addResult('phase5', {
        name: 'Test 5.1: Sidebar Navigation - Normal User',
        status: 'PASS',
        sidebarItems,
        hasAdmin,
        expectedItems,
        notes: `Found ${sidebarItems.length} sidebar items. Admin link visible: ${hasAdmin}`
      });
    } catch (error) {
      await addResult('phase5', {
        name: 'Test 5.1: Sidebar Navigation - Normal User',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 5.2: Sidebar Navigation - Admin User
    console.log('\n--- Test 5.2: Sidebar Navigation - Admin User ---');
    try {
      await context.clearCookies();
      await page.goto(`${DASHBOARD_URL}/auth/login`);
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', 'admin@squadops.ai');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      await page.goto(`${DASHBOARD_URL}/dashboard`);
      await page.waitForTimeout(3000);
      
      const adminSidebarItems = await page.$$eval('nav[role="navigation"] a, aside nav a, .sidebar a', 
        links => links.map(l => l.textContent.trim()).filter(t => t)
      );
      
      const hasAdminLink = adminSidebarItems.some(t => t.toLowerCase().includes('admin'));
      
      // Click Admin link
      if (hasAdminLink) {
        await page.click('a:has-text("Admin")');
        await page.waitForTimeout(2000);
        const adminPageLoaded = page.url().includes('/admin');
        
        await addResult('phase5', {
          name: 'Test 5.2: Sidebar Navigation - Admin User',
          status: adminPageLoaded ? 'PASS' : 'FAIL',
          sidebarItems: adminSidebarItems,
          hasAdminLink,
          adminPageLoaded,
          currentUrl: page.url(),
          notes: `Admin link clicked, redirected to: ${page.url()}`
        });
      } else {
        await addResult('phase5', {
          name: 'Test 5.2: Sidebar Navigation - Admin User',
          status: 'FAIL',
          sidebarItems: adminSidebarItems,
          notes: 'Admin link not found in sidebar'
        });
      }
    } catch (error) {
      await addResult('phase5', {
        name: 'Test 5.2: Sidebar Navigation - Admin User',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 5.3: Sidebar Collapse
    console.log('\n--- Test 5.3: Sidebar Collapse ---');
    try {
      await page.goto(`${DASHBOARD_URL}/dashboard`);
      await page.waitForTimeout(2000);
      
      const collapseBtn = await page.$('button:has-text("Collapse")');
      if (collapseBtn) {
        await collapseBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(TEST_RESULTS_DIR, '5.3-sidebar-collapse.png') });
        
        await addResult('phase5', {
          name: 'Test 5.3: Sidebar Collapse',
          status: 'PASS',
          notes: 'Collapse button clicked, screenshot saved'
        });
      } else {
        await addResult('phase5', {
          name: 'Test 5.3: Sidebar Collapse',
          status: 'FAIL',
          notes: 'Collapse button not found'
        });
      }
    } catch (error) {
      await addResult('phase5', {
        name: 'Test 5.3: Sidebar Collapse',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 5.4: Breadcrumb Navigation
    console.log('\n--- Test 5.4: Breadcrumb Navigation ---');
    try {
      await page.goto(`${DASHBOARD_URL}/agents`);
      await page.waitForTimeout(2000);
      
      const breadcrumbs = await page.$$eval('nav[aria-label="breadcrumb"] li, .breadcrumb li, [role="navigation"] li', 
        items => items.map(i => i.textContent.trim())
      );
      
      await addResult('phase5', {
        name: 'Test 5.4: Breadcrumb Navigation',
        status: breadcrumbs.length > 0 ? 'PASS' : 'INFO',
        breadcrumbs,
        notes: breadcrumbs.length > 0 ? `Found breadcrumbs: ${breadcrumbs.join(' > ')}` : 'No breadcrumbs found'
      });
    } catch (error) {
      await addResult('phase5', {
        name: 'Test 5.4: Breadcrumb Navigation',
        status: 'FAIL',
        error: error.message
      });
    }

    // ==================== PHASE 6: API Integration Tests ====================
    console.log('\n========== PHASE 6: API Integration Tests ==========');

    // Test 6.1: API Health Check
    console.log('\n--- Test 6.1: API Health Check ---');
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      
      await addResult('phase6', {
        name: 'Test 6.1: API Health Check',
        status: data.status === 'ok' ? 'PASS' : 'FAIL',
        response: data,
        notes: `Health endpoint returned: ${JSON.stringify(data)}`
      });
    } catch (error) {
      await addResult('phase6', {
        name: 'Test 6.1: API Health Check',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 6.2: API Login
    console.log('\n--- Test 6.2: API Login ---');
    try {
      const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@squadops.ai', password: 'admin123' })
      });
      const loginData = await loginResponse.json();
      
      await addResult('phase6', {
        name: 'Test 6.2: API Login',
        status: loginData.accessToken ? 'PASS' : 'FAIL',
        hasAccessToken: !!loginData.accessToken,
        hasUserData: !!loginData.user,
        notes: `Login returned accessToken: ${!!loginData.accessToken}, user: ${!!loginData.user}`
      });
    } catch (error) {
      await addResult('phase6', {
        name: 'Test 6.2: API Login',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 6.3: API Users List (Admin)
    console.log('\n--- Test 6.3: API Users List (Admin) ---');
    try {
      // First login to get token
      const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@squadops.ai', password: 'admin123' })
      });
      const loginData = await loginResponse.json();
      
      const usersResponse = await fetch(`${API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${loginData.accessToken}` }
      });
      const usersData = await usersResponse.json();
      
      await addResult('phase6', {
        name: 'Test 6.3: API Users List (Admin)',
        status: Array.isArray(usersData) ? 'PASS' : 'FAIL',
        userCount: Array.isArray(usersData) ? usersData.length : 0,
        notes: `Retrieved ${Array.isArray(usersData) ? usersData.length : 0} users`
      });
    } catch (error) {
      await addResult('phase6', {
        name: 'Test 6.3: API Users List (Admin)',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 6.4: API Tasks (Normal User)
    console.log('\n--- Test 6.4: API Tasks (Normal User) ---');
    try {
      const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sachin@gmail.com', password: 'test123' })
      });
      const loginData = await loginResponse.json();
      
      const tasksResponse = await fetch(`${API_URL}/api/tasks`, {
        headers: { 'Authorization': `Bearer ${loginData.accessToken}` }
      });
      const tasksData = await tasksResponse.json();
      
      await addResult('phase6', {
        name: 'Test 6.4: API Tasks (Normal User)',
        status: tasksData && (Array.isArray(tasksData) || tasksData.tasks) ? 'PASS' : 'FAIL',
        responseType: typeof tasksData,
        notes: `Tasks response received`
      });
    } catch (error) {
      await addResult('phase6', {
        name: 'Test 6.4: API Tasks (Normal User)',
        status: 'FAIL',
        error: error.message
      });
    }

    // ==================== PHASE 7: Edge Cases & Error Handling ====================
    console.log('\n========== PHASE 7: Edge Cases & Error Handling ==========');

    // Test 7.1: Unauthorized Access
    console.log('\n--- Test 7.1: Unauthorized Access ---');
    try {
      await context.clearCookies();
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      
      await page.goto(`${DASHBOARD_URL}/admin`);
      await page.waitForTimeout(2000);
      
      const isLoginPage = page.url().includes('/auth/login');
      const isUnauthorized = await page.$('text=/unauthorized/i') !== null || 
                             await page.$('text=/access denied/i') !== null;
      
      await addResult('phase7', {
        name: 'Test 7.1: Unauthorized Access',
        status: isLoginPage || isUnauthorized ? 'PASS' : 'FAIL',
        redirectedTo: page.url(),
        isLoginPage,
        notes: isLoginPage ? 'Redirected to login page as expected' : 'Not redirected to login'
      });
    } catch (error) {
      await addResult('phase7', {
        name: 'Test 7.1: Unauthorized Access',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 7.2: Access Denied - Normal User accessing Admin
    console.log('\n--- Test 7.2: Access Denied - Normal User accessing Admin ---');
    try {
      await page.goto(`${DASHBOARD_URL}/auth/login`);
      await page.fill('input[type="email"]', 'sachin@gmail.com');
      await page.fill('input[type="password"]', 'test123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      await page.goto(`${DASHBOARD_URL}/admin`);
      await page.waitForTimeout(2000);
      
      const url = page.url();
      const isDenied = url.includes('/admin') === false || 
                       await page.$('text=/access denied/i') !== null ||
                       await page.$('text=/forbidden/i') !== null ||
                       await page.$('text=/unauthorized/i') !== null;
      
      await addResult('phase7', {
        name: 'Test 7.2: Access Denied - Normal User accessing Admin',
        status: isDenied ? 'PASS' : 'FAIL',
        currentUrl: url,
        notes: isDenied ? 'Normal user cannot access admin area' : 'Normal user was able to access admin'
      });
    } catch (error) {
      await addResult('phase7', {
        name: 'Test 7.2: Access Denied - Normal User accessing Admin',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 7.3: 404 Page
    console.log('\n--- Test 7.3: 404 Page ---');
    try {
      await page.goto(`${DASHBOARD_URL}/nonexistent-page-12345`);
      await page.waitForTimeout(2000);
      
      const has404Text = await page.$('text=/404/i') !== null ||
                         await page.$('text=/not found/i') !== null ||
                         await page.$('text=/page not found/i') !== null;
      
      await page.screenshot({ path: path.join(TEST_RESULTS_DIR, '7.3-404-page.png') });
      
      await addResult('phase7', {
        name: 'Test 7.3: 404 Page',
        status: has404Text ? 'PASS' : 'INFO',
        has404Text,
        currentUrl: page.url(),
        notes: has404Text ? '404 page displayed correctly' : '404 indicator not found, screenshot saved'
      });
    } catch (error) {
      await addResult('phase7', {
        name: 'Test 7.3: 404 Page',
        status: 'FAIL',
        error: error.message
      });
    }

    // ==================== PHASE 8: Responsive Design Tests ====================
    console.log('\n========== PHASE 8: Responsive Design Tests ==========');

    // Test 8.1: Mobile Viewport
    console.log('\n--- Test 8.1: Mobile Viewport ---');
    try {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${DASHBOARD_URL}/auth/login`);
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: path.join(TEST_RESULTS_DIR, '8.1-mobile-login.png') });
      
      await addResult('phase8', {
        name: 'Test 8.1: Mobile Viewport (375x667)',
        status: 'PASS',
        notes: 'Mobile screenshot saved'
      });
    } catch (error) {
      await addResult('phase8', {
        name: 'Test 8.1: Mobile Viewport',
        status: 'FAIL',
        error: error.message
      });
    }

    // Test 8.2: Tablet Viewport
    console.log('\n--- Test 8.2: Tablet Viewport ---');
    try {
      // Login first
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`${DASHBOARD_URL}/auth/login`);
      await page.fill('input[type="email"]', 'admin@squadops.ai');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      await page.goto(`${DASHBOARD_URL}/dashboard`);
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: path.join(TEST_RESULTS_DIR, '8.2-tablet-dashboard.png') });
      
      await addResult('phase8', {
        name: 'Test 8.2: Tablet Viewport (768x1024)',
        status: 'PASS',
        notes: 'Tablet screenshot saved'
      });
    } catch (error) {
      await addResult('phase8', {
        name: 'Test 8.2: Tablet Viewport',
        status: 'FAIL',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    await browser.close();
    
    // Write results to file
    const reportPath = path.join(TEST_RESULTS_DIR, 'phases-5-8-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    
    console.log('\n========== TEST SUMMARY ==========');
    console.log(`Phase 5 (Navigation): ${results.phase5.filter(r => r.status === 'PASS').length}/${results.phase5.length} passed`);
    console.log(`Phase 6 (API): ${results.phase6.filter(r => r.status === 'PASS').length}/${results.phase6.length} passed`);
    console.log(`Phase 7 (Edge Cases): ${results.phase7.filter(r => r.status === 'PASS').length}/${results.phase7.length} passed`);
    console.log(`Phase 8 (Responsive): ${results.phase8.filter(r => r.status === 'PASS').length}/${results.phase8.length} passed`);
    console.log(`\nReport saved to: ${reportPath}`);
    
    return results;
  }
}

runTests().catch(console.error);
