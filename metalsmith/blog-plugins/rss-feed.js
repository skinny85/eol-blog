var latestPosts = require('./latest-posts');

function plugin() {
	return function(files, metalsmith, done) {
		setImmediate(done);

		var rssFeedPosts = latestPosts(files, 10);

		files['feed.rss'].rssFeedPosts = rssFeedPosts;
	};
}

module.exports = plugin;
