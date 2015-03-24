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
        
        return Path.join(directory, filename).replace(/\\/g, '/');

    };

    var get_relative_path = function (base, path, noStartingSlash) {

        var dirRoot = noStartingSlash ? base.replace(/[^\\/]$/, '/') : base.replace(/[\\/]$/, '');
        return path.substr(dirRoot.length).replace(/\\/g, '/');

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

    var find_references_in_contents = function (file, contents) {

        console.log(contents);

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
        find_references_in_contents: find_references_in_contents,
        replace_references_in_contents: replace_references_in_contents
    };

})();