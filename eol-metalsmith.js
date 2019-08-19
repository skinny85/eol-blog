var Metalsmith  = require('metalsmith');
var Handlebars  = require('handlebars');
var Marked      = require('marked');
var markdown    = require('metalsmith-markdown');
var prism       = require('metalsmith-prism');
var layouts     = require('metalsmith-layouts');
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

var markedRenderer = new Marked.Renderer();
markedRenderer.link = function(href, title, text) {
  var titlePart = title ? ' title="' + title + '"' : '';
  var targetPart = href.startsWith('http') ? ' target="_blank"' : '';

  return '<a href="' + href + '"' + titlePart + targetPart + '>' +
    text +
  '</a>';
};
// add the language- class to every inline code span,
// so that Prism's CSS can highlight it
markedRenderer.codespan = function (contents) {
  // shell-session seems like the most neutral default
  return '<code class="language-shell-session">' + contents + '</code>';
};

var production = process.env.NODE_ENV === 'production';

function eolMetalsmith() {
  return Metalsmith(__dirname)
    .metadata({
      production: production,
    })
    .source('./src')
    .destination('./build')
    .clean(true)
    .use(markdown({
      renderer: markedRenderer,
      langPrefix: 'language-',
    }))
    .use(prism({
        decode: true,
        preLoad: ['java', 'scala', 'kotlin', 'docker'],
    }))
    .use(elevate({
      pattern: 'articles/*/*.html',
      depth: -2,
    }))
    .use(paths())
    .use(homePage())
    .use(archivePage())
    .use(rssFeed())
    .use(nested({
      directory: 'layouts',
      generated: 'generated-layouts',
    }))
    .use(layouts({
      engine: 'handlebars',
      directory: 'generated-layouts',
    }))
    .use(assets({
      source: "./public/images",
      destination: "./assets",
    }))
    .use(assets({
      source: "./public/css",
      destination: "./assets",
    }))
    .use(assets({
      source: "./public/js",
      destination: "./assets",
    }))
    .use(assets({
      source: "./public/img",
      destination: "./img",
    }));
}

module.exports = eolMetalsmith;
