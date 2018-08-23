var Metalsmith  = require('metalsmith');
var Handlebars  = require('handlebars');
var markdown    = require('metalsmith-markdown');
var layouts     = require('metalsmith-layouts');
// var permalinks  = require('metalsmith-permalinks');
var paths       = require('metalsmith-paths');
var elevate     = require('metalsmith-elevate');
var nested      = require('metalsmith-nested');
var assets      = require('metalsmith-assets');
var dateFormat  = require('dateformat');
var homePage    = require('./blog-plugins/home-page');
var archivePage = require('./blog-plugins/archive-page');
var rssFeed     = require('./blog-plugins/rss-feed');

Handlebars.registerHelper('articleDate', function(date) {
  return dateFormat(date, 'UTC:yyyy/mm/dd');
});

Handlebars.registerHelper('articleDateElement', function(date) {
  var monthNr = dateFormat(date, 'UTC:mm');
  var monthAbbr = dateFormat(date, 'UTC:mmm');
  var dayNr = dateFormat(date, 'UTC:dd');
  var year = dateFormat(date, 'UTC:yyyy');

  return '<div class="entry-summary-date">' +
    '<div class="date-inside">' +
      '<div class="date-month">' +
        monthNr + ' (' + monthAbbr + ')' +
      '</div>' +
      '<div class="date-day">' + dayNr + '</div>' +
      '<div class="date-year">' + year + '</div>' +
    '</div>' +
  '</div>';
});

Metalsmith(__dirname)
  .source('./src')
  .destination('./build')
  .clean(true)
  .use(markdown())
  // .use(permalinks())
  .use(elevate({
    pattern: 'articles/*/*.html',
    depth: -2,
  }))
  .use(paths())
  .use(homePage())
  .use(archivePage())
  .use(rssFeed())
  .use(nested())
  .use(layouts({
    engine: 'handlebars'
  }))
  .use(assets({
    source: "./public/img",
    destination: "./assets",
  }))
  .use(assets({
    source: "./public/css",
    destination: "./assets",
  }))
  .use(assets({
    source: "./public/fonts",
    destination: "./assets",
  }))
  .use(assets({
    source: "./public/js",
    destination: "./assets",
  }))
  .build(function(err, files) {
    if (err) { throw err; }
  });
