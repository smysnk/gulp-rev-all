var gracefulfs = require('graceful-fs');
var crypto = require('crypto');
var gutil = require('gulp-util');
var merge = require('merge');
var Path = require('path');
var Tool = require('./tool');

var Revisioner = (function () {

    var Revisioner = function(options) {

        this.options = merge({
            'hashLength': 8,
            'dontGlobal': [ /^\/favicon.ico$/g ],
            'dontRenameFile': [],
            'dontUpdateReference': [],
            'fileNameVersion': 'version.json',
            'fileNameManifest': 'rev-manifest.json',
            'prefix': '',
            'files': {}
        }, options);

        // File pool, any file passed into the Revisioner is stored in this object
        this.files = this.options.files;

        // Stores the combined hash of all processed files, used to create the version file
        this.hashCombined = '';

        // Stores the before : after path of assets, used to create the manifset file
        this.manifest = {};

        // Make tools available client side callbacks supplied in options
        this.Tool = Tool;

    };

    Revisioner.prototype.versionFile = function () {

        var out = {
            hash: this.hashCombined,
            timestamp: new Date()
        };
    
        return new gutil.File({
            cwd: this.pathCwd,
            base: this.pathBase,
            path: Path.join(this.pathBase, this.options.fileNameVersion),
            contents: new Buffer(JSON.stringify(out, null, 2))
        });

    };

    Revisioner.prototype.manifestFile = function () {

        return new gutil.File({
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

        if (!this.pathBase) this.pathBase = file.base;
        if (!this.pathCwd) this.pathCwd = file.cwd;

        var path = this.Tool.get_relative_path(this.pathBase, file.path);
        
        // Store original values before we do any processing
        file.revPathOriginal = file.revOrigPath = file.path;
        file.revFilenameExtOriginal = Path.extname(file.path);
        file.revFilenameOriginal = Path.basename(file.path, file.revFilenameExtOriginal);
        file.revHashOriginal = this.Tool.md5(String(file.contents));

        this.files[path] = file;

    };

    /**
     * Resolves references, renames files, updates references.  To be called after all the files 
     * have been fed into the Revisioner (ie. At the end of the file stream)
     */
    Revisioner.prototype.run = function () {

        this.hashCombined = '';

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


        var contents = String(fileResolveReferencesIn.contents);
        fileResolveReferencesIn.revReferences = [];

        // Don't try and resolve references in binary files
        if (this.Tool.is_binary_file(fileResolveReferencesIn)) return;

        // For the current file (fileResolveReferencesIn), look for references to any other file in the project
        for (var path in this.files) {
            var fileCurrentReference = this.files[path];

            // Go through possible references to known assets and see if we can match them
            var references = this.Tool.get_reference_representations(fileCurrentReference, fileResolveReferencesIn);
            for (var i = 0, length = references.length; i < length; i++) {

                // Expect left and right sides of the reference to be a non-filename type character
                var regExp = '([^a-z0-9\\.\\-\\_/])(' + references[i].replace(/([^0-9a-z])/ig, '\\$1') + ')([^a-z0-9\\.\\-\\_])';
                
                regExp = new RegExp(regExp, 'g');
                if (contents.match(regExp)) {
                    fileResolveReferencesIn.revReferences.push({ 'regExp': regExp, 'file': this.files[path], 'path': references[i] });
                }

            }

        }


    };  


    /**
     * Revision filename based on internal contents + references.
     */
    Revisioner.prototype.revisionFilename = function (file) {

        var hash = file.revHashOriginal;
        var filename = file.revFilenameOriginal;
        var ext = file.revFilenameExtOriginal;

        // Final hash = hash(file hash + hash references 1 + hash reference N)
        for (var i = file.revReferences.length; i--;) {
            hash += file.revReferences[i]['file'].revHashOriginal;
        }
        file.revHash = this.Tool.md5(hash);

        // Allow the client to transform the final filename
        if (this.options.transformFilename) {
            filename = this.options.transformFilename.call(this, file, file.revHash);
        } else {
            filename = filename + '.' + file.revHash.substr(0, this.options.hashLength) + ext;
        }

        file.revFilename = filename;

        if (this.shouldFileBeRenamed(file)) {
            file.path = this.Tool.join_path(Path.dirname(file.path), filename);
        }

        this.hashCombined += file.revHash;
        var pathOriginal = this.Tool.get_relative_path(this.pathBase, file.revPathOriginal, true);
        var pathRevisioned = this.Tool.get_relative_path(file.base, file.path, true);
        this.manifest[pathOriginal] = pathRevisioned;
        file.revPath = pathRevisioned;

    };

    /**
     * Update the contents of a file with the revisioned filenames of its references.
     */
    Revisioner.prototype.updateReferences = function (file) {

        // Don't try and update references in binary files
        if (this.Tool.is_binary_file(file)) return;

        var contents = String(file.contents);
        for (var i = file.revReferences.length; i--;) {
            
            var reference = file.revReferences[i];

            // Replace regular filename with revisioned version
            var pathReferenceReplace;
            if (reference.file.revFilenameExtOriginal == '.js' && !reference.path.match(/.js$/)) {
                pathReferenceReplace = reference.path.substr(0, reference.path.length - reference.file.revFilenameOriginal.length);
                pathReferenceReplace += reference.file.revFilename.substr(0, reference.file.revFilename.length - 3);              
            } else {
                pathReferenceReplace = reference.path.substr(0, reference.path.length - (reference.file.revFilenameOriginal.length + reference.file.revFilenameExtOriginal.length));
                pathReferenceReplace += reference.file.revFilename;
            }

            // Transform path using client supplied transformPath callback, if none try and append with user supplied prefix (defaults to '')
            pathReferenceReplace = (this.options.transformPath) ? this.options.transformPath.call(this, pathReferenceReplace, reference.path, reference.file) : 
                                   (this.options.prefix) ? this.Tool.join_path_url(this.options.prefix, pathReferenceReplace) : pathReferenceReplace;

            if (this.shouldUpdateReference(reference.file)) {
                contents = contents.replace(reference.regExp, '$1' + pathReferenceReplace + '$3');
            }
        
        }

        file.contents = new Buffer(contents);

    };

    /**
     * Determines if a file should be renamed based on dontRenameFile supplied in options.
     */
    Revisioner.prototype.shouldFileBeRenamed = function (file) {

        var filename = this.Tool.get_relative_path(file.base, file.path);

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

        var filename = this.Tool.get_relative_path(file.base, file.path);

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

    return Revisioner;
    

})();

module.exports = Revisioner;
