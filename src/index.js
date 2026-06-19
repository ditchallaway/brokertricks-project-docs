require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { renderPropertyPhoto } = require('./renderer');
const RenderQueue = require('./queue');
const config = require('./config');
const { normalizeJob } = require('../lib/jobParser');

const app = express();
const queue = new RenderQueue();
const PORT = process.env.PORT || 9876;

// Parse global defaults from command line arguments
const args = process.argv.slice(2);
const globalFast = args.includes('--fast');
const globalSkipValidation = args.includes('--no-validate');
const progressFlagIndex = args.indexOf('--progress-file');
const globalProgressPath = progressFlagIndex !== -1 ? args[progressFlagIndex + 1] : null;

console.log(`[Config] Global Flags: fast=${globalFast}, skipValidation=${globalSkipValidation}, progressFile=${globalProgressPath}`);

app.use(express.json());

// Serve static assets for manual verification in browser
app.use('/test-results', express.static(path.join(process.cwd(), 'test-results')));
app.use('/output', express.static(path.join(process.cwd(), 'output')));

/**
 * simple gallery for development verification
 */
app.get('/', async (req, res) => {
    try {
        const dirs = ['test-results', 'output'];
        let html = '<h1>Robotic Property Photographer - Dev Gallery</h1><div style="display:flex; flex-wrap:wrap; gap:20px;">';
        
        for (const dir of dirs) {
            try {
                const files = await fs.readdir(path.join(process.cwd(), dir));
                const images = files.filter(f => f.endsWith('.png')).sort().reverse();
                
                html += `<div style="width:100%"><h2>${dir}/</h2></div>`;
                if (images.length === 0) html += '<p>No images found yet.</p>';
                
                for (const img of images.slice(0, 10)) { // show last 10
                    html += `
                        <div style="border:1px solid #ccc; padding:10px; border-radius:8px;">
                            <p style="font-size:12px; margin:0 0 10px 0;">${img}</p>
                            <a href="/${dir}/${img}" target="_blank">
                                <img src="/${dir}/${img}" style="max-width:400px; display:block; border-radius:4px;">
                            </a>
                        </div>`;
                }
            } catch (e) {
                // ignore missing directories
            }
        }
        
        html += '</div>';
        res.send(html);
    } catch (err) {
        res.status(500).send('Error loading gallery: ' + err.message);
    }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        queue: queue.getStatus()
    });
});

/**
 * Main render endpoint
 * POST /render
 * 
 * Body:
 * {
 *   "centroid": { "lon": -122.45, "lat": 37.78 },
 *   "elevation": 100,
 *   "boundary": { "type": "Polygon", "coordinates": [[[-122.451, 37.781], [-122.449, 37.781], [-122.449, 37.779], [-122.451, 37.779], [-122.451, 37.781]]]},
 *   "acreage": 2.5,
 *   "roadName": "Main Street",
 *   "shotList": [0, 90, 180, 270]
 * }
 */
