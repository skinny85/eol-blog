var dateFormat = require('dateformat');

function plugin() {
    return function (files, metalsmith, done) {
        setImmediate(done);

        if (!files['archive.html'])
            return;

        var startingYear = 2014;
        var lastYear = new Date().getFullYear();

        var ret = [];
        for (var year = lastYear; year >= startingYear; year--) {
            var thisYear = [];
            Object.keys(files).forEach(function (fileKey) {
                var file = files[fileKey];
                if (file.created_at && file.created_at.getFullYear() === year) {
                    thisYear.push(file);
                }
            });

            if (thisYear.length > 0) {
                var yearObject = {
                    year: year,
                    articles: [],
                };
                for (var month = 11; month >= 0; month--) {
                    var thisMonth = [];
                    for (var i = 0; i < thisYear.length; i++) {
                        var file = thisYear[i];
                        if (file.created_at.getMonth() === month) {
                            thisMonth.push(file);
                        }
                    }

                    // sort articles by day, descending
                    thisMonth.sort(function (file1, file2) {
                        return -(file1.created_at.getDate() - file2.created_at.getDate());
                    });

                    // add all articles from the given month to the year's collection
                    for (var i = 0; i < thisMonth.length; i++) {
                        yearObject.articles.push({
                            articleDate: {
                                monthName: dateFormat(thisMonth[i].created_at, 'UTC:mmmm'),
                                day: dateFormat(thisMonth[i].created_at, 'UTC:dd'),
                            },
                            article: thisMonth[i],
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
