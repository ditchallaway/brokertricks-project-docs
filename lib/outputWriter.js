/**
 * Output writer for writing PNG buffer and metadata
 */
const fs = require('fs/promises');
const path = require('path');

function getTimestampedPath(basePath) {
    if (!basePath || basePath === '-') return basePath;
    
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS
    
    const ext = path.extname(basePath);
    const base = path.basename(basePath, ext);
    const dir = path.dirname(basePath);
    
    return path.join(dir, `${base}_${timestamp}${ext}`);
}

async function writeOutput(pngBuffer, metadata, outputPath) {
    if (!outputPath || outputPath === '-') {
        // Write PNG to stdout
        process.stdout.write(pngBuffer);
        return { success: true, toStdout: true };
    }

    try {
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });

        // Write PNG
        await fs.writeFile(outputPath, pngBuffer);

        // Write metadata
        const metadataPath = outputPath.replace(/\.png$/i, '.json') || `${outputPath}.json`;
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        return {
            success: true,
            toStdout: false,
            pngPath: outputPath,
            metadataPath: metadataPath
        };
    } catch (err) {
        throw new Error(`Failed to write output to ${outputPath}: ${err.message}`);
    }
}

module.exports = {
    writeOutput,
    getTimestampedPath
};
