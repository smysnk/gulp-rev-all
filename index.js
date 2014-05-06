var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var toolsFactory = require('./tools');
var through = require('through2');
var chalk = require('chalk');
var gutil = require('gulp-util');

module.exports = function(options) {

    var first = true;    
    options = options || {};
    options.hashLength = options.hashLength || 8;
    options.ignore = options.ignore || options.ignoredExtensions || [ /^\/favicon.ico$/g ];

    return through.obj(function (file, enc, callback) {

        var tools = toolsFactory(options);

        if (first) {
            options.rootDir = options.rootDir || file.base;
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
                tools.revReferencesInFile(file);
        }

        // Rename this file with the revion hash if doesn't match ignore list
        if (!tools.isFileIgnored(file)) {            
            var filenameReved = path.basename(tools.revFile(file.path));
            var base = path.dirname(file.path);
            file.path = path.join(base, filenameReved);
        }

        callback(null, file);
    });


};
