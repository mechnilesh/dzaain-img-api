const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST method' });
  }

  const { html, width = 1080, height = 1350, quality = 90 } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'html field is required' });
  }

  let browser = null;

  try {
    const executablePath = await chromium.executablePath();

    // Set LD_LIBRARY_PATH to help find shared libraries
    const execDir = require('path').dirname(executablePath);
    process.env.LD_LIBRARY_PATH = [
      execDir,
      process.env.LD_LIBRARY_PATH
    ].filter(Boolean).join(':');

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ],
      defaultViewport: {
        width: parseInt(width),
        height: parseInt(height),
        deviceScaleFactor: 1
      },
      executablePath: executablePath,
      headless: true
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: parseInt(width),
      height: parseInt(height),
      deviceScaleFactor: 1
    });

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 25000
    });

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

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'inline; filename="dzaain.jpg"');
    res.send(screenshot);

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) {
      try { await browser.close(); } catch(e) {}
    }
  }
};
