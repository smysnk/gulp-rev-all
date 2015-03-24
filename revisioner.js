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
            'ignore': [ /^\/favicon.ico$/g ],
            'fileNameVersion': 'version.json',
            'fileNameManifest': 'rev-manifest.json',
            'prefix': '',
            'files': {}
        }, options);

        this.files = this.options.files;

    };

    /**
     * Used to feed files into the Revisioner, sets up the original filename and hash.
     */
    Revisioner.prototype.processFile = function (file) {

        if (!this.pathBase) this.pathBase = file.base;

        var path = Tool.get_relative_path(this.pathBase, file.path);
        
        // Store original values before we do any processing
        file.revFilenameOriginalExt = Path.extname(file.path);
        file.revFilenameOriginal = Path.basename(file.path, file.revFilenameOriginalExt);
        file.revHashOriginal = Tool.md5(String(file.contents));

        this.files[path] = file;

    };

    /**
     * Resolves references, renames files, updates references.  To be called after all the files 
     * have been fed into the Revisioner (ie. At the end of the file stream)
     */
    Revisioner.prototype.run = function () {

        // Resolve references to other files
        for (var path in this.files) {
            this.resolveReferences(this.files[path]);
        }

        // Resolve and set revisioned filename based on hash + reference hashes and ignore rules
        for (var path in this.files) {
            this.revisionFilename(this.files[path]);            
        }

        // Update references to revisioned filenames
        for (var path in this.files) {
            this.updateReferences(this.files[path]);            
        }

    };

    /**
     * Go through each file in the file pool, search for references to any other file in the pool.
     */
    Revisioner.prototype.resolveReferences = function (file) {

        file.revReferences = {};

        if (Tool.is_binary_file(file)) return;

        var contents = String(file.contents);
        for (var path in this.files) {
            file.revReferences.push(Tool.find_references_in_contents(this.files[path], contents));
        }

    };


    /**
     * Revision filename based on internal contents + references.
     */
    Revisioner.prototype.revisionFilename = function (file) {

        if (this.isFileIgnored(file)) return;

        var hash = file.revHashOriginal;
        var filename = file.revFilenameOriginal;
        var ext = file.revFilenameOriginalExt;

        // Final hash = hash(file hash + hash references 1 + hash reference N)
        for (var reference in file.revReferences) {
            hash += file.revReferences[reference].revHashOriginal;
        }
        hash = Tool.md5(hash);

        if (this.options.transformFilename) {
            filename = this.options.transformFilename.call(this, file, hash);
        } else {
            filename = filename + '.' + hash.substr(0, this.options.hashLength) + ext;
        }

        file.revFilename = filename;
        file.path = Tool.join_path(Path.dirname(file.path), filename);

    };

    /**
     * Update the contents of a file with the revisioned filenames of its references.
     */
    Revisioner.prototype.updateReferences = function (file) {

        for (var i = file.revReferences.length; i--;) {
            file.contents = new Buffer(Tool.replace_references_in_contents(file.revReferences, file.contents));
        }

    };

    /**
     * Determines if a file should be revisioned based on ignore rules supplied in options.
     */
    Revisioner.prototype.isFileIgnored = function (file) {

        var filename = Tool.get_relative_path(file.base, file.path);

        for (var i = this.options.ignore.length; i--;) {
            var regex = (this.options.ignore[i] instanceof RegExp) ? this.options.ignore[i] : new RegExp(this.options.ignore[i] + '$', 'ig');
            if (filename.match(regex)) {
                return true;
            }
        }
        return false;

    };

    return Revisioner;
    

})();

module.exports = Revisioner;
