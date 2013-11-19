var log = require('winston');

/**
 * Parse filename/directory to extract information for name and season.
 * 
 * @param {string} the file name
 * @return {object} the show info, or null if parsing failed
 **/
module.exports.parse = function(file) {
    var res;
    var info = {};

    // For shows that have normal S??E?? (with extr E?? for 2 episodes in 1)
    if (res = /(.*)\.S(\d\d)E(\d\d)(E(\d\d))?\..*/i.exec(file)) {
        info.show = res[1];
        info.season = res[2];
        info.episode = res[5] || res[3];
        log.info('debug', 'Matched on (.*)\\.S(\\d\\d)E(\\d\\d)(E(\\d\\d))?\\..*');
    }
    else
    // for shows that have only one season (no season number in the title)
    if (res = /(.*)\.E(\d\d)\..*/i.exec(file)) {
        info.show = res[1];
        info.season = res[2];
        info.episode = res[3];
        log.info('debug', 'Matched on (.*)\\.E(\\d\\d)');
    }
    else if (res = /(.*)\.(\d{1,2})(\d\d)\..*/i.exec(file)) {
        info.show = res[1];
        info.season = res[2];
        info.episode = res[3];
        log.info('debug', 'Matched on (.*)\\.(\\d{1,2})(\\d\\d)\\..*');
    }
    else
    // special case for shows that run daily, with year.month.day format
    if (res = /(The\.Colbert\.Report|The\.Daily\.Show)\.(\d{4}.\d{2})\.(\d{2})/i.exec(file)) {
        info.show = res[1];
        info.season = res[2];
        info.episode = res[3];
        log.info('debug', 'Matched on (The\\.Colbert\\.Report|The\\.Daily\\.Show)\\.(\\d{4}.\\d{2})\\.(\\d{2})');
    }

    // extract file type from extension
    if (res = /\.(...)$/.exec(file)) {
        switch (res[1].toLowerCase()) {
        case 'mkv':
            info.type = "x264";
            break;
        case 'avi':
            info.type = "XviD";
            break;
        case 'mp4':
            info.type = "MP4";
            break;
        }
    }

    // Make sure every attribute has been found
    return ['show', 'season', 'episode', 'type'].every(function(attr) {
        if (info[attr] === undefined) {
            log.info('error', 'Could not parse ' + file + '. Missing ' + attr + ' !');
            return false;
        }
        return true;
    }) ? info : null;
};
