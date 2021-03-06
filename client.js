var socketio = require('socket.io-client'),
    downloader = require('./downloader'),
    log = require('winston'),
    url = require('url');

// setup cli
var args = require('optimist').usage('Usage: node server.js --server <server url> --root <root folder>')
    .demand(['server', 'root'])
    .describe('server', 'the server url')
    .describe('root', 'the root folder to synchronize files to').argv;

// connect to server
var io = socketio.connect(args.server).on('error', function(err) {
    log.warn('failed to initialize socket.io connection', err);
});

// setup file downloader
var downloader = downloader.downloader(args.root);

// bind change events to downloader
io.on('update', function(file, stat) {
    // fix times as socket.io converts them to strings
    ["atime", "mtime", "ctime"].forEach(function(time) {
        if (typeof stat[time] === 'string') {
            stat[time] = new Date(stat[time]);
        }
    });
    // download file
    downloader.download(url.resolve(args.server, file), stat);
});
