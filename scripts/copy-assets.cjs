const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../node_modules/cesium/Build/Cesium');
const destDir = path.join(__dirname, '../public/cesium');

console.log(`Copying Cesium assets from ${srcDir} to ${destDir}...`);

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    copyDir(srcDir, destDir);
    console.log('Cesium assets copied successfully!');
} catch (err) {
    console.error('Error copying Cesium assets:', err);
    process.exit(1);
}
