#!/usr/bin/env node

/**
 * Docker & Orchestration Health Check Script
 * 
 * This script is used by the Dockerfile HEALTHCHECK instruction to verify 
 * that the Robotic Property Photographer is healthy and ready to process jobs.
 */

const http = require('http');

const PORT = process.env.PORT || 9876;
const URL = `http://localhost:${PORT}/health`;

/**
 * Perform a simple HTTP check against the health endpoint
 */
const checkApi = () => {
    return new Promise((resolve, reject) => {
        const req = http.get(URL, (res) => {
            if (res.statusCode === 200) {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.status === 'ok') {
                            resolve(true);
                        } else {
                            reject(new Error(`API responded with invalid status: ${json.status}`));
                        }
                    } catch (e) {
                        reject(new Error('API responded with invalid JSON'));
                    }
                });
            } else {
                reject(new Error(`API responded with status: ${res.statusCode}`));
            }
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Health check timed out after 5s'));
        });
    });
};

/**
 * For CLI-only mode, we can optionally perform a WebGL context test 
 * (but that is expensive to run every 30s as a docker healthcheck).
 * For now, we prioritize the HTTP API health check.
 */
async function main() {
    try {
        await checkApi();
        console.log('✅ Healthy');
        process.exit(0);
    } catch (err) {
        console.error(`❌ Unhealthy: ${err.message}`);
        process.exit(1);
    }
}

main();
