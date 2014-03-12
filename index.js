var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var tools = require('./tools');
var through = require('through2');
var chalk = require('chalk');
var gutil = require('gulp-util');

module.exports = function(options) {

    var first = true;
    options = options || {};
    options.rootDir = options.rootDir || path.dirname(file.path);

    return through.obj(function (file, enc, callback) {

        if (first) {
            first = false;
            gutil.log('gulp-rev-all:', 'Root directory [', options.rootDir, ']');
            
        }

        if (file.isNull()) {
            callback(null, file);
            return;
        } else if (file.isStream()) {
            throw new Error('Streams are not supported!');
            callback(null, file);
            return;
        } 

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
