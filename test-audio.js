const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    
    // Trigger interaction
    await page.mouse.click(100, 100);
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
  } catch (err) {
    console.error("Puppeteer Error:", err);
  }
})();
