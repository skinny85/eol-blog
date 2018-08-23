var dateFormat = require('dateformat');

function plugin() {
	return function(files, metalsmith, done) {
		setImmediate(done);

		var startingYear = 2014;
		var lastYear = new Date().getFullYear();

		var ret = [];
		for (var year = startingYear; year <= lastYear; year++) {
			var thisYear = [];
			Object.keys(files).forEach(function(fileKey) {
				var file = files[fileKey];
				if (file.created_at && file.created_at.getFullYear() === year) {
					thisYear.push(file);
				}
			});

			if (thisYear.length > 0) {
				var yearObject = {
					year: year,
					months: [],
				};
				for (var month = 0; month < 12; month++) {
					var thisMonth = [];
					for (var i = 0; i < thisYear.length; i++) {
						var file = thisYear[i];
						if (file.created_at.getMonth() === month) {
							thisMonth.push(file);
							file.createdAtDay = dateFormat(file.created_at, 'UTC:dd');
						}
					}

					if (thisMonth.length > 0) {
						yearObject.months.push({
							month: {
								name: dateFormat(thisMonth[0].created_at, 'UTC:mmmm'),
								number: dateFormat(thisMonth[0].created_at, 'UTC:mm'),
							},
							articles: thisMonth,
						});
					}
				}

				ret.push(yearObject);
			}
		}

		files['archive.html'].years = ret;
	}
}

module.exports = plugin;
