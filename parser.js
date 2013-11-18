log = require('winston'),

/**
 * Parse filename/directory to extract information for name and season.
 * 
 * @filename
 **/

module.exports.parse = function(file) {
	var res = {};
	var info = {};
	/* For shows that have only one season (no season number in the title) */
	if (res = /(.*)\.E(\d\d)\..*/i.exec(file)) { 
		info.show = res[1];
		info.season = res[2];
		info.episode = res[3];
	}
	if (res = /(.*)\.(\d{1,2})(\d\d)\..*/i.exec(file)) {
		info.show = res[1];
		info.season = res[2];
		info.episode = res[3];
	}
	/* For shows that have normal S??E?? (with extra E?? for 2 episodes in 1) */
	if (res = /(.*)\.S(\d\d)E(\d\d)(E(\d\d))?\..*/i.exec(file)) {
		info.show = res[1];
		info.season = res[2];
		if (undefined == res[5]) { info.episode = res[3]; } 
		else { info.episode = res[5]; }
	}
	/* Special case for shows that run daily, with year.month.day format */
	if (res = /(The\.Colbert\.Report|The\.Daily\.Show)\.(\d{4}.\d{2})\.(\d{2})/i.exec(file)) { 
		info.show = res[1];
		info.season = res[2];
		info.episode = res[3];
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
