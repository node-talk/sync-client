var inotify = require('inotify'),
    Inotify = inotify.Inotify,
    path = require('path'),
    util = require('util'),
    walker = require('walk'),
    log = require('winston'),
    fs = require('fs'),
    events = require('events');

/**
 * Creates a new watcher.
 *
 * @constructor
 * @extends events.EventEmitter
 * @param {string} root The directory to watch
 */
var Watcher = function(root) {
    Watcher.super_.call(this);

    this._root = path.normalize(root);
    this._inotify = new Inotify();
    this._watches = {};
    this._files = {};

    this.on('newListener', this._replay.bind(this));

    this._watch(this._root);
};
util.inherits(Watcher, events.EventEmitter);

/**
 * Recursively watches the given directory and notifies an update for every
 * nested file.
 *
 * @private
 * @param {string} directory The directory to recursively watch
 */
Watcher.prototype._watch = function(directory) {
    var self = this;

    // watch directory
    this._addWatch(directory);

    // recursively watch subdirectories and notify existing files
    walker.walk(directory).on('directory', function(root, stat, next) {
        self._addWatch(path.join(root, stat.name));
        next();
    }).on('file', function(root, stat, next) {
        var file = path.join(root, stat.name);
        self._update(file, stat);
        next();
    });
};

/**
 * Watches the given directory.
 *
 * @private
 * @param {string} directory The directory to watch
 */
Watcher.prototype._addWatch = function(directory) {
    log.info('watching directory', directory);

    var wd = this._inotify.addWatch({
        path: directory,
        watch_for: Inotify.IN_CLOSE_WRITE | Inotify.IN_CREATE | Inotify.IN_DELETE | Inotify.IN_MOVED_FROM | Inotify.IN_MOVED_TO,
        callback: this._onEvent.bind(this)
    });
    this._watches[wd] = {
        directory: directory,
        watch: wd
    };
};

/**
 * Recursively unwatches the given directory and notifies a delete for every
 * nested file.
 *
 * @private
 * @param {string} directory The directory to recursively unwatch
 */
Watcher.prototype._unwatch = function(directory) {
    var prefix = directory + '/';

    // unwatch directory and subdirectories
    for (var wd in this._watches) {
        if (this._watches[wd].directory === directory || this._watches[wd].directory.indexOf(prefix) === 0) {
            this._removeWatch(this._watches[wd].watch, false);
        }
    }

    // notify deletions
    for (var file in this._files) {
        if (file.indexOf(prefix) === 0) {
            this._delete(file);
        }
    }
};

/**
 * Unwatches the given directory.
 *
 * @private
 * @param {number} wd The watch descriptor to unwatch
 * @param {boolean} auto When set to true, it means that the watch has been
 * automatically removed by inotify and we only have to clean our stuff
 */
Watcher.prototype._removeWatch = function(wd, auto) {
    var descriptor = this._watches[wd];
    if (descriptor === undefined) {
        return;
    }
    log.info('unwatching directory', descriptor.directory);

    if (!auto) {
        this._inotify.removeWatch(wd);
    }
    delete this._watches[wd];
};

/**
 * Fires a file creation event.
 *
 * @private
 * @param {string} file The created file
 */
Watcher.prototype._create = function(file) {
    log.debug('firing create', file);
    this.emit('create', file);

    // when hardlinking, consider this as an instantaneous create/write
    var stat = fs.statSync(file);
    if (stat.nlink > 1) {
        this._update(file, stat);
    }
};

/**
 * Fires a file update event.
 *
 * @private
 * @param {string} file The updated file
 * @param {fs.Stats} stat The file stat (when undefined, this method will
 * synchronously retrieve it)
 */
Watcher.prototype._update = function(file, stat) {
    if (stat === undefined) {
        stat = fs.statSync(file);
    }
    this._files[file] = stat;

    log.debug('firing update', file);
    this.emit('update', file, stat);
};

/**
 * Fires a file deletion event.
 *
 * @private
 * @param {string} file The deleted file
 */
Watcher.prototype._delete = function(file) {
    var stat = this._files[file];
    if (stat !== undefined) {
        delete this._files[file];

        log.debug('firing delete', file);
        this.emit('delete', file);
    }
};

/**
 * Replays creation and update events for new listeners.
 *
 * @private
 * @param {string} event The event to replay
 * @param {Function} listener The new listener
 */
Watcher.prototype._replay = function(event, listener) {
    for (var file in this._files) {
        if (typeof this._files[file] === 'boolean' && event === 'create') {
            listener(file);
        }
        else if (event === 'update') {
            listener(file, this._files[file]);
        }
    }
};

/**
 * Converts an event to the path of the file that triggered this event.
 *
 * @private
 * @param {Object} event The inotify event
 * @return {string} the path of the file that triggered this event
 */
Watcher.prototype._toPath = function(event) {
    var descriptor = this._watches[event.watch];
    if (descriptor !== undefined) {
        return path.join(descriptor.directory, event.name);
    }
    else {
        log.warn('can\'t convert event to path, unknown wd', event);
        return undefined;
    }
};

/**
 * The inotify event listener.
 *
 * @private
 * @param {Object} event The inotify event
 */
Watcher.prototype._onEvent = function(event) {
    if (event.mask & Inotify.IN_CLOSE_WRITE) {
        log.debug('IN_CLOSE_WRITE', event);

        // fire update
        this._update(this._toPath(event), undefined);
    }
    else if (event.mask & Inotify.IN_CREATE) {
        log.debug('IN_CREATE', event);

        // watch new directory
        if (event.mask & Inotify.IN_ISDIR) {
            this._addWatch(this._toPath(event));
        }
        // fire create
        else {
            this._create(this._toPath(event));
        }
    }
    else if (event.mask & Inotify.IN_DELETE) {
        log.debug('IN_DELETE', event);

        // fire delete
        if ((event.mask & Inotify.IN_ISDIR) === 0) {
            this._delete(this._toPath(event));
        }
    }
    else if (event.mask & Inotify.IN_MOVED_FROM) {
        log.debug('IN_MOVED_FROM', event);

        // unwatch moved away directory
        if (event.mask & Inotify.IN_ISDIR) {
            this._unwatch(this._toPath(event));
        }
        // fire delete
        else {
            this._delete(this._toPath(event));
        }
    }
    else if (event.mask & Inotify.IN_MOVED_TO) {
        log.debug('IN_MOVED_TO', event);

        // watch moved in directory
        if (event.mask & Inotify.IN_ISDIR) {
            this._watch(this._toPath(event));
        }
        // fire create
        else {
            this._create(this._toPath(event));
        }
    }
    else if (event.mask & Inotify.IN_IGNORED) {
        log.debug('IN_IGNORED', event);

        // cleanup
        this._removeWatch(event.watch, true);
    }
    else {
        log.warn('unexpected event', event);
    }
};

/**
 * Closes the watcher object.
 */
Watcher.prototype.close = function() {
    this._inotify.close();
};

/**
 * Exports the Watcher class.
 */
module.exports.Watcher = Watcher;

/**
 * Watches a location for file creation, deletion or modifications. The method
 * returns an event emitter which sends 3 different events:
 *  - 'create': when a new file is created (argument: the file)
 *  - 'delete': when a file is deleted (argument: the file)
 *  - 'update': when a file is updated (argument: the file and its stats)
 *
 * Note that upon registration, the watcher sends an 'update' event for every
 * existing file.
 *
 * When done, the watcher can be closed using its close() method and safely
 * discarded.
 *
 * @param {string} location The location to watch
 * @return {Watcher} the watcher
 */
module.exports.watch = function(location) {
    return new Watcher(location);
};
