const assert = require('assert');
const { normalizeJob } = require('../lib/jobParser');

const OUTER_RING = [
    [-116.4868255, 48.3317135],
    [-116.4855530, 48.3317135],
    [-116.4855585, 48.3328070],
    [-116.4883350, 48.3328055],
    [-116.4883410, 48.3320940],
    [-116.4883485, 48.3317135],
    [-116.4868255, 48.3317135]
];

const HOLE_RING = [
    [-116.4872000, 48.3321000],
    [-116.4870000, 48.3321000],
    [-116.4870000, 48.3319000],
    [-116.4872000, 48.3319000],
    [-116.4872000, 48.3321000]
];

const baseJobFields = {
    customer_id: 'cust_12345',
    order_id: 'order_12345',
    centroid: [-116.4869477327835, 48.33225928561425]
};

const canonical = normalizeJob({
    ...baseJobFields,
    boundary: {
        type: 'Polygon',
        coordinates: [OUTER_RING, HOLE_RING]
    }
});

assert.deepStrictEqual(canonical.boundaryOuter, OUTER_RING);
assert.deepStrictEqual(canonical.boundaryRings, [OUTER_RING, HOLE_RING]);
assert.deepStrictEqual(canonical.boundary.coordinates, [OUTER_RING, HOLE_RING]);
assert.strictEqual(canonical.boundary.type, 'Polygon');

const pointCentroidWithBoundary = normalizeJob({
    ...baseJobFields,
    centroid: { type: 'Point', coordinates: [-116.4869477327835, 48.33225928561425] },
    boundary: {
        type: 'Polygon',
        coordinates: [OUTER_RING, HOLE_RING]
    }
});

assert.deepStrictEqual(pointCentroidWithBoundary.centroid, {
    lon: -116.4869477327835,
    lat: 48.33225928561425
});
assert.deepStrictEqual(pointCentroidWithBoundary.boundary.coordinates, [OUTER_RING, HOLE_RING]);
assert.strictEqual(pointCentroidWithBoundary.boundary.type, 'Polygon');

const legacyGeometry = normalizeJob({
    ...baseJobFields,
    geometry: {
        type: 'Polygon',
        coordinates: [OUTER_RING, HOLE_RING]
    }
});

assert.deepStrictEqual(legacyGeometry.boundaryOuter, OUTER_RING);
assert.deepStrictEqual(legacyGeometry.boundaryRings, [OUTER_RING, HOLE_RING]);
assert.deepStrictEqual(legacyGeometry.boundary.coordinates, [OUTER_RING, HOLE_RING]);
assert.strictEqual(legacyGeometry.boundary.type, 'Polygon');

const pointCentroidWithGeometry = normalizeJob({
    ...baseJobFields,
    centroid: { type: 'Point', coordinates: [-116.4869477327835, 48.33225928561425] },
    geometry: {
        type: 'Polygon',
        coordinates: [OUTER_RING, HOLE_RING]
    }
});

assert.deepStrictEqual(pointCentroidWithGeometry.centroid, {
    lon: -116.4869477327835,
    lat: 48.33225928561425
});
assert.deepStrictEqual(pointCentroidWithGeometry.boundary.coordinates, [OUTER_RING, HOLE_RING]);
assert.strictEqual(pointCentroidWithGeometry.boundary.type, 'Polygon');

const flatBoundary = normalizeJob({
    ...baseJobFields,
    boundary: OUTER_RING
});

assert.deepStrictEqual(flatBoundary.boundaryOuter, OUTER_RING);
assert.deepStrictEqual(flatBoundary.boundaryRings, [OUTER_RING]);
assert.deepStrictEqual(flatBoundary.boundary.coordinates, [OUTER_RING]);
assert.strictEqual(flatBoundary.boundary.type, 'Polygon');

assert.throws(() => normalizeJob({
    ...baseJobFields,
    centroid: { type: 'Point', coordinates: ['-116.4869477327835', 48.33225928561425] },
    boundary: {
        type: 'Polygon',
        coordinates: [OUTER_RING, HOLE_RING]
    }
}), /Invalid centroid GeoJSON Point: expected coordinates \[lon, lat\]/);

console.log('✅ jobParser canonical and backward-compatibility tests passed.');
