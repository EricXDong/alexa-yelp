const fs = require('fs');
const archiver = require('archiver');

fs.unlinkSync(__dirname + '/output.zip');

const output = fs.createWriteStream(__dirname + '/output.zip');
var archive = archiver('zip', {
    zlib: { level: 9 }
});

output.on('close', () => {
    console.log('Archived ' + archive.pointer() + ' bytes');
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
archive.directory('node_modules/');

archive.finalize();
