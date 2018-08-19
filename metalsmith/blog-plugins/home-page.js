var latestPosts = require('./latest-posts');

function plugin() {
	return function(files, metalsmith, done) {
		setImmediate(done);

		var homePagePosts = latestPosts(files, 3);

		files['index.html'].homePagePosts = homePagePosts;
	};
}

module.exports = plugin;
