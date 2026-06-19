const assert = require('assert');

process.env.BASE_LAYER_PROVIDER = 'google-3d';
process.env.GOOGLE_API_KEY = 'test-key';

const { resolveSnapshotMode, getShotsForSnapshotMode } = require('../src/renderer');

function shotIds(snapshotMode) {
    return getShotsForSnapshotMode(snapshotMode).map(shot => shot.id);
}

assert.strictEqual(resolveSnapshotMode(undefined), 'all');
assert.strictEqual(resolveSnapshotMode(''), 'all');
assert.strictEqual(resolveSnapshotMode('all'), 'all');
assert.strictEqual(resolveSnapshotMode(' overhead_only '), 'overhead_only');
assert.strictEqual(resolveSnapshotMode('overhead_north'), 'overhead_north');
assert.strictEqual(resolveSnapshotMode('unexpected'), 'all');

assert.deepStrictEqual(shotIds(undefined), ['overhead', 'north', 'east', 'south', 'west']);
assert.deepStrictEqual(shotIds('overhead_only'), ['overhead']);
assert.deepStrictEqual(shotIds('overhead_north'), ['overhead', 'north']);
assert.deepStrictEqual(shotIds('all'), ['overhead', 'north', 'east', 'south', 'west']);

console.log('✅ Snapshot mode selection tests passed.');
