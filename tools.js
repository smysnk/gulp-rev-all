var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var gutil = require('gulp-util');

module.exports = function(options) {

    var filepathRegex = /.*?(?:\'|\")([a-z0-9_\-\/\.]+?\.[a-z]{2,4})(?:(?:\?|\#)[^'"]*?|)(?:\'|\").*?/ig;
    var fileMap = {};
    var hashLength = options.hashLength || 8;

    // Taken from gulp-rev: https://github.com/sindresorhus/gulp-rev
    var md5 = function (str) {
        return crypto.createHash('md5').update(str, 'utf8').digest('hex');
    };

    // Taken from gulp-rev: https://github.com/sindresorhus/gulp-rev
    var revFile = function (filePath) {
        if (fileMap[filePath]) {
          return fileMap[filePath];
        }

        var filename,
            filenameReved,
            ext = path.extname(filePath);

        if (typeof options.ignoredExtensions === 'undefined' || options.ignoredExtensions.indexOf(ext) === -1) {
            var contents = fs.readFileSync(filePath).toString();
            var hash = md5(contents).slice(0, hashLength);
            filename = path.basename(filePath, ext) + '-' + hash + ext;
        } else {
            filename = path.basename(filePath);
        }

        filePathReved = path.join(path.dirname(filePath), filename);

        fileMap[filePath] = filePathReved;
        return fileMap[filePath];
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
