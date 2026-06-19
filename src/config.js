/**
 * Application configuration and environment validation
 */
require('dotenv').config();

const config = {
    BASE_LAYER_PROVIDER: (process.env.BASE_LAYER_PROVIDER || 'google-3d').toLowerCase(),
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    AZURE_MAPS_KEY: process.env.AZURE_MAPS_KEY,
    CESIUM_ION_TOKEN: process.env.CESIUM_ION_TOKEN,
    BLACK_FRAME_THRESHOLD: parseFloat(process.env.BLACK_FRAME_THRESHOLD || '0.95'),
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    VARYING_PITCH: parseFloat(process.env.VARYING_PITCH || '-24'),
    RENDER_TIMEOUT_MS: parseInt(process.env.RENDER_TIMEOUT_MS || '1200000'), // 20 minutes
};

// Validate BASE_LAYER_PROVIDER value
const validProviders = ['google-3d', 'azure-maps'];
if (!validProviders.includes(config.BASE_LAYER_PROVIDER)) {
    console.error(`[FATAL] Invalid BASE_LAYER_PROVIDER: "${config.BASE_LAYER_PROVIDER}". Must be one of: ${validProviders.join(', ')}`);
    process.exit(1);
}

// Provider-specific required environment variables
const requiredVarsByProvider = {
    'google-3d': ['GOOGLE_API_KEY'],
    'azure-maps': ['AZURE_MAPS_KEY', 'CESIUM_ION_TOKEN'],
};
const requiredVars = requiredVarsByProvider[config.BASE_LAYER_PROVIDER] || [];
const missingVars = requiredVars.filter(v => !config[v]);

if (missingVars.length > 0) {
    console.error(`[FATAL] Missing required environment variables for provider "${config.BASE_LAYER_PROVIDER}": ${missingVars.join(', ')}`);
    process.exit(1);
}

module.exports = config;
