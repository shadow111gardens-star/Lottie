import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('artifacts/responsive/sections',{recursive:true});
for(const [width,height] of [[320,740],[768,1024],[1440,900]]) {
 const page=await browser.newPage({viewport:{width,height}});
 await page.goto('http://127.0.0.1:5173');await page.waitForTimeout(4500);
 const sections=page.locator('section');
 for(let i=0;i<await sections.count();i++) {
  await sections.nth(i).scrollIntoViewIfNeeded();await page.waitForTimeout(800);
  await page.screenshot({path:`artifacts/responsive/sections/${width}-${i}.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 console.log(`PASS Every landing section scrolled and captured at ${width}x${height}`);
 await page.close();
}
await browser.close();
