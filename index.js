var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var toolsFactory = require('./tools');
var through = require('through2');
var chalk = require('chalk');
var gutil = require('gulp-util');

module.exports = function(options) {

    options = options || {};
    var first = true;

    return through.obj(function (file, enc, callback) {

        var tools = toolsFactory(options);

        if (options.rootDir === undefined) options.rootDir = file.base;
        if (options.ignoredExtensions === undefined) options.ignoredExtensions = [];

        if (first) {
            gutil.log('gulp-rev-all:', 'Root directory [', options.rootDir, ']');
            first = !first;
        }

        if (file.isNull()) {
            return callback(null, file);
        } else if (file.isStream()) {
            throw new Error('Streams are not supported!');
        } 

        // Only process references in these types of files, otherwise we'll corrupt images etc
        switch(path.extname(file.path)) {
            case '.js':
            case '.css':
            case '.html':
                tools.revReferencesInFile(file, options.rootDir);
        }

        // Rename this file with the revion hash
        var filenameReved = path.basename(tools.revFile(file.path));
        var base = path.dirname(file.path);
        file.path = path.join(base, filenameReved);

        callback(null, file);

    });


};
