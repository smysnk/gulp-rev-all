var map = require("map-stream");
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

module.exports = function(options) {

    var filepathRegex = /.*?(?:\'|\")([a-z0-9_\-\/\.]+?\.[a-z]{2,4})(?:(?:\?|\#)[^'"]*?|)(?:\'|\").*?/ig;
    var fileMap = {};

    var count = 0;

    // Taken from gulp-rev: https://github.com/sindresorhus/gulp-rev
    var md5 = function (str) {
        return crypto.createHash('md5').update(str, 'utf8').digest('hex');
    };

    // Taken from gulp-rev: https://github.com/sindresorhus/gulp-rev
    var revFile = function (filePath) {

        if (fileMap[filePath]) 
            return fileMap[filePath];

        var contents = fs.readFileSync(filePath).toString();

        var hash = md5(contents).slice(0, 8);
        var ext = path.extname(filePath);
        var filename = path.basename(filePath, ext) + '-' + hash + ext;
        var filePathReved = path.join(path.dirname(filePath), filename);

        fileMap[filePath] = filePathReved;
        return fileMap[filePath];

    };

    var revReferencesInFile = function (file) {

        var replaceMap = {};

        // Create a map of file references and their proper revisioned name
        var contents = String(file.contents);
        var result;
        while (result = filepathRegex.exec(contents)) {

            // Skip if we've already resolved this reference
            if (replaceMap[result[1]] != undefined) continue;
            replaceMap[result[1]] = false;

            var base = path.dirname(file.path);

            // In the case where the referenced file is relative to the file being processed
            var fullpath = path.join(base, result[1]);
            if (fs.existsSync(fullpath)) {                
                replaceMap[result[1]] = path.dirname(result[1]) + '/' + path.basename(revFile(fullpath));
            }

            // In the case where the file referenced is relative to the base path
            var fullpath = path.join(file.base, result[1]);
            if (fs.existsSync(fullpath)) {
                replaceMap[result[1]] = path.dirname(result[1]) + '/' + path.basename(revFile(fullpath));
            }

        }

        for (var key in replaceMap) {

            if (!replaceMap[key]) continue;
            contents = contents.replace(key, replaceMap[key]); 

        }

        file.contents = new Buffer(contents); // Update file contents with new reved references

    };

    return map(function (file, callback) {

        if (file.isNull()) {
            callback(null, file);
            return;
        } else if (file.isStream()) {
            this.emit('error', 'Streams are not supported!');
            callback(null, file);
            return;
        } else if (file.stat.isDirectory()) {
            callback(null, file);
            return;
        }

        revReferencesInFile(file);

        var filenameReved = path.basename(revFile(file.path));
        var base = path.dirname(file.path);        
        file.path = path.join(base, filenameReved);

        callback(null, file);

    });

};
