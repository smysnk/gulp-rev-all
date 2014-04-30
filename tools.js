var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var gutil = require('gulp-util');

module.exports = function(options) {

    var filepathRegex = /.*?(?:\'|\")([a-z0-9_\-\/\.]+?\.[a-z]{2,4})(?:(?:\?|\#)[^'"]*?|)(?:\'|\").*?/ig;
    var hashLength = options.hashLength || 8;

    var revFile = function (file) {
        var ext = path.extname(file.path);

        if (options.ignoredExtensions && options.ignoredExtensions.indexOf(ext) !== -1)
            return;

        var hash = crypto.createHash('md5').update(file.contents).digest('hex');
        var filename = path.basename(file.path, ext) + '-' + hash.slice(0, hashLength) + ext;

        file.path = path.join(path.dirname(file.path), filename);
    };

    var revReferencesInFile = function (file, rootDir) {

        var replaceMap = {};
        rootDir = rootDir || path.dirname(file.path);

        gutil.log('gulp-rev-all:', 'Finding references in [', file.path, ']');
        // Create a map of file references and their proper revisioned name
        var contents = String(file.contents);
        var result;
        while (result = filepathRegex.exec(contents)) {

            // Skip if we've already resolved this reference
            if (typeof replaceMap[result[1]] !== 'undefined') continue;
            replaceMap[result[1]] = false;

            // In the case where the referenced file is relative to the base path
            if (rootDir) {
                var fullpath = path.join(rootDir, result[1]);
                if (fs.existsSync(fullpath)) {
                    replaceMap[result[1]] = path.dirname(result[1]) + '/' + path.basename(revFile(fullpath));
                    gutil.log('gulp-rev-all:', 'Found root reference [', result[1], '] -> [', replaceMap[result[1]], ']');
                    continue;
                }
            }

            // In the case where the file referenced is relative to the file being processed
            var fullpath = path.join(file.base, result[1]);
            if (fs.existsSync(fullpath)) {
                replaceMap[result[1]] = path.dirname(result[1]) + '/' + path.basename(revFile(fullpath));
                gutil.log('gulp-rev-all:', 'Found relative reference [', result[1], '] -> [', replaceMap[result[1]], ']');
                continue;
            }

        }

        for (var key in replaceMap) {
            if (!replaceMap[key]) continue;
            contents = contents.replace(key, replaceMap[key]);
        }

        file.contents = new Buffer(contents); // Update file contents with new reved references

    };

    return {
        revFile: revFile,
        revReferencesInFile: revReferencesInFile
    };

};
