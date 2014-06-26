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
    options.hashLength  = options.hashLength || 8;
    options.fileExt     = options.fileExt || ['.js', '.css', '.html', '.jade'];
    options.ignore = options.ignore || options.ignoredExtensions || [ /^\/favicon.ico$/g ];

    var tools = toolsFactory(options);

    return through.obj(function (file, enc, callback) {

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

        var ext = path.extname(file.path);

        if (options.fileExt.indexOf(ext) !== -1) {
            tools.revReferencesInFile(file);
        }

        // Rename this file with the revion hash if doesn't match ignore list
        if (!tools.isFileIgnored(file)) {            
            var filenameReved = path.basename(tools.revFile(file.path));
            var base = path.dirname(file.path);
            file.path = tools.joinPath(base, filenameReved);
        }

        callback(null, file);
    });


};