app.post('/render', async (req, res) => {
    try {
        let job = req.body;

        // Apply normalization to handle different input formats (e.g., n8n, flat fields)
        try {
            job = normalizeJob(job);
        } catch (normError) {
            return res.status(400).json({
                success: false,
                error: `Job normalization failed: ${normError.message}`
            });
        }

        // Validate required fields payload to prevent silent failures later in the pipeline
        if (!job.centroid || !job.boundary) {
            return res.status(400).json({
                error: 'Missing required fields: centroid, boundary'
            });
        }

        console.log(`[API] Received /render request for ${job.customer_id || 'unknown'} (Order: ${job.order_id || 'unknown'})`);
        
        let result;
        try {
            console.log(`[API] Enqueuing job...`);
            result = await queue.enqueue(async (updateProgress) => {
                console.log(`[API] Job started processing in queue`);
                const startTime = Date.now();
                
                // Wrap updateProgress to also write to globalProgressPath if set
                const progressHandler = (percent, status) => {
                    updateProgress(percent, status);
                    if (globalProgressPath) {
                        try {
                            const fs = require('fs');
                            fs.writeFileSync(globalProgressPath, JSON.stringify({ percent: Math.round(percent), status, timestamp: new Date().toISOString() }));
                        } catch (e) { /* ignore write errors */ }
                    }
                };

                // Pass the fast/skipValidation options from the query/body if available, falling back to global defaults
                const renderOptions = {
                    fast: !!req.query.fast || !!req.body.fast || globalFast,
                    skipValidation: !!req.query['no-validate'] || !!req.body.skipValidation || globalSkipValidation
                };
                const renderResult = await renderPropertyPhoto(job, progressHandler, renderOptions);
                
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`[API] Rendering completed in ${duration}s`);
                return renderResult;
            });
        } catch (err) {
            console.error('[API] Render failed in the worker queue or rendering engine:', err.message);
            return res.status(500).json({
                error: 'Render failed',
                message: err.message
            });
        }

        // Return PNG shots metadata, including base64-encoded image data for immediate use by clients (e.g., n8n)
        const orderId = job.order_id || null;
        const pngShots = result.shots.map(shot => ({
            order_id: orderId,
            id: shot.id,
            png: shot.pngBuffer.toString('base64')
        }));

        res.json({
            success: true,
            shots: pngShots,
            metadata: result.metadata
        });

    } catch (err) {
        console.error('[API] Error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message
        });
    }
});

/**
 * Batch render endpoint
 * POST /render-batch
 * 
 * Body:
 * {
 *   "jobs": [{ centroid, boundary: { type: 'Polygon', coordinates }, ... }, ...]
 * }
 */
app.post('/render-batch', async (req, res) => {
    try {
        const { jobs } = req.body;

        if (!Array.isArray(jobs) || jobs.length === 0) {
            return res.status(400).json({
                error: 'Invalid batch: must provide jobs array'
            });
        }

        console.log(`[API] Received batch request for ${jobs.length} jobs`);
        const results = [];
        const errors = [];

        for (let i = 0; i < jobs.length; i++) {
            try {
                console.log(`[API] Batch job ${i+1}/${jobs.length}: Enqueuing...`);
                const result = await queue.enqueue(async () => {
                    console.log(`[API] Batch job ${i+1}/${jobs.length}: Started`);
                    return await renderPropertyPhoto(jobs[i]);
                });

                results.push({
                    index: i,
                    success: true,
                    shots: result.shots.map(s => s.id),
                    metadata: result.metadata
                });
                console.log(`[API] Batch job ${i+1}/${jobs.length}: Success`);
            } catch (err) {
                console.error(`[API] Batch job ${i+1}/${jobs.length}: Failed:`, err.message);
                errors.push({
                    index: i,
                    success: false,
                    error: err.message
                });
            }
        }

        res.json({
            total: jobs.length,
            successful: results.length,
            failed: errors.length,
            results,
            errors
        });

    } catch (err) {
        console.error('[API] Batch error:', err);
        res.status(500).json({
            error: 'Batch processing failed',
            message: err.message
        });
    }
});

/**
 * Queue status endpoint
 */
app.get('/queue/status', (req, res) => {
    res.json(queue.getStatus());
});

const server = app.listen(PORT, () => {
    console.log(`[Server] Robotic Property Photographer listening on port ${PORT}`);
    console.log(`[Config] Google API Key: ${process.env.GOOGLE_API_KEY ? '✓ set' : '✗ missing'}`);
    console.log(`[Config] Black Frame Threshold: ${process.env.BLACK_FRAME_THRESHOLD || '0.95'}`);
    console.log(`[Config] Render Timeout: ${config.RENDER_TIMEOUT_MS / 1000}s`);
});

/**
 * Handle graceful shutdown (Kubernetes / Docker SIGTERM)
 */
const shutdown = () => {
    console.log('[Server] Graceful shutdown initiated...');
    server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
    });

    // Force exit after 10s if server.close() hangs
    setTimeout(() => {
        console.error('[Server] Could not close connections in time, forceful shutdown');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
