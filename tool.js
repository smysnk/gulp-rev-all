var gracefulfs = require('graceful-fs');
var patho = require('path');
var crypto = require('crypto');
var gutil = require('gulp-util');
var _ = require('underscore');

module.exports = function(options) {
    'use strict';
    var options = options || {};
    var self = this;
    var cache = {};
    var fs = options.fs || gracefulfs;
    var path = options.path || patho;
    var bases = (options.base && Array.isArray(options.base) && options.base) || options.base && [options.base] || [];

    var amdCommonJsRegex = /(?:define|require)\s*\(\s*((?:['"][^'"]*['"]\s?,\s?)?(?:\[[^\]]*|(?:function))|(?:['"][^'"]*['"]\s?))/g,
        amdCommonJsFilepathRegex = /\"([ a-z0-9_@\-\/\.]{2,})\"|\'([ a-z0-9_@\-\/\.]{2,})\'/ig,
        amdConfigRegex = /requirejs\.config\s*\(\s*(?:[^](?!paths["']\s+:))*paths["']?\s*:\s*{([^}]*)}/g,
        sourcemapRegex = /sourceMappingURL=([ a-z0-9_@\-\/\.]{2,})/ig,
        filepathRegex = /(?:(?:require|define)\([ ]*)*(?:\'|\"|\(|\s)((?!\s)[ a-z0-9_@\-\/\.]{2,}\.[a-z0-9]{2,8})/ig;

    // Disable logging
    if (options.silent === true || options.quiet === true) {
        gutil.log = function() {};
    }

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
        var dirRoot = noStartingSlash ? base.replace(/[^\\/]$/, '/') : base.replace(/[\\/]$/, '');
        return path.substr(dirRoot.length).replace(/\\/g, '/');
    };

    var isFileIgnored = function (file) {

        var filename = getRelativeFilename(file.base, file.path);

        for (var i = options.ignore.length; i--;) {
            var regex = (options.ignore[i] instanceof RegExp) ? options.ignore[i] : new RegExp(options.ignore[i] + '$', 'ig');
            if (filename.match(regex)) {
                return true;
            }
        }
        return false;
    };

    var getRevisionFilename = function (file) {

        var hash = cache[cachePath(file.path)].hash;
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

    var getReplacement = function (reference, file, isRelative, isAmdCommonJs) {
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

        if (isAmdCommonJs) {
            newPath = newPath.replace('.js', '');
        }

        var msg = isRelative ? 'relative' : 'root';
        gutil.log('gulp-rev-all:', 'Found', msg, 'reference [', gutil.colors.magenta(reference), '] -> [', gutil.colors.green(newPath), ']');

        return newPath;

    };

    var findRefs = function(file) {

        var content = String(file.contents),
            result,
            amdContent = '',
            regularContent = String(file.contents);

        while (result = amdCommonJsRegex.exec(content)) {
            regularContent = regularContent.replace(result[1]);
            amdContent += ' ' + result[1];
        }

        while (result = amdConfigRegex.exec(content)) {
            regularContent = regularContent.replace(result[1]);
            amdContent += ' ' + result[1];
        }


        var refs = [];

        while ((result = filepathRegex.exec(regularContent))) {
            refs.push({
                reference: result[1],
                isAmdCommonJs: false
            });
        }

        while ((result = sourcemapRegex.exec(regularContent))) {
          refs.push({
            reference: result[1],
            isAmdCommonJs: false
          })
        }

        while ((result = amdCommonJsFilepathRegex.exec(amdContent))) {
            refs.push({
                reference: result[1] || result[2],
                isAmdCommonJs: true
            });
        }
        return refs;
    };

    var cachePath = function(file) {
        var abspath = path.resolve(file);
        return abspath;
    };

    var isBinary = function(file) {
        var length = (file.contents.length > 50) ? 50 : file.contents.length;
        for (var i = 0; i < length; i++) {
            if (file.contents[i] === 0) {
                return true;
            }
        }
        return false;
    };


    var md5Dependency = function (file, stack) {

        // Don't calculate again if we've already done it once before
        if (cache[cachePath(file.path)] && cache[cachePath(file.path)].hash) {
            return cache[cachePath(file.path)].hash;
        }
                    
        // If the hash of the file we're trying to resolve is already in the stack, stop to prevent circular dependency overflow
        var positionInStack = _.indexOf(stack, cache[cachePath(file.path)]);
        if (positionInStack > -1) {

            // Real or not, self references are not a problem
            if (stack[stack.length-1].fileOriginal.path === file.path) {
                return '';
            }

            var chain = [];
            for (var i = 0; i < stack.length; i++) {
                chain.push(stack[i].fileOriginal.path);
            }
            chain.push(file.path);

            gutil.log('gulp-rev-all:', 'Circular dependency detected [',
                gutil.colors.magenta(chain.join(' --> ')),']');

            // When a circular reference occurs, the file that starts the cycle
            // needs it's hash has to be back propagated to files in the cycle
            // Without this, the hash will not take into account that the file
            // where the cycle is broken, has changed

            stack[positionInStack].backpropagate = stack[positionInStack].backpropagate || [];
            for (var i = positionInStack+1; i < stack.length; i++) {
                stack[positionInStack].backpropagate.push(stack[i]);
            }
            
            return '';
        }


        if (typeof cache[cachePath(file.path)] === 'undefined') {
            cache[cachePath(file.path)] = {
                file: file,
                fileOriginal: {
                    path: file.path,
                    base: file.base
                },
                rewriteMap: {},
                hash: null
            };
        }

        // Push on to the stack
        if (!stack) {
            stack = [ cache[cachePath(file.path)] ];
        } else {
            stack.push(cache[cachePath(file.path)]);
        }

        var refs;
        if (isBinary(file)) {
            refs = [];
            gutil.log('gulp-rev-all:', 'Skipping binary file [', gutil.colors.grey(getRelativeFilename(file.base, file.path)), ']');
        } else {
            gutil.log('gulp-rev-all:', 'Finding references in [', gutil.colors.magenta(getRelativeFilename(file.base, file.path)), ']');
            refs = findRefs(file);
        }
        
        // Create a map of file references and their proper revisioned name
        var contents = String(file.contents);
        var hash = md5(contents);
        var cacheEntry = cache[cachePath(file.path)];

        //var dirRoot = file.base.replace(/[\\/]$/, '');
        var fileBasePath = path.resolve(file.base);
        var fileDir = path.dirname(file.path);

        for (var key = 0; key < refs.length; key++) {

            var reference = refs[key].reference;
            var isAmdCommonJs = refs[key].isAmdCommonJs;

            // Don't do any work if we've already resolved this reference
            if (cacheEntry.rewriteMap[reference]) {
                continue;
            }
            
            var pathType;
            if (isAmdCommonJs) {
                pathType = 'amdCommonJs';
            } else if (reference.substr(0,1) === '/') {
                pathType = 'absolute';
            } else {
                pathType = 'relative';
            }

            var referencePaths = [];
            var references = [reference,];

            if (isAmdCommonJs) {
                references.push(reference + '.js');
            }

            for (var i = 0; i < references.length; i++) {
                var reference_ = references[i];

                for (var j = 0; j < bases.length; j++) {
                    referencePaths.push({
                        base: path.resolve(bases[j]),
                        path: joinPath(path.resolve(bases[j]), reference_),
                        isRelative: false
                    });
                }

                referencePaths.push({
                    base: fileBasePath,
                    path: joinPath(fileBasePath, reference_),
                    isRelative: false
                });

                if (pathType === 'relative') {
                    referencePaths.push({
                        base: fileBasePath,
                        path: joinPath(fileDir, reference_),
                        isRelative: true
                    });
                }

            }

            for (var i = 0; i < referencePaths.length; i++) {
                var referencePath = referencePaths[i];

                // Stop if we've already resolved this reference
                if (cacheEntry.rewriteMap[reference]) {
                    break;
                }

                // Continue if this file doesn't exist
                if (!fs.existsSync(referencePath.path) || fs.lstatSync(referencePath.path).isDirectory()) {
                    continue;          
                }

                // Don't resolve reference of ignored files
                if (isFileIgnored(referencePath)) {
                    continue;
                }

                var refHash = md5Dependency(new gutil.File({
                        path: referencePath.path,
                        contents: fs.readFileSync(referencePath.path),
                        base: file.base
                    }), stack);

                hash += refHash;

                // Create reference map to help with replacement later on
                cacheEntry.rewriteMap[reference] = {
                    reference: cache[cachePath(referencePath.path)],
                    relative: referencePath.isRelative,
                    amdCommonJs: isAmdCommonJs
                };
            }
        }

        // Consolidate into a single hash
        hash = md5(hash);
        cacheEntry.hash = hash;

        // Find all the sad files
        if (cacheEntry.backpropagate) {
            for (var i = 0; i < cacheEntry.backpropagate.length; i++) {
                var bpCacheEntry = cacheEntry.backpropagate[i];
                bpCacheEntry.hash = md5(hash + bpCacheEntry.hash);

                gutil.log('gulp-rev-all:', 'Back propagating hash from [',
                    gutil.colors.magenta(getRelativeFilename(file.base, file.path)),'] to [',
                    gutil.colors.magenta(getRelativeFilename(bpCacheEntry.fileOriginal.base, bpCacheEntry.fileOriginal.path)),']');
            }
            cacheEntry.backpropagate = null;

        }

        stack.pop();
        return hash;
    };

    // Entry point
    var revisionFile = function (file) {
        var hash = md5Dependency(file);
        // Replace references with revisioned names
        for (var reference in cache[cachePath(file.path)].rewriteMap) {
            var fileReference = cache[cachePath(file.path)].rewriteMap[reference].reference.fileOriginal;
            var isRelative = cache[cachePath(file.path)].rewriteMap[reference].relative;
            var isAmdCommonJs = cache[cachePath(file.path)].rewriteMap[reference].amdCommonJs;          
            var replaceWith = getReplacement(reference, fileReference, isRelative, isAmdCommonJs);
            var contents;

            if (isAmdCommonJs) {
                reference = '[\'"]' + reference + '[\'"]';
                replaceWith = '\'' + replaceWith + '\'';
                var result;
                var original;
                var partials = {};

                // Gather partials
                contents = String(file.contents);
                while(result = amdCommonJsRegex.exec(contents)) {
                    partials[result[1]] = '';
                }
                contents = String(file.contents);
                while(result = amdConfigRegex.exec(contents)) {
                    partials[result[1]] = '';
                }

                for(original in partials) {
                    partials[original] = original.replace(new RegExp(reference, 'g'), replaceWith);
                }

                for(original in partials) {
                    var change = partials[original];
                    contents = contents.replace(original, change);
                }
                
            } else {
                contents = String(file.contents);
                contents = contents.replace(new RegExp(reference, 'g'), replaceWith);
            }

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
        getRelativeFilename: getRelativeFilename,
        cache: cache,
        cachePath: cachePath
    };

};
