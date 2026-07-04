import puppeteer from 'puppeteer';

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));
  
  console.log("Navigating to localhost:5174...");
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  
  console.log("Waiting 3 seconds...");
  await new Promise(r => setTimeout(r, 3000));
  
  // Click Next a few times to get past the tutorial
  try {
    for(let i=0; i<4; i++) {
        await page.click('#tutorial-next');
        await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    console.error("Could not click next:", e.message);
  }

  console.log("Waiting 5 seconds for DEMO to run...");
  console.log("Waiting 5 seconds for DEMO to run...");
  for (let i = 0; i < 8; i++) {
    const pos = await page.evaluate(() => {
      // Find tractor visually if it's drawn, but actually it's easier:
      // Can we access window.__GAME_INSTANCE__?
      // Since it's not exported, let's just observe the console.
      return 'running';
    });
    console.log(`Sec ${i}: ${pos}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await page.screenshot({path: 'debug_screen1.jpg'});
  
  try {
      console.log("Clicking Assume Control...");
      await page.click('#btn-take-control');
  } catch(e) {
      console.error("Could not click take control:", e.message);
  }
  
  console.log("Waiting 2 seconds...");
  await new Promise(r => setTimeout(r, 2000));
  
  // Try to press 'W'
  await page.keyboard.press('KeyW');
  await new Promise(r => setTimeout(r, 1000));
  
  await page.screenshot({path: 'debug_screen2.jpg'});
  console.log("Saved screenshots");
  
  await browser.close();
})();
