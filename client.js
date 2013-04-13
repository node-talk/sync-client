var socketio = require('socket.io-client'),
    downloader = require('./downloader'),
    url = require('url');

// setup cli
var args = require('optimist').usage('Usage: node server.js --server <server url> --root <root folder>')
    .demand(['server', 'root'])
    .describe('server', 'the server url')
    .describe('root', 'the root folder to synchronize files to').argv;

// connect to server
var io = socketio.connect(args.server);

// setup file downloader
var downloader = downloader.downloader(args.root);

// bind change events to downloader
['create', 'update'].forEach(function(event) {
    io.on(event, function(file, stat) {
        downloader.download(url.resolve(args.server, file), stat);
    });
});
