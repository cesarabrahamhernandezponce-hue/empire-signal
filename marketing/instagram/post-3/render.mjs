import pw from 'file:///home/cesar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';
const { chromium } = pw;
const dir = process.cwd();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
for (let s = 1; s <= 5; s++) {
  await page.goto(`file://${dir}/about.html?s=${s}`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/empire-ig-about-slide${s}.png`, clip: { x: 0, y: 0, width: 1080, height: 1080 } });
  console.log('slide', s, 'done');
}
await browser.close();
