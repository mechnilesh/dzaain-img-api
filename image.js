const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

module.exports = async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST method' });
  }

  const { html, width = 1080, height = 1350, quality = 90 } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'html field is required' });
  }

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: parseInt(width),
        height: parseInt(height),
        deviceScaleFactor: 1
      },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: parseInt(width),
      height: parseInt(height),
      deviceScaleFactor: 1
    });

    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded']
    });

    // Wait for Google Fonts to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: parseInt(quality),
      clip: {
        x: 0,
        y: 0,
        width: parseInt(width),
        height: parseInt(height)
      }
    });

    await browser.close();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline; filename="dzaain.jpg"');
    res.send(screenshot);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
