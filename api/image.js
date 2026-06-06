const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const crypto = require('crypto');

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
    const execDir = require('path').dirname(executablePath);
    process.env.LD_LIBRARY_PATH = [execDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

    browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--no-zygote'],
      defaultViewport: { width: parseInt(width), height: parseInt(height), deviceScaleFactor: 1 },
      executablePath,
      headless: true
    });

    const page = await browser.newPage();
    await page.setViewport({ width: parseInt(width), height: parseInt(height), deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 25000 });
    await new Promise(r => setTimeout(r, 2000));

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: parseInt(quality),
      clip: { x: 0, y: 0, width: parseInt(width), height: parseInt(height) }
    });

    await browser.close();
    browser = null;

    // Upload to Cloudinary via signed API
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'dzaain';
    const signStr = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha256').update(signStr).digest('hex');

    // Build multipart body manually
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const CRLF = '\r\n';

    const addField = (name, value) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

    let bodyStr = '';
    bodyStr += addField('api_key', process.env.CLOUDINARY_API_KEY);
    bodyStr += addField('timestamp', timestamp.toString());
    bodyStr += addField('folder', folder);
    bodyStr += addField('signature', signature);

    const fileHeader = `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="dzaain.jpg"${CRLF}Content-Type: image/jpeg${CRLF}${CRLF}`;
    const fileFooter = `${CRLF}--${boundary}--${CRLF}`;

    const headerBuf = Buffer.from(bodyStr + fileHeader, 'utf-8');
    const footerBuf = Buffer.from(fileFooter, 'utf-8');
    const body = Buffer.concat([headerBuf, screenshot, footerBuf]);

    const cloudUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;

    const uploadRes = await fetch(cloudUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      },
      body
    });

    const data = await uploadRes.json();

    if (!data.secure_url) {
      throw new Error('Cloudinary failed: ' + JSON.stringify(data));
    }

    res.status(200).json({ url: data.secure_url });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) try { await browser.close(); } catch(e) {}
  }
};
