const puppeteer = require('puppeteer');

(async () => {
  const routes = [
    '/admin/model/dashboard',
    '/admin/model/calculator',
    '/admin/model/portafolio',
    '/admin/model/finanzas/ahorro',
    '/admin/model/anticipos'
  ];

  const viewports = [
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Mobile', width: 375, height: 812, isMobile: true }
  ];

  const allLogs = [];

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Mock user for localStorage
  const mockUser = {
    id: '0976437e-15e6-424d-8122-afb65580239a', // A valid UUID just in case
    email: 'test@model.com',
    name: 'Test Model',
    role: 'modelo',
    organization_id: '123',
    is_active: true
  };

  // Navigate to index first to set localStorage
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate((user) => {
    localStorage.setItem('user', JSON.stringify(user));
  }, mockUser);

  for (const viewport of viewports) {
    await page.setViewport(viewport);

    for (const route of routes) {
      console.log(`\nTesting ${route} on ${viewport.name}...`);
      
      const currentLogs = [];
      
      page.on('console', msg => {
        const type = msg.type();
        if (['error', 'warning', 'warn'].includes(type) || type === 'log') {
          currentLogs.push({ type, text: msg.text() });
        }
      });

      page.on('pageerror', err => {
        currentLogs.push({ type: 'pageerror', text: err.toString() });
      });

      try {
        await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle2', timeout: 15000 });
        
        // Wait an extra second for any client-side rendering/hydration errors
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (err) {
        currentLogs.push({ type: 'pageerror', text: `Navigation failed: ${err.message}` });
      }

      // Remove listeners for the next route
      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');

      allLogs.push({
        route,
        viewport: viewport.name,
        logs: currentLogs
      });
    }
  }

  await browser.close();

  console.log('\n\n--- FINAL REPORT ---');
  console.log(JSON.stringify(allLogs, null, 2));

})();
