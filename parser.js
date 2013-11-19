var log = require('winston'),

/**
 * Parse filename/directory to extract information for name and season.
 * 
 * @filename
 **/

module.exports.parse = function(file) {
	var res;
	var info = {};
	var extension = {};
	/* For shows that have normal S??E?? (with extr E?? for 2 episodes in 1) */
	if (res = /(.*)\.S(\d\d)E(\d\d)(E(\d\d))?\..*/i.exec(file)) {
		info.show = res[1];
		info.season = res[2];
		info.episode = res[5] || res[3]; 
		log.info('debug','Matched on (.*)\.S(\d\d)E(\d\d)(E(\d\d))?\..*')
	} else 
	/* For shows that have only one season (no season number in the title) */
	if (res = /(.*)\.E(\d\d)\..*/i.exec(file)) { 
		info.show = res[1];
		info.season = res[2];
		info.episode = res[3];
		log.info('debug','Matched on (.*)\.E(\d\d)')
	} else
	if (res = /(.*)\.(\d{1,2})(\d\d)\..*/i.exec(file)) {
		info.show = res[1];
		info.season = res[2];
		info.episode = res[3];
		log.info('debug','Matched on (.*)\.(\d{1,2})(\d\d)\..*')
	} else 
	/* Special case for shows that run daily, with year.month.day format */
	if (res = /(The\.Colbert\.Report|The\.Daily\.Show)\.(\d{4}.\d{2})\.(\d{2})/i.exec(file)) { 
		info.show = res[1];
		info.season = res[2];
		info.episode = res[3];
		log.info('debug','Matched on (The\.Colbert\.Report|The\.Daily\.Show)\.(\d{4}.\d{2})\.(\d{2})')
	}
	res = /\.(...)$/.exec(file);
	extension = res[1]; 
	switch(extension) {
		case 'mkv': info.type = "x264"; break;
		case 'avi': info.type = "XviD"; break;
		case 'mp4': info.type = "MP4"; break;
	}

	if (undefined == info.show) { 
		log.info('error','Could not parse ' + file) 
	}
	else { 
		info.show = info.show.replace(/\./g, ' ');
		log.info('debug', info); 
		return info;
	}

}
