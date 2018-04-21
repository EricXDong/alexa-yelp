const fs = require('fs');
const nodeDir = require('node-dir');
const archiver = require('archiver');
const ProgressBar = require('progress');

const outputDir = 'output.zip';
try {
    fs.unlinkSync(outputDir);
} catch (e) { /* Don't care if the file isn't there to be deleted */ }

const output = fs.createWriteStream(outputDir);
var archive = archiver('zip', {
    zlib: { level: 9 }
});

output.on('close', () => {
    console.log('Done!');
});

output.on('end', () => {
    console.log('archiver finished');
});

archive.on('warning', (err) => {
    console.error(err);
});

archive.on('error', (err) => {
    console.error(err);
});

archive.pipe(output);

archive.file('index.js');
archive.file('logger.js');
archive.file('secrets.json');
archive.directory('http');
archive.directory('node_modules/');

const numFiles =
    nodeDir.files('node_modules', { sync: true }).length
    + nodeDir.files('http', { sync: true }).length
    + 3;
const progressBar = new ProgressBar('Archiving :current/:total :bar', {
    complete: '#',
    incomplete: '-',
    width: 40,
    total: numFiles,
    clear: true
});

archive.on('entry', () => {
    progressBar.tick();
});

archive.finalize();
