var gutil = require('gulp-util');
var Path = require('path');
var crypto = require('crypto');
var glob = require('glob');
var fs = require('fs');

module.exports = (function() {
    'use strict';

    var write_glob_to_stream = function (base, path, stream) {

        glob(path, {}, function (er, pathsGlob) {
            
            pathsGlob.forEach(function (pathGlob) {
                
                // Not interested in directories
                if (fs.lstatSync(pathGlob).isDirectory()) return;

                stream.write(new gutil.File({
                    path: Path.resolve(pathGlob),
                    contents: fs.readFileSync(pathGlob),
                    base: base
                }));

            });

            stream.end();
        });

    };

    var write_to_stream = function (base, name, content, stream) {

        var file = new gutil.File({
            path: name,
            contents: new Buffer(content),
            base: base
        });
        stream.write(file);

    };

    var get_file = function (base, filePath) {

        return new gutil.File({
            path: Path.join(__dirname, filePath),
            contents: fs.readFileSync(filePath),
            base: base
        });

    };

    var join_path_url = function (prefix, path) {
        
        prefix = prefix.replace(/\/$/, '');
        path = path.replace(/^\//, '');
        return [ prefix, path ].join('/');

    };

    /**
     * Joins a directory and a filename, replaces Windows forward-slash with a backslash.
     */
    var join_path = function (directory, filename) {
        
        var path = Path.join(directory, filename).replace(/\\/g, '/');
        return (path.indexOf('/') == 0) ? path : '/' + path;

    };

    /**
     * Given a base path and resource path, will return resource path relative to the base. 
     * Also replaces Windows forward-slash with a backslash.
     */
    var get_relative_path = function (base, path, noStartingSlash) {

        if (base === path) return '';

        path = path.substr(base.length).replace(/\\/g, '/');
        if (path.indexOf('/') == 0 && noStartingSlash) {
            path = path.substr(1);
        } else if (path.indexOf('/') != 0 && noStartingSlash) {
            path = '/' + path;
        }

        return path;

    };

    var md5 = function (str) {
  
        return crypto.createHash('md5').update(str, 'utf8').digest('hex');
  
    };

    var is_binary_file = function (file) {

        var length = (file.contents.length > 50) ? 50 : file.contents.length;
        for (var i = 0; i < length; i++) {
            if (file.contents[i] === 0) {
                return true;
            }
        }
        return false;

    };

    var get_reference_representations = function (fileCurrentReference, file) {

        var representations = [];

        //  Scenario 1: Current file is anywhere
        //  /view/index.html  (reference: absolute)
        representations.push(get_relative_path(fileCurrentReference.base, fileCurrentReference.revPathOriginal, false));

        //  Scenario 2: Current file is the same directory or lower than the reference
        //              (ie. file.path and the reference file.path are the same)
        //
        //                  file.base = /user/project 
        //                  file.path = /user/project/second/current_file.html
        //  fileCurrentReference.path = /user/project/second/index.html

        if (Path.dirname(fileCurrentReference.path).indexOf(Path.dirname(file.path)) == 0) {

            //  index.html
            representations.push(get_relative_path(Path.dirname(file.path), fileCurrentReference.revPathOriginal, true));

            //  ./index.html   (reference: relative)
            representations.push('.' + get_relative_path(Path.dirname(file.path), fileCurrentReference.revPathOriginal, false));

        }

        //  Scenario 3: Current file is in a different child directory than the reference
        //            (ie. file.path and the reference file.path are different, not in root directory)
        //
        //                  file.base = /user/project 
        //                  file.path = /user/project/first/index.html
        //  fileCurrentReference.path = /user/project/second/index.html

        if (Path.dirname(file.path) != Path.dirname(fileCurrentReference.path) &&
            Path.dirname(fileCurrentReference.path).indexOf(Path.dirname(file.path)) == -1) {

            var levelsCurrentReference = Path.dirname(get_relative_path(fileCurrentReference.base, fileCurrentReference.revPathOriginal, true));
            var levelsFile = Path.dirname(get_relative_path(file.base, file.revPathOriginal, true)); 

            // Correct special case where 'Path.dirname' returns '.' , we want an empty string instead
            levelsCurrentReference = (levelsCurrentReference == '.') ? '' : levelsCurrentReference.split('/');
            levelsFile = (levelsFile == '.') ? '' : levelsFile.split('/');

            // Ignore the common base directories between the current file and the current reference, 
            // then build a list of the directories past.  The list is used to determine the number of "../" 
            // (directory traversals) to prefix the path with.
            // Also build up a list of current reference directories past the common directories.
            
            var common = 0;
            var pathPastCommon = [];               
            for (var level = 0, length = levelsCurrentReference.length; level < length; level++) {
                
                if (level < levelsCurrentReference.length && level < levelsFile.length
                    && levelsCurrentReference[level] == levelsFile[level]) {
                    common++;
                    continue;
                }

                if (level < levelsCurrentReference.length) {
                    pathPastCommon.push(levelsCurrentReference[level]);
                }

            }

            // Add the directory traverals to the beginning of the path
            var traversals = (levelsFile.length - common);
            for (var i = 0; i < traversals; i++) {
                pathPastCommon.unshift('..');
            }

            // Add the filename to the end
            pathPastCommon.push(Path.basename(fileCurrentReference.revPathOriginal));

            // ../second/index.html
            representations.push(pathPastCommon.join('/'));

        }

        // Create alternative representations for javascript files for frameworks that omit the .js extension
        for (var i = 0, length = representations.length; i < length; i++) {
            if (!representations[i].match(/.js$/ig)) continue;
            representations.push(representations[i].substr(0, representations[i].length - 3));
        }

        return representations;

    };


    var replace_references_in_contents = function (references, contents) {

        return "";

    };


    return {
        get_relative_path: get_relative_path,
        write_glob_to_stream: write_glob_to_stream,
        write_to_stream: write_to_stream,
        get_file: get_file,
        md5: md5,
        is_binary_file: is_binary_file,
        join_path: join_path,
        get_reference_representations: get_reference_representations,
        replace_references_in_contents: replace_references_in_contents
    };

})();