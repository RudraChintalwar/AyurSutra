const puppeteer = require('puppeteer');

(async () => {
    console.log('Launching browser for Patient phase...');
    let browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    let page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const navigateSPA = async (url) => {
        console.log(`Navigating SPA to ${url}...`);
        await page.evaluate((path) => {
            window.history.pushState({}, '', path);
            window.dispatchEvent(new Event('popstate'));
        }, url);
        await new Promise(r => setTimeout(r, 4000));
    };

    console.log('Capturing Emart...');
    await page.goto('http://localhost:5173/emart', { waitUntil: 'domcontentloaded' }).catch(console.error);
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: 'ReportData/emart.png' });

    console.log('Logging in as Test Patient...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' }).catch(console.error);
    
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Test Patient'));
        if (btn) btn.click();
    });

    console.log('Waiting for patient dashboard to sync...');
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: 'ReportData/patient_dashboard.png' });
    
    await navigateSPA('/patient/sessions');
    await page.screenshot({ path: 'ReportData/scheduling_wizard.png' });

    await navigateSPA('/report-analyzer');
    await page.screenshot({ path: 'ReportData/report_analyzer.png' });

    await navigateSPA('/diet-plan');
    await page.screenshot({ path: 'ReportData/diet_plan.png' });

    await navigateSPA('/pulse-monitor');
    await page.screenshot({ path: 'ReportData/pulse_monitor.png' });

    await navigateSPA('/medicine-verifier');
    await page.screenshot({ path: 'ReportData/medicine_verifier.png' });
    
    await browser.close();

    console.log('Launching browser for Doctor phase...');
    browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log('Logging in as Test Doctor...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' }).catch(console.error);
    
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Test Doctor'));
        if (btn) btn.click();
    });

    console.log('Waiting for doctor dashboard to sync...');
    await new Promise(r => setTimeout(r, 4000));
    await page.screenshot({ path: 'ReportData/doctor_dashboard.png' });

    await browser.close();
    console.log('All screenshots captured seamlessly!');
})();
