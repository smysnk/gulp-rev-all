var Through = require("through2");
var Revisioner = require("./revisioner");
var PluginError = require("plugin-error");

var PLUGIN_NAME = "gulp-rev-all";

module.exports = {
  revision: function (options) {
    var revisioner = new Revisioner(options);

    // Feed the RevAll Revisioner with all the files in the stream, don't emit them until all of them have been processed
    return Through.obj(
      function (file, enc, callback) {
        if (file.isStream()) {
          this.emit(
            "error",
            new PluginError(PLUGIN_NAME, "Streams not supported!")
          );
          return callback();
        }

        if (file.isBuffer()) {
          revisioner.processFile(file);
        }

        file.revisioner = revisioner;

        callback();
      },
      function (callback) {
        revisioner.run();

        var files = revisioner.files;
        for (var filename in files) {
          this.push(files[filename]);
        }
        callback();
      }
    );
  },

  versionFile: function () {
    var revisioner;

    // Drop any existing files off the stream, push the generated version file
    return Through.obj(
      function (file, enc, callback) {
        if (!revisioner) {
          revisioner = file.revisioner;
        }

        // Drop any existing files off the stream
        callback();
      },
      function (callback) {
        if (!revisioner) {
          this.emit(
            "error",
            new PluginError(PLUGIN_NAME, "revision() must be called first!")
          );
          return callback();
        }

        this.push(revisioner.versionFile());
        callback();
      }
    );
  },

  manifestFile: function () {
    var revisioner;

    // Drop any existing files off the stream, push the generated manifest file
    return Through.obj(
      function (file, enc, callback) {
        if (!revisioner) {
          revisioner = file.revisioner;
        }
        callback();
      },
      function (callback) {
        if (!revisioner) {
          this.emit(
            "error",
            new PluginError(PLUGIN_NAME, "revision() must be called first!")
          );
          return callback();
        }

        this.push(revisioner.manifestFile());
        callback();
      }
    );
  },
};
