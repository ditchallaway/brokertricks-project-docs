FROM node:20-bookworm-slim

# Install system dependencies (Chromium + WebGL)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    mesa-utils \
    libgl1 \
    libegl1 \
    xdg-utils \
    ca-certificates \
    tini \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path for Puppeteer & WebGL settings
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV CHROME_DISABLE_GPU_SANDBOX=1

WORKDIR /app

# Install dependencies (ignore-scripts to skip postinstall until code is copied)
COPY package*.json ./
RUN npm ci --ignore-scripts --prefer-offline

# Copy application source
COPY . .

# Run assets management (Cesium workers/assets)
RUN node scripts/copy-assets.cjs

# CLI entry point via tini for process stability
ENTRYPOINT ["/usr/bin/tini", "--"]

# Verify that the service is running and ready to process jobs
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD ["node", "bin/healthcheck.js"]

CMD ["node", "bin/render.js"]
