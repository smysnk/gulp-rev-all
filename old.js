
        // Don't calculate again if we've already done it once before
        if (cache[cachePath(file.path)] && cache[cachePath(file.path)].hash) {
            return cache[cachePath(file.path)].hash;
        }

        // If the hash of the file we're trying to resolve is already in the stack, stop to prevent circular dependency overflow
        var positionInStack = _.indexOf(stack, cache[cachePath(file.path)]);
        if (positionInStack > -1) {

            // Ignore self-references
            if (stack[stack.length - 1].fileOriginal.path === file.path) {
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