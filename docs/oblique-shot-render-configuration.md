# Oblique Shot Renderer Configuration

## 1. System Overview & Role

This document records the operational parameters, camera rules, geometry styling, and CLI schema used to capture **oblique base property renders**.

* **Execution Environment:** This service runs containerized via **GitHub Actions** in the dedicated repository:  
  `robotic-property-photographer`
* **Pipeline Scope:**  
  * **Oblique Base Renders Only:** This service generates oblique base renders (`north`, `east`, `south`, `west`) with parcel boundaries clearly visible. These base renders are passed downstream to custom **PixelFlow workflows on Segmind.com**, which use AI to enhance the imagery and composite enrichment data layers.
  * **Overhead Imagery Excluded:** Overhead/top-down shots are rendered separately using the **Google Static Maps API** and are not processed by this engine.

---

## 2. Technology Standards & Hardware Flags

* **Engine:** Headless CesiumJS (via `import 'cesium'`) running in a headless Chromium/Puppeteer browser context.
* **3D Imagery & Terrain:** Google Photorealistic 3D Tiles (`GOOGLE_API_KEY`) and `CesiumWorldTerrain`.
* **Output Resolution:** Locked to **2048 × 1536 px** (4:3 aspect ratio).
* **Fidelity Requirements:**
  * Must wait for `viewer.scene.globe.tilesLoaded === true` before capturing each frame.
  * Set `viewer.scene.globe.maximumScreenSpaceError = 1.0` to force maximum level-of-detail.
* **Headless WebGL Configuration:**
  * Context options: `{ webgl: { preserveDrawingBuffer: true } }` (prevents blank captures).
  * Puppeteer SwiftShader software rendering flags:
    * `--enable-unsafe-swiftshader`
    * `--use-gl=angle`
    * `--use-angle=swiftshader`
  * Container SHM size: `shm_size: '2gb'` (prevents Puppeteer WebGL memory exhaustion).
* **Execution & Concurrency:** Strictly sequential (1 job at a time).
* **Black-Frame Detection:** Automated post-capture pixel check (`sharp`). Warns/fails if non-black pixels are < 5%, preventing silent capture failures.
* **Timeout:** Configured with a hard timeout (300–600s) to accommodate cold starts and heavy 3D tile downloads.

---

## 3. Camera & Geometry Rules

### Camera Settings
* **FOV (Field of View):** 100 degrees.
* **Oblique Pitch:** `-35` degrees.
* **Headings (True North Aligned):**
  * `north`: 0°
  * `east`: 90°
  * `south`: 180°
  * `west`: 270°
* **Auto-Framing Logic:**  
  Camera positioning uses `viewer.camera.flyToBoundingSphere()` targeting the parcel bounding sphere with:  
  `boundingSphere.radius * 2.5`

### Boundary Styling
* **Geometry:** GeoJSON polygon transformed to Cesium Cartesian coordinates.
* **Styling:** Polyline rendered with `Cesium.Color.YELLOW` at a width of `3px`.
* **Clamping:** `clampToGround: true` for all polylines/polygons (ensures boundary conforms to 3D terrain).
* **Overlays:** No road labels, acreage text, or internal callouts are drawn here (handled downstream by Segmind PixelFlow or post-processing).

---

## 4. CLI Job Schema & Invocation

The Node CLI entrypoint (`bin/render.js`) accepts a JSON job payload via stdin, file argument, or Docker volume mount.

### Input Job Schema
```json
{
  "customer_id": "cust_12345",
  "order_id": "order_67890",
  "centroid": [-116.4869, 48.3322],
  "centroid_elevation": 655,
  "boundary": [
    [-116.486, 48.331],
    [-116.487, 48.331],
    [-116.487, 48.333],
    [-116.486, 48.333],
    [-116.486, 48.331]
  ]
}
```

### Invocation Methods

* **Via stdin:**
  ```bash
  cat job.json | node bin/render.js
  ```

* **Via file argument:**
  ```bash
  node bin/render.js ./job.json --output ./results/
  ```

* **Via Docker (GitHub Actions Runner):**
  ```bash
  docker run --rm \
    -e GOOGLE_API_KEY=$KEY \
    -v $(pwd)/results:/app/results \
    renderer:latest \
    node bin/render.js ./job.json --output /app/results/
  ```

### Output Response Schema
```json
{
  "status": "success",
  "customer_id": "cust_12345",
  "order_id": "order_67890",
  "shots": {
    "north": { "png_path": "/app/results/north.png" },
    "east":  { "png_path": "/app/results/east.png"  },
    "south": { "png_path": "/app/results/south.png" },
    "west":  { "png_path": "/app/results/west.png"  }
  }
}
```

---

## 5. Diagnostic & Integration Tests

The execution repository provides two automated test suites:

### 1. WebGL Diagnostic (`test-gl.js`)
* **Purpose:** Verifies that Puppeteer initializes WebGL using SwiftShader in headless Linux/Docker environments without a GPU.
* **Execution:**
  ```bash
  node test-gl.js
  ```
* **Expected Output:**
  ```text
  WebGL Renderer: Google SwiftShader
  ```

### 2. End-to-End Integration Test (`test-cli.cjs`)
* **Purpose:** Runs a mock job payload through the CLI and confirms that all 4 oblique PNG base renders are generated without black frames.
* **Execution:**
  ```bash
  npm test
  # or directly:
  node test-cli.cjs
  ```
