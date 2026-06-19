console.log("[Cesium] Script starting...");

window.addEventListener('load', async function() {
    console.log("[Cesium] Window loaded. Starting init...");
    try {
        const response = await fetch('/api/job');
        const data = await response.json();
        const { job, googleApiKey, baseLayerProvider, azureMapsKey, cesiumIonToken } = data;
        const { centroid, elevation, boundaryRings } = job;

        const provider = baseLayerProvider || 'google-3d';
        console.log("[Cesium] Base layer provider:", provider);

        console.log("[Cesium] Initializing viewer...");
        const container = document.getElementById("cesiumContainer");
        
        // Brief delay to ensure container dimensioning and WebGL ready
        await new Promise(r => setTimeout(r, 100));

        // ── Provider-specific viewer options ────────────────────────────
        var viewerOptions = {
            contextOptions: { 
                webgl: { 
                    preserveDrawingBuffer: true,
                    antialias: false
                } 
            },
            baseLayer: false,
            infoBox: false,
            selectionIndicator: false,
            creditContainer: document.createElement("div")
        };

        // Set Cesium Ion token before Viewer initialization — required for
        // world terrain (azure-maps) and any Ion-backed resources.
        if (cesiumIonToken) {
            Cesium.Ion.defaultAccessToken = cesiumIonToken;
            console.log("[Cesium] Cesium Ion defaultAccessToken configured");
        }

        const viewer = new Cesium.Viewer(container, viewerOptions);
        
        viewer.scene.globe.show = true;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.skyBox.show = true;

        // ── Base layer initialization ───────────────────────────────────
        if (provider === 'azure-maps') {
            // ── Azure Maps: imagery + world terrain ─────────────────────
            console.log("[Cesium] Initializing Azure Maps imagery layer...");
            if (!azureMapsKey) {
                console.error("[Cesium] CRITICAL: Azure Maps Key is missing!");
            }

            var azureImagery = new Cesium.UrlTemplateImageryProvider({
                url: 'https://atlas.microsoft.com/map/tile?api-version=2.0&tilesetId=microsoft.imagery&zoom={z}&x={x}&y={y}&subscription-key=' + azureMapsKey,
                maximumLevel: 19,
                credit: new Cesium.Credit('© Microsoft Azure Maps')
            });
            viewer.imageryLayers.addImageryProvider(azureImagery);
            console.log("[Cesium] Azure Maps imagery provider added");

            // World terrain provides the 3D surface that Azure Maps imagery
            // drapes over — without this, the view would be a flat ellipsoid.
            console.log("[Cesium] Loading Cesium World Terrain...");
            var terrainProvider = await Cesium.createWorldTerrainAsync({
                requestWaterMask: false,
                requestVertexNormals: false
            });
            viewer.terrainProvider = terrainProvider;
            console.log("[Cesium] World terrain loaded successfully");

            // No 3D tileset for Azure Maps — leave window.tileset undefined
            // so renderer.js falls back to globe.tilesLoaded gating.

        } else {
            // ── Google 3D: photorealistic tileset (default) ─────────────
            console.log("[Cesium] Initializing Google Photorealistic 3D Tileset...");
            if (!googleApiKey) {
                console.error("[Cesium] CRITICAL: Google API Key is missing!");
            }

            console.log("[Cesium] Calling createGooglePhotorealistic3DTileset...");
            const tileset = await Cesium.createGooglePhotorealistic3DTileset({
                key: googleApiKey
            });
            console.log("[Cesium] Tileset created successfully.");
            window.tileset = tileset;
            viewer.scene.primitives.add(tileset);
        }

        // Allow Cesium to skip intermediate LOD levels when loading tiles.
        // Without this, it loads every ancestor tile before rendering a high-detail child,
        // causing a large request queue at coarse SSE levels on wide-angle oblique views.
        // SSE will be managed by the renderer script for optimal stability/quality


        var elev = elevation || 100;
        if (!Array.isArray(boundaryRings) || boundaryRings.length === 0) {
            var receivedType = Array.isArray(boundaryRings) ? 'array(empty)' : typeof boundaryRings;
            throw new Error("Invalid boundaryRings: expected non-empty array, got " + receivedType);
        }
        var rings = boundaryRings;

        // Calculate bounding sphere from property boundary for robust framing
        var allPoints = [];
        rings.forEach(function(ring) {
            ring.forEach(function(c) {
                allPoints.push(window.Cesium.Cartesian3.fromDegrees(c[0], c[1], elev));
            });
        });
        window.boundingSphere = window.Cesium.BoundingSphere.fromPoints(allPoints);
        console.log("[Cesium] Bounding sphere calculated (radius: " + window.boundingSphere.radius.toFixed(1) + "m)");

        // Initial framing (Nadir)
        viewer.camera.flyToBoundingSphere(window.boundingSphere, {
            offset: new window.Cesium.HeadingPitchRange(0, window.Cesium.Math.toRadians(-89.9), window.boundingSphere.radius * 2.0),
            duration: 0
        });

        viewer.camera.frustum.fov = Cesium.Math.toRadians(100);

        // Draw boundary polygon and thick outline border clamped to ground
        // Draw boundary polygon and thick outline border
        var allRings = rings.map(function(ring) {
            var coords = [];
            ring.forEach(function(c) { coords.push(c[0], c[1]); });
            
            // Ensure closed loop for rendering stability
            if (ring.length > 0) {
                var first = ring[0];
                var last = ring[ring.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    coords.push(first[0], first[1]);
                }
            }
            return window.Cesium.Cartesian3.fromDegreesArray(coords);
        });

        if (allRings.length > 0) {
            const config = window.boundaryConfig || { showFill: false, type: 'solid', width: 4, color: '#FFFF00' };

            // 1. Fill (Single Polygon with hierarchy to support holes)
            if (config.showFill) {
                var holes = allRings.slice(1).map(function(r) { return new window.Cesium.PolygonHierarchy(r); });
                var hierarchy = new window.Cesium.PolygonHierarchy(allRings[0], holes);
                
                viewer.entities.add({ 
                    polygon: { 
                        hierarchy: hierarchy, 
                        material: window.Cesium.Color.fromCssColorString(config.fillColor || config.color).withAlpha(config.fillOpacity || 0.2),
                        clampToGround: true,
                        classificationType: window.Cesium.ClassificationType.BOTH
                    } 
                });
            }

            // 2. Outlines (Individual Polyline entities for robust styling/width)
            var material;
            var color = window.Cesium.Color.fromCssColorString(config.color);

            switch (config.type) {
                case 'glow':
                    material = new window.Cesium.PolylineGlowMaterialProperty({
                        color: color,
                        glowPower: config.glowPower || 0.2,
                        taperPower: config.taperPower || 1.0
                    });
                    break;
                case 'dash':
                    material = new window.Cesium.PolylineDashMaterialProperty({
                        color: color,
                        gapColor: window.Cesium.Color.fromCssColorString(config.gapColor || '#00000000'),
                        dashLength: config.dashLength || 16
                    });
                    break;
                case 'outline':
                    material = new window.Cesium.PolylineOutlineMaterialProperty({
                        color: color,
                        outlineColor: window.Cesium.Color.fromCssColorString(config.outlineColor || '#000000'),
                        outlineWidth: config.outlineWidth || 2
                    });
                    break;
                case 'arrow':
                    material = new window.Cesium.PolylineArrowMaterialProperty(color);
                    break;
                default:
                    material = color;
            }

            allRings.forEach(function(pos) {
                viewer.entities.add({
                    polyline: {
                        positions: pos,
                        width: config.width || 4,
                        material: material,
                        clampToGround: true
                    }
                });
            });
        }
        
        console.log("[Cesium] Scene setup complete. Nudging for first render...");
        viewer.scene.render();
        
        // Finalize initialization - this signals the renderer script to begin
        window.viewer = viewer;

    } catch (e) {
        console.error("[CesiumJS Error] Failed to initialize:", e);
    }
});
