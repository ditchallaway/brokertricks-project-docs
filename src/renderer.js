const puppeteer = require('puppeteer-core');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const config = require('./config');

/**
 * Black-frame detection using pixel density analysis
 * Returns true if >95% of pixels are black (silent render crash indicator)
 */
async function detectBlackFrame(pngBuffer, threshold = config.BLACK_FRAME_THRESHOLD) {
    const sharp = require('sharp');
    try {
        const metadata = await sharp(pngBuffer).metadata();
        const { width, height } = metadata;
        const raw = await sharp(pngBuffer)
            .ensureAlpha()
            .raw()
            .toBuffer();

        let blackPixels = 0;
        const pixelLength = 4; // RGBA
        const totalPixels = width * height;

        for (let i = 0; i < raw.length; i += pixelLength) {
            const r = raw[i];
            const g = raw[i + 1];
            const b = raw[i + 2];
            // Consider pixel black if all channels < 10 (near-black due to compression)
            if (r < 10 && g < 10 && b < 10) {
                blackPixels++;
            }
        }

        const blackRatio = blackPixels / totalPixels;
        console.log(`[Black Frame Check] Black ratio: ${(blackRatio * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`);
        
        return blackRatio >= threshold;
    } catch (err) {
        console.error('[Black Frame Check] Error analyzing frame:', err.message);
        return true; // Crash-safety: assume black/failed render if analysis fails
    }
}

/**
 * Launch Puppeteer with WebGL-optimized flags
 */
async function launchBrowser() {
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-gpu-sandbox',
        '--allow-file-access-from-files'
    ];

    console.log(`[Browser] Launching Puppeteer with args: ${args.join(' ')}`);
    const browser = await puppeteer.launch({
        executablePath: config.PUPPETEER_EXECUTABLE_PATH,
        headless: 'new',
        args,
        defaultViewport: null,
        timeout: 60000
    });
    console.log(`[Browser] Launched successfully (PID: ${browser.process()?.pid || 'unknown'})`);

    return browser;
}

/**
 * Render a property photo
 * @param {Object} job - Render job specification
 * @param {Function} onProgress - Progress callback (percent, status)
 * @param {Object} options - Render options (fast: boolean)
 */
// Fixed internal port for the per-job Cesium asset server.
// Safe to reuse because jobs run sequentially (conserve.md).
const ASSET_SERVER_PORT = 9877;
const SHOTS = Object.freeze([
    { id: 'overhead', heading: 0,   pitch: -89.9, finalSSE: 1, rangeFactor: 2.0 },
    { id: 'north',    heading: 0,   pitch: -35,   finalSSE: 4, rangeFactor: 2.5 },
    { id: 'east',     heading: 90,  pitch: -35,   finalSSE: 4, rangeFactor: 2.5 },
    { id: 'south',    heading: 180, pitch: -35,   finalSSE: 4, rangeFactor: 2.5 },
    { id: 'west',     heading: 270, pitch: -35,   finalSSE: 4, rangeFactor: 2.5 }
]);

function resolveSnapshotMode(snapshotMode = process.env.SNAPSHOT_MODE) {
    const normalizedMode = String(snapshotMode || '').trim().toLowerCase();

    if (normalizedMode === 'overhead_only' || normalizedMode === 'overhead_north') {
        return normalizedMode;
    }

    return 'all';
}

function getShotsForSnapshotMode(snapshotMode = process.env.SNAPSHOT_MODE) {
    const mode = resolveSnapshotMode(snapshotMode);

    if (mode === 'overhead_only') {
        return SHOTS.slice(0, 1);
    }

    if (mode === 'overhead_north') {
        return SHOTS.slice(0, 2);
    }

    return SHOTS;
}

