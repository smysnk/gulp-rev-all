var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var toolFactory = require('./tool');
var through = require('through2');
var chalk = require('chalk');
var gutil = require('gulp-util');

module.exports = function(options) {

    var first = true;    
    options = options || {};
    options.hashLength  = options.hashLength || 8;
    options.fileExt     = options.fileExt || ['.js', '.css', '.html', '.jade'];
    options.ignore = options.ignore || options.ignoredExtensions || [ /^\/favicon.ico$/g ];

    var tool = toolFactory(options);

    return through.obj(function (file, enc, callback) {

        if (first) {
            options.dirRoot = options.dirRoot || file.base;
            gutil.log('gulp-rev-all:', 'Root directory [', options.dirRoot, ']');
            first = !first;
        }

        if (file.isNull()) {
            return callback(null, file);
        } else if (file.isStream()) {
            throw new Error('Streams are not supported!');
        } 

        var ext = path.extname(file.path);

        if (options.fileExt.indexOf(ext) !== -1) {
            tool.revReferencesInFile(file);
        }

        // Rename this file with the revion hash if doesn't match ignore list
        if (!tool.isFileIgnored(file)) {            
            var filenameReved = path.basename(tool.revFile(file.path));
            var base = path.dirname(file.path);
            file.path = tool.joinPath(base, filenameReved);
        }

        callback(null, file);
    });


};
