const puppeteer = require('puppeteer-core');
const express = require('express');
const http = require('http');
const path = require('path');

async function testcesium() {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: 'new',
        args: [
            '--no-sandbox', '--disable-dev-shm-usage',
            '--use-gl=angle', '--use-angle=swiftshader'
        ]
    });
    const page = await browser.newPage();
    const app = express();
    app.use('/cesium', express.static(path.join(process.cwd(), 'public/cesium')));
    const htmlContent = `
    <html><head><script src="/cesium/Cesium.js"></script><link href="/cesium/Widgets/widgets.css" rel="stylesheet"></head>
    <body><div id="cesiumContainer"></div>
    <script>
        const viewer = new Cesium.Viewer('cesiumContainer', {
            contextOptions: { webgl: { preserveDrawingBuffer: true } },
            baseLayer: false,
            baseLayerPicker: false
        });
        window.viewer = viewer;
        
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(-122.4, 37.8, 1000)
        });
    </script></body></html>
    `;
    app.get('/', (req, res) => { res.send(htmlContent); });
    const server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.viewer !== undefined);
    
    for(let i=0; i<20; i++) {
        const status = await page.evaluate(() => {
            window.viewer.scene.render();
            return window.viewer.scene.globe.tilesLoaded;
        });
        console.log("Check " + i + ": GlobeLoaded=" + status);
        if (status) break;
        await new Promise(r => setTimeout(r, 500));
    }
    await browser.close();
    server.close();
}
testcesium().catch(console.error);
