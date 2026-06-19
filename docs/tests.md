# Testing Guide

This document describes the diagnostic and functional tests available in the Robotic Property Photographer repository.

## How to Perform Tests
To quickly run all automated tests and verify the renderer configuration, you can use the built-in npm test script:
```bash
npm test
```
This will run the end-to-end integration tests. For specific modular tests, refer to the sections below.

## 1. WebGL Diagnostic (`test-gl.js`)

**Purpose**: Verifies that the browser environment (Puppeteer) correctly initializes WebGL using software rendering. This is critical for environments without a physical GPU (like Docker or WSL).

### How to Run
```bash
node test-gl.js
```

### What it Does
1.  Launches a headless Puppeteer browser with specific hardware acceleration overrides:
    - `--enable-unsafe-swiftshader`
    - `--use-gl=angle`
    - `--use-angle=swiftshader`
2.  Creates a hidden canvas and attempts to get a `webgl` context.
3.  Queries the `WEBGL_debug_renderer_info` extension to identify the underlying driver.

### Expected Output
Successful execution should return:
```text
WebGL Renderer: Google SwiftShader
```

---

## 2. API Integration Test (`test-cli.cjs`)

**Purpose**: Performs an end-to-end functional test of the rendering pipeline by invoking the CLI and verifying the generation of 5 PNG images.

### How to Run
```bash
# Direct execution (inside container)
node test-cli.cjs

# OR via npm script (from host)
npm run test
```

### What it Does
1.  Constructs a JSON job payload containing:
    - `centroid`: Coordinates for the property center.
    - `boundary`: A polygon defining the property boundary.
2.  Writes the payload to a temporary file (`tmp_job.json`).
3.  Executes the renderer via CLI (`node bin/render.js tmp_job.json --output output/test_render.png --timestamp`).
4.  Scans the `output/` directory for the 5 generation outputs.

### Expected Output
A successful response logged to the console confirming the execution and file outputs:
```text
🚀 Launching CLI Render Mission...
...
✅ CLI Execution Finished.
Checking for output files...
Found 5 matching PNG files in output/
✨ Success! All 5 deterministic shots were (likely) generated.
```
