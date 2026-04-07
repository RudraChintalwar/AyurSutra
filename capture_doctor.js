const puppeteer = require('puppeteer');

(async () => {
    console.log('Launching browser for Doctor phase...');
    let browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    let page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const captureHelper = async (url, fName) => {
        console.log('Capturing ' + url + '...');
        await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(console.error);
        await new Promise(r => setTimeout(r, 4000));
        await page.screenshot({ path: `ReportData/${fName}.png` });
    };

    await captureHelper('http://localhost:5173/doctor-dashboard', 'doctor_dashboard');

    await browser.close();
    console.log("Doctor screenshots captured.");
})();
