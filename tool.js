var Path = require('path');
var crypto = require('crypto');

module.exports = (function() {
    'use strict';

    var path_without_ext = function(path) {
        var ext = Path.extname(path);
        return path.substr(0, path.length - ext.length);
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

        return Path.join(directory, filename).replace(/^[a-z]:\\/i, '/').replace(/\\/g, '/');
        
    };

    /**
     * Given a base path and resource path, will return resource path relative to the base.
     * Also replaces Windows forward-slash with a backslash.
     */
    var get_relative_path = function (base, path, noStartingSlash) {

        if (base === path) {
            return '';
        }

        // Sanitize inputs, convert windows to posix style slashes, remove trailing slash off base is there is one
        base = base.replace(/^[a-z]:/i, '').replace(/\\/g, '/').replace(/\/$/g, '');
        path = path.replace(/^[a-z]:/i, '').replace(/\\/g, '/');

        // Only truncate paths that overap with the base
        if (base === path.substr(0, base.length)) {
            path = path.substr(base.length);
        }

        var modifyStartingSlash = noStartingSlash !== undefined;

        if(modifyStartingSlash) {
            if (path[0] === '/' && noStartingSlash) {
                path = path.substr(1);
            } else if (path[0] !== '/' && !noStartingSlash){
                path = '/' + path;
            }
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

    /**
     * Given a file (context) and a file reference, return all the possible representations of paths to get from
     * the context to the reference file.
     *
     */
    var get_reference_representations_relative = function (fileCurrentReference, file) {

        var representations = [];

        //  Scenario 2: Current file is the same directory or lower than the reference
        //              (ie. file.path and the reference file.path are the same)
        //
        //                  file.base = /user/project
        //                  file.path = /user/project/second/current_file.html
        //  fileCurrentReference.path = /user/project/second/index.html

        if (Path.dirname(fileCurrentReference.path).indexOf(Path.dirname(file.path)) === 0) {

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

        if (Path.dirname(file.path) !== Path.dirname(fileCurrentReference.path) &&
            Path.dirname(fileCurrentReference.path).indexOf(Path.dirname(file.path)) === -1) {

            var pathCurrentReference = Path.dirname(get_relative_path(fileCurrentReference.base, fileCurrentReference.revPathOriginal));
            var pathFile = Path.dirname(get_relative_path(file.base, file.revPathOriginal));

            // ../second/index.html
            var relPath = Path.relative(pathFile, pathCurrentReference);
            relPath = relPath.replace(/\\/g, '/');
            representations.push(relPath + '/' + Path.basename(fileCurrentReference.revPathOriginal));
        }

        return representations;

    };

    /**
     * Given a file (context) and a file reference, return all the possible representations of paths to get from
     * the context to the reference file.
     *
     */
    var get_reference_representations_absolute = function (fileCurrentReference, file) {

        var representations = [];
        var representation;

        //  Scenario 1: Current file is anywhere
        //  /view/index.html  (reference: absolute)
        representations.push(get_relative_path(fileCurrentReference.base, fileCurrentReference.revPathOriginal, false));
        
        // Without starting slash, only if it contains a directory
        // view/index.html  (reference: absolute, without slash prefix)
        representation = get_relative_path(fileCurrentReference.base, fileCurrentReference.revPathOriginal, true);
        if (representation.indexOf('/')) {
            representations.push(representation);
        }

        return representations;

    };


    return {
        get_relative_path: get_relative_path,
        md5: md5,
        is_binary_file: is_binary_file,
        path_without_ext: path_without_ext,
        join_path: join_path,
        join_path_url: join_path_url,
        get_reference_representations_relative: get_reference_representations_relative,
        get_reference_representations_absolute: get_reference_representations_absolute
    };

})();
