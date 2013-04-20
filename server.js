var express = require('express'),
    http = require('http'),
    socketio = require('socket.io'),
    watcher = require('./watcher'),
    log = require('winston'),
    path = require('path');

// setup cli
var args = require('optimist').usage('Usage: node server.js --root <root folder>').demand('root').describe('root', 'the folder to synchronize files from').argv;
args.root = path.resolve(args.root);

// create and setup app
var app = express();

app.use(express.logger());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
//app.use(express.session());
app.use(app.router);
app.use(express.errorHandler());

// create and setup server
var server = http.createServer(app);

// create and setup socket
var io = socketio.listen(server);

io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');
io.set('log level', 1);

// start server
server.listen(process.env.PORT || 8888);

// create monitor
log.info('monitoring', args.root);
var files = watcher.watch(args.root);

// bind socket to monitor
io.on('connection', function(socket) {
    ['create', 'delete', 'update'].forEach(function(event) {
        var listener = function(file, stat) {
            socket.emit(event, path.relative(args.root, file), stat);
        };

        // listen for event
        files.on(event, listener);

        // remove listener on disconnect
        socket.on('disconnect', function() {
            files.removeListener(event, listener);
        });
    });
});

// serve files
app.get('/*', function(req, res) {
    res.sendfile(path.join(args.root, req.path));
});
