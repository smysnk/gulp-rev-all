var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var toolFactory = require('./tool');
var through = require('through2');
var chalk = require('chalk');
var gutil = require('gulp-util');

module.exports = function(options, cb) {

    var first = true;    
    options = options || {};
    options.hashLength  = options.hashLength || 8;
    options.ignore = options.ignore || options.ignoredExtensions || [ /^\/favicon.ico$/g ];

    var tool = toolFactory(options);

    var stream = through.obj(function (file, enc, callback) {

      if (first) {
        options.dirRoot = (options.dirRoot && options.dirRoot.replace(/[\\/]$/, "")) || file.base.replace(/[\\/]$/, "");
        gutil.log('gulp-rev-all:', 'Root directory [', options.dirRoot, ']');
        first = !first;
      }

      if (file.isNull()) {
        return callback(null, file);
      } else if (file.isStream()) {
        throw new Error('Streams are not supported!');
      }

      tool.revisionFile(file);

      callback(null, file);
    });

    if (cb) {
      stream.on('end', function() {
        cb()
      });
    }

    return stream;


};
