var fs = require('graceful-fs');
var path = require('path');
var crypto = require('crypto');
var gutil = require('gulp-util');
var _ = require('underscore');

module.exports = function(options) {

    var self = this;
    var cache = {};

    var joinPathUrl = function (prefix, path) {
        prefix = prefix.replace(/\/$/, '');
        path = path.replace(/^\//, '');
        return [ prefix, path ].join('/');
    };
    this.joinPathUrl = joinPathUrl;

    // Fix slash style for our poor windows brothern
    var joinPath = function (directory, filename) {
        return path.join(directory, filename).replace('\\', '/');
    };
    this.joinPath = joinPath;

    var getRevisionFilename = function (file) {

        var hash = cache[file.path].hash;
        var ext = path.extname(file.path);
        var filename;

        if (options.transformFilename) {
            filename = options.transformFilename.call(self, file, hash);
        } else {
            filename = path.basename(file.path, ext) + '.' + hash.substr(0, options.hashLength) + ext;
        }

        return filename;

    };

    var md5 = function (str) {
        return crypto.createHash('md5').update(str, 'utf8').digest('hex');
    };

    var getReplacement = function (reference, file, isRelative) {

        var newPath = joinPath(path.dirname(reference), getRevisionFilename(file));

        if (options.transformPath) {
            newPath = options.transformPath.call(self, newPath, reference, file, isRelative);
        } else if (!isRelative && options.prefix) {
            newPath = joinPathUrl(options.prefix, newPath);
        }

        var msg = isRelative ? 'relative' : 'root';
        gutil.log('gulp-rev-all:', 'Found', msg, 'reference [', reference, '] -> [', newPath, ']');

        return newPath;

    };

    var md5Dependency = function (file, stack) {

        // Don't calculate again if we've already done it once before
        if (cache[file.path]) return cache[file.path].hash;

        // If the hash of the file we're trying to resolve is already in the stack, stop to prevent circular dependcy overflow
        if (_.indexOf(stack, cache[file.path]) > -1) return '';

        var filepathRegex = /.*?(?:\'|\"|\()([a-z0-9_@\-\/\.]+?\.[a-z]{2,4})(?:(?:\?|\#)[^'")]*?|)(?:\'|\"|\)).*?/ig;

        if (typeof cache[file.path] === 'undefined') {
            cache[file.path] = {
                file: file,
                fileOriginal: {
                    path: file.path
                },
                rewriteMap: {},
                hash: null
            };
        }

        // Push on to the stack
        if (!stack) {
            stack = [ cache[file.path] ];
        } else {
            stack.push(cache[file.path]);
        }

        gutil.log('gulp-rev-all:', 'Finding references in [', file.path, ']');
        
        // Create a map of file references and their proper revisioned name
        var contents = String(file.contents);
        var hash = md5(contents);
        var result;

        while (result = filepathRegex.exec(contents)) {

            var reference = result[1];

            // Don't do any work if we've already resolved this reference
            if (cache[file.path].rewriteMap[reference]) continue;

            var referencePaths = [
                {
                    path: joinPath(options.dirRoot, reference),
                    isRelative: false
                },
                {
                    path: joinPath(path.dirname(file.path), reference),
                    isRelative: true
                }
            ];

            // If it starts with slash, assume it's absolute
            if (reference.substr(0,1) === '/') referencePaths.reverse();

            for (var i = referencePaths.length; i--;) {
                var referencePath = referencePaths[i];

                // Stop if we've already resolved this reference
                if (cache[file.path].rewriteMap[reference]) break;

                // Continue if this file doesn't exist
                if (!fs.existsSync(referencePath.path)) continue;          

                hash += md5Dependency(new gutil.File({
                        path: referencePath.path,
                        contents: fs.readFileSync(referencePath.path),
                        base: file.base
                    }), stack);

                // Create reference map to help with replacement later on
                cache[file.path].rewriteMap[reference] = {
                    reference: cache[referencePath.path],
                    relative: referencePath.isRelative
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

        if (isFileIgnored(file.path)) {
            gutil.log('gulp-rev-all:', 'Ignoring [', file.path, '] due to filter rules.');
            return;
        }

        var hash = md5Dependency(file);

        // Replace references with revisioned names
        for (var reference in cache[file.path].rewriteMap) {
            var fileReference = cache[file.path].rewriteMap[reference].reference.fileOriginal;
            var isRelative = cache[file.path].rewriteMap[reference].relative;
            
            var contents = String(file.contents);
            contents = contents.replace(RegExp(reference, 'g'), getReplacement(reference, fileReference, isRelative));
            file.contents = new Buffer(contents);
        }

        file.path = joinPath(path.dirname(file.path), getRevisionFilename(file));

    };

    return {
        md5: md5,
        joinPathUrl: joinPathUrl,
        joinPath: joinPath,
        revisionFile: revisionFile,
        isFileIgnored: isFileIgnored,
        getReplacement: getReplacement
    };

};
