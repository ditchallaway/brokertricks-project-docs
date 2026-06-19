/**
 * Job specification parser and validator
 */

function isCoordinatePair(value) {
    return Array.isArray(value)
        && value.length >= 2
        && typeof value[0] === 'number'
        && typeof value[1] === 'number';
}

function isLinearRing(value) {
    return Array.isArray(value) && value.every(isCoordinatePair);
}

function isPolygonCoordinates(value) {
    return Array.isArray(value) && value.every(isLinearRing);
}

function isGeoJsonPolygon(value) {
    return value
        && typeof value === 'object'
        && value.type === 'Polygon'
        && isPolygonCoordinates(value.coordinates);
}

function isGeoJsonPoint(value) {
    return value
        && typeof value === 'object'
        && value.type === 'Point'
        && isCoordinatePair(value.coordinates);
}

function validateJob(job) {
    const errors = [];
    // normalizeJob() populates boundaryRings/boundaryOuter before validation.
    // Keep this fallback for direct validateJob() calls on canonical payloads.
    const boundaryRings = job.boundaryRings
        || (isGeoJsonPolygon(job.boundary) ? job.boundary.coordinates : undefined);
    const boundaryOuter = job.boundaryOuter || (boundaryRings ? boundaryRings[0] : undefined);

    if (!job.centroid) {
        errors.push("Missing 'centroid' object { lon, lat }");
    } else {
        if (typeof job.centroid.lon !== 'number') errors.push("'centroid.lon' must be a number");
        if (typeof job.centroid.lat !== 'number') errors.push("'centroid.lat' must be a number");
    }

    if (job.elevation !== undefined && typeof job.elevation !== 'number') {
        errors.push("'elevation' must be a number");
    }

    if (!job.boundary || !isGeoJsonPolygon(job.boundary)) {
        errors.push("'boundary' must be a GeoJSON Polygon geometry object");
    }

    if (!boundaryRings || !isPolygonCoordinates(boundaryRings)) {
        errors.push("'boundaryRings' must be polygon coordinates [[[lon, lat], ...], ...]");
    }

    if (!boundaryOuter || !isLinearRing(boundaryOuter)) {
        errors.push("'boundaryOuter' must be the outer ring [[lon, lat], ...]");
    }

    // Optional fields
    if (job.acreage && typeof job.acreage !== 'string') {
        errors.push("'acreage' must be a string (e.g., '5.00 ACRES')");
    }

    if (job.shotList && !Array.isArray(job.shotList)) {
        errors.push("'shotList' must be an array");
    }

    if (errors.length > 0) {
        throw new Error(`Job validation failed:\n- ${errors.join('\n- ')}`);
    }

    return true;
}

function normalizeJob(rawInput) {
    let rawJob = rawInput;
    
    // If n8n or other automation sends as a single-element array, extract it
    if (Array.isArray(rawInput)) {
        if (rawInput.length === 0) throw new Error("Job payload is an empty array");
        rawJob = rawInput[0];
    }

    // Basic normalization for flexibility
    const job = { ...rawJob };

    // Support centroid as [lon, lat], { lon, lat }, or GeoJSON Point
    if (Array.isArray(job.centroid)) {
        job.centroid = { lon: job.centroid[0], lat: job.centroid[1] };
    } else if (isGeoJsonPoint(job.centroid)) {
        job.centroid = { lon: job.centroid.coordinates[0], lat: job.centroid.coordinates[1] };
    } else if (job.centroid && typeof job.centroid === 'object' && job.centroid.type === 'Point') {
        throw new Error("Invalid centroid GeoJSON Point: expected coordinates [lon, lat]");
    }

    // Support separate lat/lon string fields when no centroid is provided
    if (!job.centroid && job.lat !== undefined && job.lon !== undefined) {
        const lat = parseFloat(job.lat);
        const lon = parseFloat(job.lon);
        if (isNaN(lat) || isNaN(lon)) {
            throw new Error(`Invalid lat/lon values: lat='${job.lat}', lon='${job.lon}'`);
        }
        job.centroid = { lon, lat };
    }

    // Canonical format: boundary is a full GeoJSON Polygon geometry object
    if (isGeoJsonPolygon(job.boundary)) {
        job.boundaryRings = job.boundary.coordinates;
        job.boundaryOuter = job.boundary.coordinates[0];
    }
    // Backward compatibility: legacy geometry field
    else if (isGeoJsonPolygon(job.geometry)) {
        job.boundary = job.geometry;
        job.boundaryRings = job.geometry.coordinates;
        job.boundaryOuter = job.geometry.coordinates[0];
    }
    // Backward compatibility: flat outer ring only
    else if (isLinearRing(job.boundary)) {
        const legacyOuterRing = job.boundary;
        job.boundaryOuter = legacyOuterRing;
        job.boundaryRings = [legacyOuterRing];
        job.boundary = {
            type: 'Polygon',
            coordinates: [legacyOuterRing]
        };
    }

    // Support ll_gisacre as acreage
    if (job.ll_gisacre && !job.acreage) {
        job.acreage = `${parseFloat(job.ll_gisacre).toFixed(2)} ACRES`;
    }

    // Support acres (string or number) as acreage when acreage/ll_gisacre are absent
    if (job.acres !== undefined && !job.acreage && !job.ll_gisacre) {
        const acres = parseFloat(job.acres);
        if (isNaN(acres)) {
            throw new Error(`Invalid acres value: '${job.acres}'`);
        }
        job.acreage = `${acres.toFixed(2)} ACRES`;
    }

    // Support centroid_elevation as elevation
    if (job.centroid_elevation !== undefined && job.elevation === undefined) {
        job.elevation = job.centroid_elevation;
    }

    validateJob(job);
    return job;
}

module.exports = {
    normalizeJob,
    validateJob
};
