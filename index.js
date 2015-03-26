var Through = require('through2');
var Revisioner = require('./revisioner');

var RevAll = (function () { 

    var RevAll = function (options) {

        this.revisioner = new Revisioner(options);

    };

    RevAll.prototype.revision = function () {

        var _this = this;

        // Feed the RevAll Revisioner with all the files in the stream, don't emit them until all of them have been processed
        return Through.obj(function (file, enc, callback) {

            if (file.isNull()) {
                return callback(null, file);
            } else if (file.isStream()) {
                throw new Error('Streams are not supported!');
            } 

            _this.revisioner.processFile(file);
            callback();

        }, function (callback) {

            _this.revisioner.run();
            
            var files = _this.revisioner.files;
            for (var filename in files) {
                this.push(files[filename]);
            }
            callback();

        });    

    };

    RevAll.prototype.versionFile = function () {

        var _this = this;

        // Drop any existing files off the stream, push the generated version file 
        return Through.obj(function (file, enc, callback) {
            
            // Drop any existing files off the stream
            callback();

        }, function (callback) {

            this.push(_this.revisioner.versionFile());            
            callback();

        });

    };

    RevAll.prototype.manifestFile = function () {

        var _this = this;

        // Drop any existing files off the stream, push the generated manifest file
        return Through.obj(function (file, enc, callback) {

            callback();

        }, function (callback) {
            
            this.push(_this.revisioner.manifestFile());
            callback();

        });
    };

    return RevAll;
    
})();

module.exports = RevAll;
