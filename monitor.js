var watchr = require('watchr'),
    walker = require('walk'),
    path = require('path'),
    util = require('util'),
    events = require('events');

/**
 * Creates a new monitor.
 *
 * @constructor
 * @extends events.EventEmitter
 * @param {string} location The location to monitor
 */
var Monitor = function(location) {
    Monitor.super_.call(this);
    var self = this;

    // keep location details
    this._location = path.normalize(location);
    this._files = {};

    // track new listeners to replay creates on subscription
    this.on('newListener', function(event, listener) {
        self._replay(event, listener);
    });

    // initialize location watcher
    this._watchr = watchr.watch({
        path: this._location,
        listeners: {
            change: function(change, file, cstat, pstat) {
                self['_' + change](path.relative(self._location, file), cstat || pstat);
            }
        },
        next: function(err, watchers) {
            if (err !== null || watchers === null || watchers.length === 0) {
                self.emit('error', new Error('monitor failed, most likely ' + location + ' doesn\'t exist !'));
            }
            else {
                self._walk();
            }
        }
    });
};
util.inherits(Monitor, events.EventEmitter);

/**
 * Recursively walk the location file tree to fire create events for existing
 * files.
 *
 * @private
 */
Monitor.prototype._walk = function() {
    var self = this;
    walker.walk(this._location).on('file', function(root, stat, next) {
        self._create(path.relative(self._location, path.join(root, stat.name)), stat);
        next();
    });
};

/**
 * Replays the given event. Only create event can be replayed.
 *
 * @private
 * @param {string} event The event
 * @param {Function} listener The event listener
 */
Monitor.prototype._replay = function(event, listener) {
    if (event === 'create') {
        for (var file in this._files) {
            listener(file, this._files[file]);
        }
    }
};

/**
 * Handles a creation event.
 *
 * @private
 * @param {string} file The file
 * @param {fs.Stats} stat The file stats
 */
Monitor.prototype._create = function(file, stat) {
    if (stat.isFile()) {
        this._files[file] = stat;
        this.emit('create', file, stat);
    }
};

/**
 * Handles a deletion event.
 *
 * @private
 * @param {string} file The file
 * @param {fs.Stats} stat The file stats
 */
Monitor.prototype._delete = function(file, stat) {
    if (stat.isFile()) {
        delete this._files[file];
        this.emit('delete', file, stat);
    }
};

/**
 * Handles an update event.
 *
 * @private
 * @param {string} file The file
 * @param {fs.Stats} stat The file stats
 */
Monitor.prototype._update = function(file, stat) {
    if (stat.isFile()) {
        this.emit('update', file, stat);
    }
};

/**
 * Closes the monitor object.
 */
Monitor.prototype.close = function() {
    this._watchr.close();
};

/**
 * Exports the monitor class.
 */
module.exports.Monitor = Monitor;

/**
 * Monitors a location for file creation, deletion or modifications. The method
 * returns an event emitter which sends 3 different events with 2 arguments, the
 * path and the file stat:
 *  - 'create': when a new file is created
 *  - 'delete': when a file is deleted
 *  - 'update': when a file is updated
 *
 * Note that upon registration, the monitor sends a 'create' event for every
 * existing file.
 *
 * When done, the monitor can be closed using its close() method and safely
 * discarded.
 *
 * @param {string} location The location to monitor
 * @return {Monitor} the monitor
 */
module.exports.monitor = function(location) {
    return new Monitor(location);
};
