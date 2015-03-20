var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var toolFactory = require('./tool');
var through = require('through2');
var chalk = require('chalk');
var gutil = require('gulp-util');
var merge = require('merge');

var RevAll = (function () {

    var tool, options;
    var firstFile = null;
    var manifest = [];
    var hash = '';

    var RevAll = function (optionsSupplied) {

        options = merge({
            'hashLength': 8,
            'ignore': [ /^\/favicon.ico$/g ],
            'fileNameVersion': 'version.json',
            'fileNameManifest': 'rev-manifest.json',
            'prefix': '',
            'cache': {},
            'dontRename': []
        }, optionsSupplied);
        tool = new toolFactory(options);

    };

    RevAll.prototype.revision = function () {

        return through.obj(function (file, enc, callback) {

            if (file.isNull()) {
                return callback(null, file);
            } else if (file.isStream()) {
                throw new Error('Streams are not supported!');
            }

            tool.revisionFile(file);

            // ignore all non-rev'd files
            if (file.path && file.revOrigPath) {
                firstFile = firstFile || file;
                manifest[tool.getRelativeFilename(file.revOrigBase, file.revOrigPath, true)] = options.prefix + tool.getRelativeFilename(file.base, file.path, true);
            }

            callback(null, file);

        }, function (callback) {

            callback();

        });

    };

    RevAll.prototype.versionFile = function () {

        return through.obj(function (file, enc, callback) {

            // Drop any existing files off the stream
            callback();

        }, function (callback) {

            var out = {
                hash: hash,
                timestamp: new Date()
            };

            this.push(new gutil.File({
                cwd: firstFile.cwd,
                base: firstFile.base,
                path: path.join(firstFile.base, fileNameVersion),
                contents: new Buffer(JSON.stringify(out, null, 2))
            }));

            callback();

        });

    };

    RevAll.prototype.manifestFile = function () {

        return through.obj(function (file, enc, callback) {

            // Drop any existing files off the stream
            callback();

        }, function (callback) {

            this.push(new gutil.File({
                cwd: firstFile.cwd,
                base: firstFile.base,
                path: path.join(firstFile.base, fileNameManifest),
                contents: new Buffer(JSON.stringify(manifest, null, 2))
            }));

            callback();

        });
    };

    RevAll.prototype.getTool = function () {

        return tool;

    };

    return RevAll;

})();

module.exports = RevAll;
