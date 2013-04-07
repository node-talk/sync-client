var watchr = require('watchr'),
    walker = require('walk'),
    path = require('path'),
    events = require('events');

/**
 * Monitors a location for file creation or deletion. The method returns an
 * event emitter which sends 2 different events:
 *  - 'create': when a new file is created
 *  - 'delete': when a file is deleted
 * Note that upon initialization, the monitor sends a 'create' event for every
 * existing file.
 *
 * @param {string} the location to monitor
 * @return {EventEmitter} the monitor
 */
module.exports.monitor = function(location) {
    var e = new events.EventEmitter();
    location = path.normalize(location);

    // some callbacks are synchronous, postpone everything to give a chance to register
    process.nextTick(function() {
        e.watchr = watchr.watch({
            path: location,
            listeners: {
                change: function(change, path, cstat, pstat) {
                    var stat = cstat || pstat;
                    if ((change === 'create' || change === 'delete') && stat.isFile()) {
                        // a file has been created or deleted !
                        e.emit(change, path, stat);
                    }
                }
            },
            next: function(err, watchers) {
                if (err !== null || watchers === null || watchers.length === 0) {
                    // watch didn't work...
                    e.emit('error', new Error('monitor failed, most likely ' + location + ' doesn\'t exist !'));
                }
                else {
                    // we're ready to go !
                    e.emit('ready', location, null);
                    // emit initial create event for existing files !
                    walker.walk(location).on('file', function(root, stat, next) {
                        e.emit('create', path.join(root, stat.name), stat);
                        next();
                    });
                }
            }
        });
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
