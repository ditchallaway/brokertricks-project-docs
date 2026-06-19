const puppeteer = require('puppeteer-core');
const config = require('../src/config');
(async () => {
    const browser = await puppeteer.launch({
        executablePath: config.PUPPETEER_EXECUTABLE_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader']
    });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    const html = `
    <html><head><script src="file://${process.cwd()}/public/cesium/Cesium.js"></script></head>
    <body>
    <div id="cesiumContainer"></div>
    <script>
        try {
            const container = document.getElementById("cesiumContainer");
            const viewer = new Cesium.Viewer(container, {
                contextOptions: { webgl: { preserveDrawingBuffer: true } },
                animation: false, timeline: false, navigationHelpButton: false, homeButton: false, sceneModePicker: false, baseLayerPicker: false, geocoder: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
                globe: true, skyAtmosphere: true,
                // creditContainer: document.createElement("div") // Try commenting this out!
            });
            console.log("SUCCESS");
        } catch(e) { console.error("CRASH:", e); }
    </script>
    </body></html>`;
    await page.setContent(html);
    await browser.close();
})();
