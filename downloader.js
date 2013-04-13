var path = require('path'),
    util = require('util'),
    fs = require('fs'),
    url = require('url'),
    async = require('async'),
    request = require('request'),
    log = require('winston');

/**
 * Creates a new download.
 *
 * @constructor
 * @param {string} file The file where to download the file
 * @param {string} location The location where to download file from
 * @param {fs.Stat} stat The remote file stat
 */
var Download = function(file, location, stat) {
    this.file = file;
    this.location = location;
    this.stat = stat;
};

/**
 * Creates a new downloader.
 *
 * @constructor
 * @extends events.EventEmitter
 * @param {string} location The location where to download files
 * @param {number} workers The number of concurrent downloads
 */
var Downloader = function(location, workers) {
    this._location = path.normalize(location);
    this._downloads = {};
    this._queue = async.queue(this._downloadIfNeeded.bind(this), workers || 3);
};

/**
 * Exports the downloader class.
 */
module.exports.Downloader = Downloader;

/**
 * Downloads a file if it doesn't already exist with the same file size.
 *
 * @private
 * @param {Download} download The download
 * @param {Function} callback The function to be called when the download completes
 */
Downloader.prototype._downloadIfNeeded = function(download, callback) {
    var self = this;
    var file = download.file;

    // check if file exists
    fs.exists(file, function(exists) {
        if (exists) {
            // check if file is complete
            fs.stat(file, function(err, stat) {
                if (stat.size != download.stat.size) {
                    log.info('size changed, downloading', {
                        file: file,
                        size: stat.size,
                        expected: download.stat.size
                    });
                    // download...
                    self._download(download, self._downloadIfNeeded.bind(self, download, callback));
                }
                else {
                    // download complete
                    log.info('download complete', {
                        file: file,
                        size: stat.size
                    });
                    // callback...
                    callback();
                }
            });
        }
        else {
            log.info('new file, downloading', {
                file: file,
                size: download.stat.size
            });
            // download...
            self._download(download, self._downloadIfNeeded.bind(self, download, callback));
        }
    });
};

/**
 * Downloads a file.
 *
 * @private
 * @param {Download} download The download
 * @param {Function} callback The function to be called when the download completes
 */
Downloader.prototype._download = function(download, callback) {
    // create directories
    mkdirParent(path.dirname(download.file), function() {
        // download file
        request(download.location, callback).pipe(fs.createWriteStream(download.file));
    });
};

/**
 * A recursive mkdir.
 *
 * @param {string} dir The directory to create
 * @param {Function} callback The function to call when the directory has been created
 */
var mkdirParent = function(dir, callback) {
    var parent = path.dirname(dir);
    fs.exists(parent, function(exists) {
        if (exists) {
            fs.mkdir(dir, callback);
        }
        else {
            mkdirParent(parent, function() {
                fs.mkdir(dir, callback);
            });
        }
    });
};

/**
 * When a download finishes, this function is called.
 *
 * @private
 * @param {Download} download The download that finished
 */
Downloader.prototype._finish = function(download) {
    // remove the download
    delete this._downloads[download.file];
};

/**
 * Starts a remote file download.
 *
 * @param {string} location The file location
 * @param {fs.Stats} stat The remote file stat
 */
Downloader.prototype.download = function(location, stat) {
    var file = path.join(this._location, url.parse(location).pathname);

    // check if this file is already being processed
    if (this._downloads[file] !== undefined) {
        // update to latest stat
        this._downloads[file].stat = stat;
        // let the download happen
        return;
    }

    // start the download
    var download = this._downloads[file] = new Download(file, location, stat);
    log.info('starting download', {
        file: file,
        location: location,
        size: stat.size
    });
    this._queue.push(download, this._finish.bind(this, download));
};

/**
 * Creates a new downloader.
 *
 * @param {string} location The location where to download files
 * @return {Downloader} the downloader
 */
module.exports.downloader = function(location) {
    return new Downloader(location);
};