async function renderPropertyPhoto(job, onProgress = () => {}, options = {}) {
    const { centroid, elevation, boundaryOuter, acreage } = job;
    
    if (!centroid || !Number.isFinite(centroid.lon) || !Number.isFinite(centroid.lat)) {
        throw new Error('Invalid centroid: requires { lon, lat } with finite numeric values');
    }
    if (!boundaryOuter || !Array.isArray(boundaryOuter)) {
        throw new Error('Invalid boundary: requires polygon outer ring');
    }

    let browser;
    let server;
    // Track every socket the asset server opens so we can force-close them
    // if the job times out or fails (preventing server.close() hang).
    const openSockets = new Set();

    /**
     * Forcefully tears down the asset server and browser.
     * Destroys all tracked sockets so server.close() resolves immediately
     * rather than waiting for Puppeteer's keep-alive connections to drain.
     */
    async function cleanup() {
        if (browser) {
            await browser.close().catch(() => {});
            browser = null;
        }
        if (server) {
            for (const socket of openSockets) {
                socket.destroy();
            }
            openSockets.clear();
            await new Promise(resolve => server.close(resolve));
            server = null;
        }
    }

    try {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Render job timed out after ' + (config.RENDER_TIMEOUT_MS / 1000) + 's'));
            }, config.RENDER_TIMEOUT_MS);
        });

        const renderTask = (async function() {
            const jobStart = Date.now();
            const elapsed = () => ((Date.now() - jobStart) / 1000).toFixed(1) + 's';

            onProgress(0, 'Launching browser...');
            browser = await launchBrowser();
            const page = await browser.newPage();
            onProgress(5, 'Browser page created');
            console.log(`[Renderer] [${elapsed()}] Browser launched, page created`);
            // Start at a tiny viewport for tile loading — SwiftShader renders
            // every frame in software, so 512×384 (1/16th of output) makes each
            // scene.render() in the polling loop ~16× faster. We resize to the
            // full 2048×1536 output resolution only before taking the screenshot.
            await page.setViewport({ width: 512, height: 384 });

            // Serve the static render HTML and all assets in the public directory.
            // This includes app.js, config.js, and Cesium library assets.
            // Uses a fixed port (ASSET_SERVER_PORT) so no new OS port is allocated per job.
            const assetApp = express();
            
            // Allow the job data to be fetched by the browser app
            assetApp.get('/api/job', (req, res) => {
                res.json({
                    job,
                    googleApiKey: (process.env.GOOGLE_API_KEY || '').trim(),
                    baseLayerProvider: config.BASE_LAYER_PROVIDER,
                    azureMapsKey: (config.AZURE_MAPS_KEY || '').trim(),
                    cesiumIonToken: (config.CESIUM_ION_TOKEN || '').trim()
                });
            });

            // Serve the public folder (index.html, app.js, config.js, etc.)
            const publicPath = path.join(process.cwd(), 'public');
            assetApp.use(express.static(publicPath));
            
            // Alias render.html to index.html for backward compatibility if needed,
            // or just rely on index.html being served at root /
            assetApp.get('/render.html', (req, res) => {
                res.sendFile(path.join(publicPath, 'index.html'));
            });

            server = http.createServer(assetApp);

            // Track connections for force-close on cleanup
            server.on('connection', socket => {
                openSockets.add(socket);
                socket.once('close', () => openSockets.delete(socket));
            });

            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(ASSET_SERVER_PORT, '127.0.0.1', resolve);
            });
            const port = server.address().port;
            console.log(`[Renderer] Serving render HTML on http://127.0.0.1:${port}/render.html`);

            page.on('console', msg => console.log('[Puppeteer Console]', msg.type(), msg.text()));
            page.on('pageerror', err => console.error('[Puppeteer Error]', err.message));
            page.on('requestfailed', request => console.warn('[Puppeteer Request Failed]', request.url(), request.failure()?.errorText));
            page.on('response', response => {
                if (response.status() >= 400) {
                    console.error('[Puppeteer HTTP Error]', response.status(), response.url());
                }
            });

            console.log(`[Renderer] [${elapsed()}] Navigating to http://127.0.0.1:${port}/render.html`);
            onProgress(10, 'Navigating to renderer...');
            await page.goto(`http://127.0.0.1:${port}/render.html`, { waitUntil: 'domcontentloaded' });
            console.log(`[Renderer] [${elapsed()}] Navigation complete, waiting for viewer...`);
            onProgress(15, 'Waiting for Cesium initialization...');
            await page.waitForFunction(function() { return window.viewer !== undefined; }, { timeout: 60000 });
            console.log(`[Renderer] [${elapsed()}] Viewer initialized`);
            onProgress(20, 'Cesium initialized');

            // finalSSE = the lowest SSE we'll demand for that shot.
            // Cardinal shots only need SSE=4 — background terrain at the horizon
            // doesn't need to be pixel-perfect, and demanding SSE=1 triggers
            // hundreds of tile requests that overwhelm SwiftShader.
            // The overhead shot is the hero close-up, so it gets full SSE=1 quality.
            //
            // Nadir is rendered FIRST to warm the tile cache — its top-down view
            // loads the property's core tiles which the cardinal shots also need.
            const snapshotMode = resolveSnapshotMode();
            const shots = getShotsForSnapshotMode(snapshotMode);
            console.log(`[Renderer] Snapshot mode: ${snapshotMode} (${shots.length} shot${shots.length === 1 ? '' : 's'})`);

            const results = [];
            let shotIndex = 0;
            for (const shot of shots) {
                shotIndex++;
                const progressBase = 20 + (shotIndex - 1) * (70 / shots.length);
                onProgress(progressBase, `Rendering shot: ${shot.id} (${shotIndex}/${shots.length})`);
                
                console.log(`[Renderer] [${elapsed()}] === Shot: ${shot.id} (heading: ${shot.heading}°, pitch: ${shot.pitch}°, finalSSE: ${shot.finalSSE}) ===`);
                const shotStart = Date.now();
                
                // Always start coarse (SSE=16) to avoid flooding SwiftShader with
                // max-detail tile requests. --fast skips the SSE=4 intermediate
                // step (16→1) instead of starting at SSE=1 directly, which was
                // causing mass ERR_ABORTED tile cancellations.
                let targetSSE = 16.0;
                await page.evaluate(function(shot, initialSSE) {
                    const h = window.Cesium.Math.toRadians(shot.heading);
                    const p = window.Cesium.Math.toRadians(shot.pitch);
                    const range = window.boundingSphere.radius * shot.rangeFactor;
                    
                    // Set SSE to target initially
                    if (window.tileset) {
                        window.tileset.maximumScreenSpaceError = initialSSE;
                        window.tileset.cacheBytes = 1073741824; 
                    }
                    window.viewer.scene.globe.maximumScreenSpaceError = initialSSE;

                    // Use flyToBoundingSphere for orbital framing (keeps property centered)
                    window.viewer.camera.flyToBoundingSphere(window.boundingSphere, {
                        offset: new window.Cesium.HeadingPitchRange(h, p, range),
                        duration: 0
                    });
                }, shot, targetSSE);

                // Wait for tiles to stabilize using incremental SSE refinement.
                // Steps: 16 → [4 if not fast] → shot.finalSSE
                // Cardinal shots stop at SSE=4; nadir goes all the way to SSE=1.
                let stable = 0;
                let nearlyReady = 0;
                let checks = 0;
                // Poll every 300ms to ensure stability (3 ticks = 900ms)
                const POLL_MS = 300;
                const maxChecks = config.RENDER_TIMEOUT_MS / POLL_MS;
                const finalSSE = shot.finalSSE;

                while (checks < maxChecks) {
                    const status = await page.evaluate(function(currentSSE) {
                        window.viewer.scene.render();
                        
                        // Apply quality SSE to tileset and globe throughout — ensures
                        // what stabilises is exactly what gets captured.
                        if (window.tileset) window.tileset.maximumScreenSpaceError = currentSSE;
                        window.viewer.scene.globe.maximumScreenSpaceError = 1.0;

                        // Provider-aware tile readiness check:
                        // - google-3d: gate on the 3D tileset primitive (globe imagery is invisible)
                        // - azure-maps: gate on globe tile loading (no 3D tileset exists)
                        var tsLoaded;
                        if (window.tileset) {
                            tsLoaded = !!window.tileset.tilesLoaded;
                        } else {
                            tsLoaded = !!window.viewer.scene.globe.tilesLoaded;
                        }
                        
                        return { tsLoaded: tsLoaded };
                    }, targetSSE);

                    checks++;

                    if (status.tsLoaded) {
                        if (targetSSE > finalSSE) {
                            // Step down SSE toward finalSSE.
                            // Normal: 16 → 4 → finalSSE. Fast: skip the 4 step.
                            const nextSSE = (targetSSE > 4.0 && !options.fast) ? 4.0 : finalSSE;
                            console.log(`[Renderer] Tiles loaded at SSE ${targetSSE}. Refining to SSE ${nextSSE}...`);
                            targetSSE = nextSSE;
                            stable = 0;
                        } else {
                            stable++;
                            // Wait for 3 stable ticks (900ms) per project rules
                            if (stable >= 3) {
                                console.log(`[Renderer] Tiles stable at SSE ${finalSSE} for 3 ticks. Ready for capture (shot: ${shot.id}).`);
                                break;
                            }
                        }
                    } else {
                        stable = 0;
                        nearlyReady++;
                    }

                    // Fallback: if the tileset is stubborn after 60 checks (18s), proceed anyway
                    if (nearlyReady > 60) { 
                        console.log('[Renderer] Tile loading stalled at SSE ' + targetSSE + '. Proceeding with fallback.');
                        break;
                    }

                    if (checks % 20 === 0) {
                        const intraShotProgress = Math.min(95, (checks / 200) * 100);
                        onProgress(progressBase + (intraShotProgress * 0.1), `Loading tiles for ${shot.id}... (${checks} checks)`);
                        console.log(`[Renderer] Waiting... (SSE:${targetSSE}, TS:${status.tsLoaded}, Nearly:${nearlyReady}/30, check:${checks})`);
                    }

                    await new Promise(r => setTimeout(r, POLL_MS));
                }


                if (checks >= maxChecks) {
                    throw new Error('Tile loading timeout exceeded (600s)');
                }

                const waitMs = Date.now() - shotStart;
                console.log(`[Renderer] [${elapsed()}] Tile wait done for ${shot.id} (${(waitMs/1000).toFixed(1)}s, ${checks} checks)`);

                // Resize to full output resolution before capturing the screenshot.
                // The tile loading was done at 512×384 to keep scene.render() fast.
                const resizeStart = Date.now();
                await page.setViewport({ width: 2048, height: 1536 });
                // Force one full-res render so Cesium updates the framebuffer at output size
                await page.evaluate(function() { window.viewer.scene.render(); });
                console.log(`[Renderer] [${elapsed()}] Viewport resized to 2048×1536 (${((Date.now()-resizeStart)/1000).toFixed(1)}s)`);

                const ssStart = Date.now();
                const buffer = await page.screenshot({ type: 'png' });
                console.log(`[Renderer] [${elapsed()}] Screenshot captured for ${shot.id} (${((Date.now()-ssStart)/1000).toFixed(1)}s, ${(buffer.length/1024).toFixed(0)}KB)`);

                // Shrink back down for the next shot's tile loading loop
                await page.setViewport({ width: 512, height: 384 });

                if (options.skipValidation) {
                    console.log(`[Renderer] [${elapsed()}] Validation skipped for ${shot.id} (--no-validate)`);
                } else {
                    const bfStart = Date.now();
                    onProgress(progressBase + (70 / shots.length * 0.8), `Validating shot: ${shot.id}`);
                    const isBlack = await detectBlackFrame(buffer);
                    console.log(`[Renderer] [${elapsed()}] Black-frame check for ${shot.id} (${((Date.now()-bfStart)/1000).toFixed(1)}s)`);
                    if (isBlack) throw new Error('Black-frame detected on shot ' + shot.id);
                }

                const totalShotMs = Date.now() - shotStart;
                console.log(`[Renderer] [${elapsed()}] Shot ${shot.id} TOTAL: ${(totalShotMs/1000).toFixed(1)}s`);

                results.push({ id: shot.id, pngBuffer: buffer, heading: shot.heading, pitch: shot.pitch });
                onProgress(progressBase + (70 / shots.length * 0.95), `Shot completed: ${shot.id}`);
            }

            onProgress(90, 'Finalizing results...');

            // Fetch reference map from srcmap URL if provided
            if (job.srcmap) {
                console.log(`[Renderer] Fetching reference srcmap from: ${job.srcmap}`);
                try {
                    const response = await fetch(job.srcmap);
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        results.push({
                            id: 'reference_overhead',
                            pngBuffer: Buffer.from(arrayBuffer),
                            isReference: true
                        });
                        console.log(`[Renderer] Reference srcmap downloaded successfully`);
                    } else {
                        console.warn(`[Renderer] Failed to fetch srcmap: ${response.status} ${response.statusText}`);
                    }
                } catch (e) {
                    console.error(`[Renderer] Error fetching srcmap: ${e.message}`);
                }
            }

            onProgress(100, 'Render complete');
            return {
                shots: results,
                metadata: { 
                    order_id: job.order_id || null,
                    customer_id: job.customer_id || null,
                    width: 2048, 
                    height: 1536, 
                    centroid, 
                    elevation, 
                    acreage, 
                    timestamp: new Date().toISOString(),
                    has_reference: results.some(r => r.id === 'reference_overhead')
                }
            };
        })();

        return await Promise.race([renderTask, timeoutPromise]);

    } catch (err) {
        throw err;
    } finally {
        // Always runs — success, failure, and timeout.
        // Force-closes all sockets so server.close() doesn't hang
        // on Puppeteer's lingering keep-alive connections.
        await cleanup();
    }
}


module.exports = {
    renderPropertyPhoto,
    launchBrowser,
    detectBlackFrame,
    resolveSnapshotMode,
    getShotsForSnapshotMode
};
