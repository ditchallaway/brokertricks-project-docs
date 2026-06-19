const fs = require('fs/promises');
const { existsSync } = require('fs');
const path = require('path');
const sharp = require('sharp');
const TEST_PAYLOAD = {
    "ap_parcel_number": "RP58N01W327600A",
    "centroid": [-116.4869477327835, 48.33225928561425],
    "ll_gisacre": 6.1944,
    "geometry": {
        "type": "Polygon",
        "coordinates": [
            [[-116.4868255, 48.3317135], [-116.485553, 48.3317135], [-116.4855585, 48.332807], [-116.488335, 48.3328055], [-116.488341, 48.332094], [-116.4883485, 48.3317135], [-116.4868255, 48.3317135]],
            [[-116.487000, 48.332000], [-116.487000, 48.332200], [-116.487500, 48.332200], [-116.487500, 48.332000], [-116.487000, 48.332000]]
        ]
    },
    "elevation": 655,
    "centroid_elevation": 655,
    "customer_id": "test_cardinal",
    "order_id": "test",
    "shots": ["cardinal"],
    "is_test": true // Ensure output goes to test-results/
};

console.log("\n🚀 Cardinal Test (Puppeteer E2E & Visual Regression)");

async function run() {
    const startTime = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 600000);

        console.log(`\n📋 Test Payload: ${JSON.stringify(TEST_PAYLOAD, null, 2)}`);
        console.log(`🔗 Target: http://localhost:9876/render`);
        console.log("📍 Sending render request (Mocking JSON Payload)...");

        const fetchStart = Date.now();
        const response = await fetch('http://localhost:9876/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_PAYLOAD),
            signal: controller.signal
        });
        clearTimeout(timeout);

        const fetchDuration = ((Date.now() - fetchStart) / 1000).toFixed(1);
        console.log(`⏱️  Request took ${fetchDuration}s (Status: ${response.status})`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API failed with ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log("✅ Render complete!");
        console.log(`📦 Response Summary:`, JSON.stringify(result, null, 2));

        const bgPath = result.png_path;
        if (!bgPath) throw new Error("Missing 'png_path' in response");

        console.log(`📄 Checking output at: ${bgPath}`);

        // ── 1. WebGL Context Loss Validation (Black Screen Check) ──
        console.log("🔍 Validating WebGL Context (Black Screen detection)...");
        const analysisStart = Date.now();
        const bgBuffer = await fs.readFile(bgPath);
        const image = sharp(bgBuffer);
        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
        console.log(`🖼️  Image loaded: ${info.width}x${info.height}, ${info.channels} channels`);

        let blackPixels = 0;
        const totalPixels = info.width * info.height;
        for (let i = 0; i < data.length; i += info.channels) {
            if (data[i] <= 30 && data[i + 1] <= 30 && data[i + 2] <= 30) {
                blackPixels++;
            }
        }
        const blackPct = blackPixels / totalPixels;
        if (blackPct > 0.95) {
            throw new Error(`❌ WebGL Context Loss: Screenshot is >95% black (${(blackPct * 100).toFixed(1)}%). Cesium tiles likely failed to load.`);
        }
        console.log(`✅ WebGL OK: Frame is ${(100 - blackPct * 100).toFixed(1)}% visible (${blackPixels} black pixels / ${totalPixels} total).`);

        // ── 2. Dynamic Visual Assertions ──
        console.log("📸 Running Dynamic Visual Validation (Sky, Boundaries, Terrain)...");

        let daylightSkyPixels = 0;
        let yellowBoundaryPixels = 0;
        const colorSet = new Set();

        const top15PercentRows = Math.floor(info.height * 0.15);
        const bottomHalfStart = Math.floor(info.height * 0.50);

        for (let y = 0; y < info.height; y++) {
            for (let x = 0; x < info.width; x++) {
                const idx = (y * info.width + x) * info.channels;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // Sky Check (Top 15%): Ensure it's not the void of space or night
                if (y < top15PercentRows) {
                    const isBright = (r + g + b) / 3 > 80;
                    const isBlue = (b > r + 10 && b > g + 10);
                    if (isBright || isBlue) {
                        daylightSkyPixels++;
                    }
                }

                // Boundary Line Check (Yellow: R > 200, G > 200, B < 100)
                if (r > 200 && g > 200 && b < 100) {
                    yellowBoundaryPixels++;
                }

                // Terrain Variance Check (Bottom half)
                if (y > bottomHalfStart) {
                    const rgbString = `${Math.floor(r / 8)},${Math.floor(g / 8)},${Math.floor(b / 8)}`;
                    colorSet.add(rgbString);
                }
            }
        }

        const top15TotalPixels = info.width * top15PercentRows;
        const daylightSkyPct = daylightSkyPixels / top15TotalPixels;
        const analysisDuration = ((Date.now() - analysisStart) / 1000).toFixed(1);

        console.log(`☀️  Daylight Sky/Fog Pixels: ${daylightSkyPixels} (${(daylightSkyPct * 100).toFixed(1)}% of top 15%)`);
        console.log(`🟨 Yellow Boundary Pixels: ${yellowBoundaryPixels}`);
        console.log(`🌍 Terrain Unique Colors: ${colorSet.size}`);
        console.log(`⏱️  Visual analysis took ${analysisDuration}s`);

        if (daylightSkyPct < 0.05) {
            throw new Error(`❌ Dynamic Validation Failed: Top region is too dark (Likely Space or Night).`);
        }

        if (yellowBoundaryPixels < 100) {
            throw new Error(`❌ Dynamic Validation Failed: Missing Boundary Lines.`);
        }

        if (colorSet.size < 1000) {
            throw new Error(`❌ Dynamic Validation Failed: Low terrain variance (${colorSet.size} colors). Empty map tile?`);
        }

        console.log("\n======================================================");
        console.log(`🖼️  VIEW RESULT: file://${path.resolve(bgPath).replace(/\\/g, '/')}`);
        console.log("======================================================\n");
        console.log("✅ Dynamic Image Validation Passed.");
        console.log("✅ Render and PNG generation verified successfully.");

        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`🏁 Total Test Execution Time: ${totalDuration}s`);

    } catch (error) {
        console.error("\n❌ TEST FAILED:");
        console.error(error.message || error);
        process.exit(1);
    }
}

run();
