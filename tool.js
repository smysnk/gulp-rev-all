var gracefulfs = require('graceful-fs');
var patho = require('path');
var crypto = require('crypto');
var gutil = require('gulp-util');
var _ = require('underscore');

module.exports = function(options) {

    var options = options || {};
    var self = this;
    var cache = {};
    var fs = options.fs || gracefulfs;
    var path = options.path || patho;

    // Disable logging
    if (options.silent == true || options.quiet == true) gutil.log = function() {}

    var joinPathUrl = function (prefix, path) {
        prefix = prefix.replace(/\/$/, '');
        path = path.replace(/^\//, '');
        return [ prefix, path ].join('/');
    };
    this.joinPathUrl = joinPathUrl; // Make it available to transformPath callback

    // Fix slash style for our poor windows brothern
    var joinPath = function (directory, filename) {
        return path.join(directory, filename).replace(/\\/g, '/');
    };
    this.joinPath = joinPath; // Make it available to transformPath callback


    var getRelativeFilename = function (base, path, noStartingSlash) {
        var dirRoot = noStartingSlash ? base.replace(/[^\\/]$/, "/") : base.replace(/[\\/]$/, "");
        return path.substr(dirRoot.length).replace(/\\/g, '/');
    }

    var isFileIgnored = function (file) {

        var filename = getRelativeFilename(file.base, file.path);

        for (var i = options.ignore.length; i--;) {
            var regex = (options.ignore[i] instanceof RegExp) ? options.ignore[i] : new RegExp(options.ignore[i] + '$', "ig");
            if (filename.match(regex)) return true;
        }
        return false;
    };

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

        // Add back the relative reference so we don't break commonjs style includes
        if (reference.indexOf('./') === 0) {
            newPath = './' + newPath;
        }         

        if (options.transformPath) {
            newPath = options.transformPath.call(self, newPath, reference, file, isRelative);
        } else if (!isRelative && options.prefix) {
            newPath = joinPathUrl(options.prefix, newPath);
        } 

        var msg = isRelative ? 'relative' : 'root';
        gutil.log('gulp-rev-all:', 'Found', msg, 'reference [', gutil.colors.magenta(reference), '] -> [', gutil.colors.green(newPath), ']');

        return newPath;

    };

    var md5Dependency = function (file, stack) {

        // Don't calculate again if we've already done it once before
        if (cache[file.path]) return cache[file.path].hash;

        // If the hash of the file we're trying to resolve is already in the stack, stop to prevent circular dependcy overflow
        if (_.indexOf(stack, cache[file.path]) > -1) return '';

        var filepathRegex = /(?:[^a-z]require\([ ]*)*(?:\'|\"|\()([ a-z0-9_@\-\/\.]{2,})/ig;

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

        var isBinary = false;
        var length = (file.contents.length > 50) ? 50 : file.contents.length;
        for (var i = 0; i < length; i++) {
            if (file.contents[i] === 0) {
                isBinary = true;
                break;
            }
        }

        if (isBinary) {
            gutil.log('gulp-rev-all:', 'Skipping binary file [', gutil.colors.grey(getRelativeFilename(file.base, file.path)), ']');
        } else {
            gutil.log('gulp-rev-all:', 'Finding references in [', gutil.colors.magenta(getRelativeFilename(file.base, file.path)), ']');
        }
        
        // Create a map of file references and their proper revisioned name
        var contents = String(file.contents);
        var hash = md5(contents);
        var result;

        while ((result = filepathRegex.exec(contents)) && !isBinary) {

            var reference = result[1];

            // Don't do any work if we've already resolved this reference
            if (cache[file.path].rewriteMap[reference]) continue;
            var dirRoot = file.base.replace(/[\\/]$/, "");

            var referencePaths = [
                {
                    base: file.base,
                    path: joinPath(dirRoot, reference),
                    isRelative: false
                },
                {
                    base: file.base,
                    path: joinPath(path.dirname(file.path), reference),
                    isRelative: true
                }
            ];

            // If we have require in the match, cover common.js short form edge case
            if (result[0].indexOf('require') != -1) {
                referencePaths.push({  
                    base: file.base,
                    path: joinPath(path.dirname(file.path), reference + '.js'),
                    isRelative: true
                });
            }

            // If it starts with slash, try absolute first
            if (reference.substr(0,1) === '/') referencePaths.reverse();

            for (var i = referencePaths.length; i--;) {
                var referencePath = referencePaths[i];

                // Stop if we've already resolved this reference
                if (cache[file.path].rewriteMap[reference]) break;

                // Continue if this file doesn't exist
                if (!fs.existsSync(referencePath.path)) continue;          

                // Don't resolve reference of ignored files
                if (isFileIgnored(referencePath)) continue;

                try {

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

                } catch (e) {
                    // Don't die if it's a directory
                }

            }
        }

        // Consolidate hashes into a single hash
        hash = md5(hash);
        cache[file.path].hash = hash;
        return hash;

    };

    var revisionFile = function (file) {

        var hash = md5Dependency(file);

        // Replace references with revisioned names
        for (var reference in cache[file.path].rewriteMap) {
            var fileReference = cache[file.path].rewriteMap[reference].reference.fileOriginal;
            var isRelative = cache[file.path].rewriteMap[reference].relative;
            
            var contents = String(file.contents);
            contents = contents.replace(RegExp(reference, 'g'), getReplacement(reference, fileReference, isRelative));
            file.contents = new Buffer(contents);
        }

        if (!isFileIgnored(file)) {
            file.revOrigPath = file.path;
            file.revOrigBase = file.base;
            file.revHash = hash;
            file.path = joinPath(path.dirname(file.path), getRevisionFilename(file));
        } else {
            gutil.log('gulp-rev-all:', 'Not renaming [', gutil.colors.red(getRelativeFilename(file.base, file.path)), '] due to filter rules.');
        }
        
        return file;

    };

    return {
        md5: md5,
        joinPathUrl: joinPathUrl,
        joinPath: joinPath,
        revisionFile: revisionFile,
        isFileIgnored: isFileIgnored,
        getReplacement: getReplacement,
        getRelativeFilename: getRelativeFilename
    };

};
