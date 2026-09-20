import puppeteer from 'puppeteer-core';

const exe = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();

const logs = [];
page.on('console', (msg) => logs.push(`[console.${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}\n${err.stack || ''}`));
page.on('requestfailed', (req) => logs.push(`[requestfailed] ${req.url()} -> ${req.failure()?.errorText}`));

const url = process.env.CHECK_URL || 'http://localhost:3000/';
try {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  const htmlLen = await page.evaluate(() => document.documentElement.outerHTML.length);
  const hasMain = await page.evaluate(() => !!document.querySelector('main'));
  console.log('TITLE:', await page.title());
  console.log('HTML_LEN:', htmlLen);
  console.log('HAS_MAIN:', hasMain);
  console.log('BODY_TEXT:', JSON.stringify(bodyText));
} catch (e) {
  console.log('GOTO_ERROR:', e.message);
}
console.log('--- LOGS ---');
console.log(logs.join('\n') || '(no console/page errors)');
await browser.close();
