var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var tools = require('./tools');
var through = require('through2');
var chalk = require('chalk');
var gutil = require('gulp-util');

module.exports = function(options) {

    options = options || {};

    return through.obj(function (file, enc, callback) {

        if (file.isNull()) {
            callback(null, file);
            return;
        } else if (file.isStream()) {
            throw new Error('Streams are not supported!');
            callback(null, file);
            return;
        } 

        // Best way currently to detect root directory if not suppliec
        if (file.path.match('index.html') && options.rootDir === undefined) {
            options.rootDir = path.dirname(file.path);
            gutil.log('gulp-rev-all:', 'Root directory [', options.rootDir, ']');
        }

        // Only process references in these types of files, otherwise we'll corrupt images etc
        switch(path.extname(file.path)) {
            case '.js':
            case '.css':
            case '.html':
                tools.revReferencesInFile(file, options.rootDir);
        }

        var filenameReved = path.basename(tools.revFile(file.path));
        var base = path.dirname(file.path);        
        file.path = path.join(base, filenameReved);

        callback(null, file);

    });


};
