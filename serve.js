var path          = require('path');
var watch         = require('metalsmith-watch');
var express       = require('metalsmith-express');
var serveStatic   = require('serve-static');
var eolMetalsmith = require('./eol-metalsmith');

eolMetalsmith()
    .use(express({
        port: 8080,
        middleware: [
            serveStatic(path.join(__dirname, 'build'), {
                extensions: ['html'],
            }),
            // 404 catch-all handler
            function (req, res) {
                res.status(404).sendFile(path.join(__dirname, 'build', '404.html'));
            },
        ],
    }))
    .use(watch({
        paths: {
            "${source}/**/*.md": "**/*.md",
            "layouts/*": "**/*.md",
        },
        livereload: true,
    }))
    .build(function (err, files) {
        if (err) {
            throw err;
        }
    });
