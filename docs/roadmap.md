# Robotic Property Photographer — Project Roadmap

> A living document. Updated as phases complete and new intent is defined.
>
> **Current Objective:** Produce 5 PNG images of a property boundary — north, east, south, west, and overhead — from a JSON parcel payload.
>
> **Architecture constraint:** This service is a stateless rendering engine. It receives a JSON payload (via CLI stdin or file arg) and returns PNG assets. Long-term storage, job queuing, and notifications are handled by upstream n8n.

---

## ✅ Phase 1 — Rendering Foundation (Completed)
- [x] Headless CesiumJS renderer running in Docker via Puppeteer.
- [x] **High-Performance Standalone Renderer**: Puppeteer loads an inline HTML page with CesiumJS — no web framework involved.
- [x] Viewport locked at **2048 × 1536 px** (4:3 aspect ratio).
- [x] Sequential render queue (1 job at a time) — prevents WebGL OOM crashes.
- [x] **CLI entrypoint** (`bin/render.js`) accepts job JSON via stdin, file path, or inline argument.

## ✅ Phase 2 — Camera & Boundary System (Completed)
- [x] **Fixed headings:** 0°, 90°, 180°, 270° (True North aligned).
- [x] **FOV:** 100°.
- [x] **Boundary Rendering:** GeoJSON polygon → Yellow polyline (3px), clamped to terrain.
- [x] **Auto-framing:** Smart `flyToBoundingSphere` logic for consistent property sizing.

## ✅ Phase 3 — Simplified PNG Output (Completed)
- [x] Service optimized to return exactly 5 PNGs (North, East, South, West, Nadir).
- [x] Removed dependency on `ag-psd` and complex layering logic.
- [x] Removed OSM road data fetching and acreage calculation (simplified scope).
- [x] Black-frame detection: warns when tiles fail to load (< 5% non-black pixels).

## ✅ Phase 4 — Test Infrastructure (Completed)
- [x] `test-cli.cjs` — End-to-end integration test verifying the 5-PNG output.
- [x] `test-gl.js` — WebGL diagnostic script for headless environment.

## ✅ Phase 4.5 — Next.js Removal (Completed)
- [x] Removed Next.js, React, and all web-server dependencies.
- [x] Replaced HTTP API with plain Node.js CLI (`bin/render.js`).
- [x] Added `lib/jobParser.js` for flexible input normalization.
- [x] Added `lib/outputWriter.js` for PNG + metadata output to disk or stdout.
- [x] Updated Dockerfile to `CMD ["node", "bin/render.js"]` — no server process.

## ✅ Phase 5 — Production Hardening (Completed)
- [x] Render timeout: kill job and return error after 300 seconds.
- [x] Health check script for Docker + n8n polling (`bin/healthcheck.js`).
- [x] Graceful Puppeteer teardown on container SIGTERM / SIGINT.
- [x] Smart Auto-Framing: Centering and sizing camera via `flyToBoundingSphere` logic.


---

## Removed / Deprecated Features
*The following features were part of previous project goals and have been removed to simplify the engine and improve reliability:*

*   **Next.js / Express API:** HTTP server replaced by CLI entrypoint.
*   **PSD Compositing:** Layered PSD output with editable text layers.
*   **Street Label Data:** OSM road name fetching and overlay.
*   **Acreage Overlay:** Calculation and rendering of parcel acreage.
*   **External Storage:** Built-in Cloudflare R2 uploads (now handled by upstream n8n).
*   **Photopea Integration:** Deep-linking for manual layer correction.
*   **ntfy.sh Notifications:** Direct push notifications from the renderer.

---

## Tech Stack Reference

| Layer | Technology |
|-------|------------|
| Rendering engine | CesiumJS (headless, via Puppeteer) |
| Runtime | Node.js CLI (`bin/render.js`) |
| Container | Docker / Docker Compose |
| 3D tiles | Google Photorealistic 3D Tiles |
| Terrain | CesiumWorldTerrain |
| Image processing | sharp (black-frame detection) |
| Orchestration | n8n (upstream, not in this repo) |
