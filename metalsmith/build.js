var eolMetalsmith = require('./eol-metalsmith');

eolMetalsmith()
	.build(function(err, files) {
		if (err) {
			throw err;
		}
	});
