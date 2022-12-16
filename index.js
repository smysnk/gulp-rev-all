import transformStream from "easy-transform-stream";
import Revisioner from "./revisioner.js";
import PluginError from "plugin-error";

var PLUGIN_NAME = "gulp-rev-all";

export default {
  revision: function (options) {
    var revisioner = new Revisioner(options);

    // Feed the RevAll Revisioner with all the files in the stream, don't emit them until all of them have been processed
    return transformStream({ objectMode: true },
      function (file) {
        if (file.isStream()) {
          throw new PluginError(PLUGIN_NAME, "Streams not supported!");
        }

        if (file.isBuffer()) {
          revisioner.processFile(file);
        }

        file.revisioner = revisioner;
      },
      function () {
        revisioner.run();
        return Object.values(revisioner.files);
      }
    );
  },

  versionFile: function () {
    var revisioner;

    // Drop any existing files off the stream, push the generated version file
    return transformStream({ objectMode: true },
      function (file) {
        if (!revisioner) {
          revisioner = file.revisioner;
        }

        // Drop any existing files off the stream
      },
      function () {
        if (!revisioner) {
          throw new PluginError(PLUGIN_NAME, "revision() must be called first!");
        }

        return [revisioner.versionFile()];
      }
    );
  },

  manifestFile: function () {
    var revisioner;

    // Drop any existing files off the stream, push the generated manifest file
    return transformStream({ objectMode: true },
      function (file) {
        if (!revisioner) {
          revisioner = file.revisioner;
        }
      },
      function () {
        if (!revisioner) {
          throw new PluginError(PLUGIN_NAME, "revision() must be called first!");
        }

        return [revisioner.manifestFile()];
      }
    );
  },
};
