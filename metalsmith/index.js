var Metalsmith  = require('metalsmith');
var markdown    = require('metalsmith-markdown');
var layouts     = require('metalsmith-layouts');
var permalinks  = require('metalsmith-permalinks');
var elevate     = require('metalsmith-elevate');
var nested      = require('metalsmith-nested');
var assets      = require('metalsmith-assets');
// var flatten     = require('./blog-plugins/flatten');

Metalsmith(__dirname)
  .metadata({
    title: "My Static Site & Blog",
    description: "It's about saying »Hello« to the World.",
    generator: "Metalsmith",
    url: "http://www.metalsmith.io/"
  })
  .source('./src')
  .destination('./build')
  .clean(true)
  .use(markdown())
  // .use(permalinks())
  .use(nested())
  .use(layouts({
    engine: 'handlebars'
  }))
  .use(elevate({
    pattern: 'articles/*/*.html',
    depth: -2,
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
  .build(function(err, files) {
    if (err) { throw err; }
  });
