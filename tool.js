var fs = require('graceful-fs');
var path = require('path');
var crypto = require('crypto');
var gutil = require('gulp-util');

module.exports = function(options) {

    var filepathRegex = /.*?(?:\'|\"|\()([a-z0-9_@\-\/\.]+?\.[a-z]{2,4})(?:(?:\?|\#)[^'")]*?|)(?:\'|\"|\)).*?/ig;
    var cache = {};

    var joinUrlPath = function (prefix, path) {
        prefix = prefix.replace(/\/$/, '');
        path = path.replace(/^\//, '');
        return [ prefix, path ].join('/');
    }

    // Fix slash style for our poor windows brothern
    var joinPath = function (directory, filename) {
        return path.join(directory, filename).replace('\\', '/');
    }

    var getRevisionFilename = function (file) {

        // Resolve revisioned filename
        var hash = cache[file.path].hash;
        var ext =  path.extname(file.path);
        var filename;
        if (options.transformFilename) {
            filename = options.transformFilename.call(this, file, hash);
        } else {
            filename = path.basename(file.path, ext) + '.' + hash.substr(0, options.hashLength) + ext;
        }

        return filename;

    }

    // Taken from gulp-rev: https://github.com/sindresorhus/gulp-rev
    var md5 = function (str) {
        return crypto.createHash('md5').update(str, 'utf8').digest('hex');
    };

    var getReplacement = function (reference, file, isRelative) {

        var newPath = joinPath(path.dirname(reference), getRevisionFilename(file, cache[file.path].hash));

        if (options.transformPath) {
            newPath = options.transformPath.call(this, newPath, reference, file, isRelative);
        } else if (!isRelative && options.prefix) {
            newPath = this.joinUrlPath(options.prefix, newPath);
        }

        var msg = isRelative ? 'relative' : 'root';
        gutil.log('gulp-rev-all:', 'Found', msg, 'reference [', reference, '] -> [', newPath, ']');

        return newPath;

    };

    var md5Dependency = function (file) {

        if (typeof cache[file.path] === 'undefined') {
            cache[file.path] = {
                file: file,
                referenceMap: {}
            };
        }

        gutil.log('gulp-rev-all:', 'Finding references in [', file.path, ']');
        
        // Create a map of file references and their proper revisioned name
        var contents = String(file.contents);
        var hash = md5(file.contents);
        var result;

        while (result = filepathRegex.exec(contents)) {
            var reference = result[1];

            // Don't do any work if we've already resolved this reference
            if (cache[file.path].referenceMap[reference]) {
                hash += cache[file.path].referenceMap[reference].hash;
                continue;
            }

            var referencePaths = [joinPath(options.dirRoot, reference), joinPath(path.dirname(file.path), reference)];
            for (var i = referencePaths.length; i--;) {
                var referencePath = referencePaths[i];

                // Stop if we've already resolved this reference
                if (cache[file.path].referenceMap[reference]) break;

                // Continue if this file doesn't exist
                if (!fs.existsSync(referencePath)) continue;

                hash += md5Dependency(new gutil.File({
                    path: referencePath,
                    contents: fs.readFileSync(referencePath),
                    base: file.base
                }));

                // Create reference map to help with replacement later on
                cache[file.path].referenceMap[reference] = {
                    reference: cache[referencePath],
                    relative: i
                };
            }
        }

        // Consolidate hashes into a single hash
        hash = md5(hash);
        cache[file.path].hash = hash;
        return hash;

    };

    var isFileIgnored = function (file) {

        var filename = (typeof file === 'string') ? file : file.path;
        filename = filename.substr(options.dirRoot.length);

        for (var i = options.ignore.length; i--;) {
            var regex = (options.ignore[i] instanceof RegExp) ? options.ignore[i] : new RegExp(options.ignore[i] + '$', "ig");
            if (filename.match(regex)) return true;
        }
        return false;
    };

    var revisionFile = function (file) {

        if (isFileIgnored(file.path))
            return;

        var hash = md5Dependency(file);

        // Replace references with revisioned names
        for (var reference in cache[file.path].referenceMap) {
            var fileReference = cache[file.path].referenceMap[reference].reference.file;
            var isRelative = cache[file.path].referenceMap[reference].relative;
            
            var contents = String(file.contents);
            contents = contents.replace(RegExp(reference, 'g'), getReplacement(reference, fileReference, isRelative));
            file.contents = new Buffer(contents);
        }

        file.path = joinPath(path.dirname(file.path), getRevisionFilename(file));

    };

    return {
        md5: md5,
        joinUrlPath: joinUrlPath,
        joinPath: joinPath,
        revisionFile: revisionFile,
        isFileIgnored: isFileIgnored
    };

};
