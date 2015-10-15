var Gutil = require('gulp-util');
var Merge = require('merge');
var Path = require('path');
var Tool = require('./tool');

var Revisioner = (function () {
    'use strict';
    var Revisioner = function(options) {

        var defaults = {
            'hashLength': 8,
            'dontGlobal': [ /^\/favicon.ico$/g ],
            'dontRenameFile': [],
            'dontUpdateReference': [],
            'dontSearchFile': [],
            'fileNameVersion': 'rev-version.json',
            'fileNameManifest': 'rev-manifest.json',
            'prefix': '',
            'referenceToRegexs': referenceToRegexs,
            'annotator': annotator,
            'replacer': replacer,
            'debug': false
        };

        this.options = Merge(defaults, options);

        // File pool, any file passed into the Revisioner is stored in this object
        this.files = {};
        this.filesTemp = [];

        // Stores the combined hash of all processed files, used to create the version file
        this.hashCombined = '';

        // Stores the before : after path of assets, used to create the manifset file
        this.manifest = {};

        // Enable / Disable logger based on supplied options
        this.log = (this.options.debug) ? Gutil.log : function () {};

        // Make tools available client side callbacks supplied in options
        this.Tool = Tool;


        var nonFileNameChar = '[^a-zA-Z0-9\\.\\-\\_\\/]';
        var qoutes = '\'|"';

        function referenceToRegexs(reference) {
            var escapedRefPathBase = Tool.path_without_ext(reference.path).replace(/([^0-9a-z])/ig, '\\$1');
            var escapedRefPathExt = Path.extname(reference.path).replace(/([^0-9a-z])/ig, '\\$1');

            var regExp, regExps = [];
            var isJSReference = reference.path.match(/\.js$/);

            // Extensionless javascript file references has to to be qouted
            if (isJSReference) {
                regExp = '('+ qoutes +')(' + escapedRefPathBase + ')()('+ qoutes + '|$)';
                regExps.push(new RegExp(regExp, 'g'));
            }

            // Expect left and right sides of the reference to be a non-filename type character, escape special regex chars
            regExp = '('+ nonFileNameChar +')(' + escapedRefPathBase + ')(' +  escapedRefPathExt + ')('+ nonFileNameChar + '|$)';
            regExps.push(new RegExp(regExp, 'g'));

            return regExps;
        }

        function annotator(contents, path) {
            return [{'contents': contents}];
        }

        function replacer(fragment, replaceRegExp, newReference, referencedFile) {
             fragment.contents = fragment.contents.replace(replaceRegExp, '$1' + newReference + '$3$4');
        }

    };

    Revisioner.prototype.versionFile = function () {

        var out = {
            hash: this.hashCombined,
            timestamp: new Date()
        };

        return new Gutil.File({
            cwd: this.pathCwd,
            base: this.pathBase,
            path: Path.join(this.pathBase, this.options.fileNameVersion),
            contents: new Buffer(JSON.stringify(out, null, 2))
        });

    };

    Revisioner.prototype.manifestFile = function () {

        return new Gutil.File({
            cwd: this.pathCwd,
            base: this.pathBase,
            path: Path.join(this.pathBase, this.options.fileNameManifest),
            contents: new Buffer(JSON.stringify(this.manifest, null, 2))
        });

    };

    /**
     * Used to feed files into the Revisioner, sets up the original filename and hash.
     */
    Revisioner.prototype.processFile = function (file) {

        if (!this.pathCwd) {
            this.pathCwd = file.cwd;
        }

        // Chnage relative paths to absolute
        if (!file.base.match(/^(\/|[a-z]:)/i)) {
            file.base = Tool.join_path(file.cwd, file.base);
        }

        // Normalize the base common to all the files
        if (!this.pathBase) {

            this.pathBase = file.base;

        } else if (file.base.indexOf(this.pathBase) === -1) {

            var levelsBase = this.pathBase.split(/[\/|\\]/);
            var levelsFile = file.base.split(/[\/|\\]/);

            var common = [];
            for (var level = 0, length = levelsFile.length; level < length; level++) {

                if (level < levelsBase.length && level < levelsFile.length &&
                        levelsBase[level] === levelsFile[level]) {
                    common.push(levelsFile[level]);
                    continue;
                }
            }

            if (common[common.length - 1] !== '') {
                common.push('');
            }
            this.pathBase = common.join('/');

        }

        // Set original values before any processing occurs
        file.revPathOriginal = file.revOrigPath = file.path;
        file.revFilenameExtOriginal = Path.extname(file.path);
        file.revFilenameOriginal = Path.basename(file.path, file.revFilenameExtOriginal);
        file.revHashOriginal = this.Tool.md5(String(file.contents));
        file.revContentsOriginal = file.contents;

        this.filesTemp.push(file);

    };

    /**
     * Resolves references, renames files, updates references.  To be called after all the files
     * have been fed into the Revisioner (ie. At the end of the file stream)
     */
    Revisioner.prototype.run = function () {

        this.hashCombined = '';

        // Go through and correct the base path now that we have proccessed all the files coming in
        for (var i = 0, length = this.filesTemp.length; i < length; i++) {

            this.filesTemp[i].base = this.pathBase;
            var path = this.Tool.get_relative_path(this.pathBase, this.filesTemp[i].path);
            this.files[path] = this.filesTemp[i];

        }

        // Resolve references to other files
        for (var path in this.files) {
            this.resolveReferences(this.files[path]);
        }

        // Resolve and set revisioned filename based on hash + reference hashes and ignore rules
        for (var path in this.files) {
            this.revisionFilename(this.files[path]);
        }

        // Consolidate the concatinated hash of all the files, into a single hash for the version file
        this.hashCombined = this.Tool.md5(this.hashCombined);

        // Update references to revisioned filenames
        for (var path in this.files) {
            this.updateReferences(this.files[path]);
        }

    };

    /**
     * Go through each file in the file pool, search for references to any other file in the pool.
     */
    Revisioner.prototype.resolveReferences = function (fileResolveReferencesIn) {


        var contents = String(fileResolveReferencesIn.revContentsOriginal);
        fileResolveReferencesIn.revReferencePaths = {};
        fileResolveReferencesIn.revReferenceFiles = {};

        // Don't try and resolve references in binary files or files that have been blacklisted
        if (this.Tool.is_binary_file(fileResolveReferencesIn) || !this.shouldSearchFile(fileResolveReferencesIn)) {
            return;
        }

        var referenceGroupRelative = [];
        var referenceGroupAbsolute = [];
        var referenceGroupsContainer = {
            'relative': referenceGroupRelative,
            'absolute': referenceGroupAbsolute
        };

        // For the current file (fileResolveReferencesIn), look for references to any other file in the project
        for (var path in this.files) {

            // Organize them by relative vs absolute reference types
            var fileCurrentReference = this.files[path];
            var references;

            references = this.Tool.get_reference_representations_relative(fileCurrentReference, fileResolveReferencesIn);
            for (var i = 0, length = references.length; i < length; i++) {
                referenceGroupRelative.push({
                    'file': this.files[path],
                    'path': references[i]
                });
            }

            references = this.Tool.get_reference_representations_absolute(fileCurrentReference, fileResolveReferencesIn);
            for (var i = 0, length = references.length; i < length; i++) {
                referenceGroupAbsolute.push({
                    'file': this.files[path],
                    'path': references[i]
                });
            }

        }

        // Priority relative references higher than absolute
        for (var referenceType in referenceGroupsContainer) {
            var referenceGroup = referenceGroupsContainer[referenceType];

            for (var referenceIndex = 0, referenceGroupLength = referenceGroup.length; referenceIndex < referenceGroupLength; referenceIndex++) {
                var reference = referenceGroup[referenceIndex];
                var regExps = this.options.referenceToRegexs(reference);

                for (var j = 0; j < regExps.length; j++) {
                    if (contents.match(regExps[j])) {
                        // Only register this reference if we don't have one already by the same path
                        if (!fileResolveReferencesIn.revReferencePaths[reference.path]) {

                            fileResolveReferencesIn.revReferenceFiles[reference.file.path] = reference.file;
                            fileResolveReferencesIn.revReferencePaths[reference.path] = {
                                'regExps': [regExps[j]],
                                'file': reference.file,
                                'path': reference.path
                            };
                            this.log('gulp-rev-all:', 'Found', referenceType, 'reference [', Gutil.colors.magenta(reference.path), '] -> [', Gutil.colors.green(reference.file.path), '] in [', Gutil.colors.blue(fileResolveReferencesIn.revPathOriginal), ']');
                        } else if (fileResolveReferencesIn.revReferencePaths[reference.path].file.revPathOriginal === reference.file.revPathOriginal) {
                            // Append the other regexes to account for inconsitent use
                            fileResolveReferencesIn.revReferencePaths[reference.path].regExps.push(regExps[j]);
                        } else {
                            this.log('gulp-rev-all:', 'Possible ambiguous refrence detected [', Gutil.colors.red(fileResolveReferencesIn.revReferencePaths[reference.path].path), ' (', fileResolveReferencesIn.revReferencePaths[reference.path].file.revPathOriginal, ')] <-> [', Gutil.colors.red(reference.path), '(', Gutil.colors.red(reference.file.revPathOriginal), ')]');
                        }
                    }
                }
            }
        }


    };

    /**
     * Calculate hash based contents and references.
     * hash = hash(file hash + hash(hash references 1 + hash reference N)..)
     */
    Revisioner.prototype.calculateHash = function (file, stack) {

        stack = stack || [];
        var hash = file.revHashOriginal;

        stack.push(file);

        // Resolve hash for child references
        if (Object.keys(file.revReferenceFiles).length > 0) {

            for (var key in file.revReferenceFiles) {

                // Prevent infinite loops caused by circular references, don't recurse if we've already encountered this file
                if (stack.indexOf(file.revReferenceFiles[key]) === -1) {
                    hash += this.calculateHash(file.revReferenceFiles[key], stack);
                }

            }

            // Consolidate many hashes into one
            hash = this.Tool.md5(hash);

        }

        return hash;

    };


    /**
     * Revision filename based on internal contents + references.
     */
    Revisioner.prototype.revisionFilename = function (file) {

        var filename = file.revFilenameOriginal;
        var ext = file.revFilenameExtOriginal;

        file.revHash = this.calculateHash(file);

        // Allow the client to transform the final filename
        if (this.options.transformFilename) {
            filename = this.options.transformFilename.call(this, file, file.revHash);
        } else {
            filename = filename + '.' + file.revHash.substr(0, this.options.hashLength) + ext;
        }

        file.revFilename = filename;
        // file.revFilenameNoExt = Tool.path_without_ext(file.revFilename);

        if (this.shouldFileBeRenamed(file)) {
            file.path = this.Tool.join_path(Path.dirname(file.path), filename);
        }

        // Maintain the combined hash used in version file
        this.hashCombined += file.revHash;

        // Maintain the manifset file
        var pathOriginal = this.Tool.get_relative_path(this.pathBase, file.revPathOriginal, true);
        var pathRevisioned = this.Tool.get_relative_path(file.base, file.path, true);
        this.manifest[pathOriginal] = pathRevisioned;

        file.revPath = pathRevisioned;

    };

    /**
     * Update the contents of a file with the revisioned filenames of its references.
     */
    Revisioner.prototype.updateReferences = function (file) {

        // Don't try and update references in binary files or blacklisted files
        if (this.Tool.is_binary_file(file) || !this.shouldSearchFile(file)) {
            return;
        }

        var contents = String(file.revContentsOriginal);
        var annotatedContent = this.options.annotator(contents, file.revPathOriginal);

        for (var pathReference in file.revReferencePaths) {

            var reference = file.revReferencePaths[pathReference];

            // Replace regular filename with revisioned version
            var referencePath = reference.path.substr(0, reference.path.length - (reference.file.revFilenameOriginal.length + reference.file.revFilenameExtOriginal.length));
            var pathReferenceReplace = referencePath + reference.file.revFilename;

            
            if (this.options.transformPath) {
                // Transform path using client supplied transformPath callback,
                pathReferenceReplace = this.options.transformPath.call(this, pathReferenceReplace, reference.path, reference.file, file);
            } else if (this.options.prefix && pathReferenceReplace[0] === '/') {
                // Append with user supplied prefix
                pathReferenceReplace = this.Tool.join_path_url(this.options.prefix, pathReferenceReplace);
            }

            if (this.shouldUpdateReference(reference.file)) {
                // The extention should remain constant so we dont add extentions to references without extentions
                var noExtReplace = Tool.path_without_ext(pathReferenceReplace);

                for(var i = 0; i < annotatedContent.length; i++){
                    for(var j = 0; j < reference.regExps.length; j++){
                        this.options.replacer(annotatedContent[i], reference.regExps[j], noExtReplace, reference.file);
                    }
                }
            }

        }

        contents = annotatedContent.map(function(annotation) { return annotation.contents; }).join('');
        file.contents = new Buffer(contents);

    };

    /**
     * Determines if a file should be renamed based on dontRenameFile supplied in options.
     */
    Revisioner.prototype.shouldFileBeRenamed = function (file) {

        var filename = this.Tool.get_relative_path(file.base, file.revPathOriginal);

        for (var i = this.options.dontGlobal.length; i--;) {
            var regex = (this.options.dontGlobal[i] instanceof RegExp) ? this.options.dontGlobal[i] : new RegExp(this.options.dontGlobal[i] + '$', 'ig');
            if (filename.match(regex)) {
                return false;
            }
        }

        for (var i = this.options.dontRenameFile.length; i--;) {
            var regex = (this.options.dontRenameFile[i] instanceof RegExp) ? this.options.dontRenameFile[i] : new RegExp(this.options.dontRenameFile[i] + '$', 'ig');
            if (filename.match(regex)) {
                return false;
            }
        }
        return true;

    };


    /**
     * Determines if a particular reference should be updated across assets based on dontUpdateReference supplied in options.
     */
    Revisioner.prototype.shouldUpdateReference = function (file) {

        var filename = this.Tool.get_relative_path(file.base, file.revPathOriginal);

        for (var i = this.options.dontGlobal.length; i--;) {
            var regex = (this.options.dontGlobal[i] instanceof RegExp) ? this.options.dontGlobal[i] : new RegExp(this.options.dontGlobal[i] + '$', 'ig');
            if (filename.match(regex)) {
                return false;
            }
        }

        for (var i = this.options.dontUpdateReference.length; i--;) {
            var regex = (this.options.dontUpdateReference[i] instanceof RegExp) ? this.options.dontUpdateReference[i] : new RegExp(this.options.dontUpdateReference[i] + '$', 'ig');
            if (filename.match(regex)) {
                return false;
            }
        }
        return true;

    };

    /**
     * Determines if a particular reference should be updated across assets based on dontUpdateReference supplied in options.
     */
    Revisioner.prototype.shouldSearchFile = function (file) {

        var filename = this.Tool.get_relative_path(file.base, file.revPathOriginal);

        for (var i = this.options.dontGlobal.length; i--;) {
            var regex = (this.options.dontGlobal[i] instanceof RegExp) ? this.options.dontGlobal[i] : new RegExp(this.options.dontGlobal[i] + '$', 'ig');
            if (filename.match(regex)) {
                return false;
            }
        }

        for (var i = this.options.dontSearchFile.length; i--;) {
            var regex = (this.options.dontSearchFile[i] instanceof RegExp) ? this.options.dontSearchFile[i] : new RegExp(this.options.dontSearchFile[i] + '$', 'ig');
            if (filename.match(regex)) {
                return false;
            }
        }
        return true;

    };

    return Revisioner;


})();

module.exports = Revisioner;
