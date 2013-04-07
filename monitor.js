var watchr = require('watchr'),
    walker = require('walk'),
    path = require('path'),
    events = require('events');

/**
 * Monitors a location for file creation or deletion. The method returns an
 * event emitter which sends 2 different events with the path and the file stat:
 *  - 'create': when a new file is created
 *  - 'delete': when a file is deleted
 * Note that upon registration, the monitor sends a 'create' event for every
 * existing file.
 *
 * @param {string} the location to monitor
 * @return {EventEmitter} the monitor
 */
module.exports.monitor = function(location) {
    location = path.normalize(location);
    var e = new events.EventEmitter();

    // watch location
    e.files = {};
    e.watchr = watchr.watch({
        path: location,
        listeners: {
            change: function(change, file, cstat, pstat) {
                file = path.relative(location, file);
                if (change === 'create' && cstat.isFile()) {
                    e.files[file] = cstat;
                    e.emit(change, file, cstat);
                }
                else if (change === 'delete' && pstat.isFile()) {
                    delete e.files[file];
                    e.emit(change, file, pstat);
                }
            }
        },
        next: function(err, watchers) {
            if (err !== null || watchers === null || watchers.length === 0) {
                e.emit('error', new Error('monitor failed, most likely ' + location + ' doesn\'t exist !'));
            }
            else {
                walker.walk(location).on('file', function(root, stat, next) {
                    var file = path.relative(location, path.join(root, stat.name));
                    e.files[file] = stat;
                    e.emit('create', file, stat);
                    next();
                });
            }
        }
    });

    // when a new listener registers, replay 'create' events
    e.on('newListener', function(event, listener) {
        if (event === 'create') {
            for (var file in e.files) {
                listener(file, e.files[file]);
            }
        }
    });

    return e;
};

/**
 * Destroys a monitor.
 *
 * @param {EventEmitter} a monitor
 */
module.exports.unmonitor = function(monitor) {
    if (monitor.watchr !== undefined) {
        monitor.watchr.close();
        delete monitor.watchr;
    }
};
