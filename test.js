var RevAll = require("./index");
var Tool = require("./tool");
var Path = require("path");
var gulp = require("gulp");
var Vinyl = require("vinyl");
var es = require("event-stream");
var crypto = require("crypto");

require("should");
require("mocha");

describe("gulp-rev-all", function () {
  var streamRevision, revisioner, files;

  var setup = function (options) {
    streamRevision = RevAll.revision(options);
    streamRevision.on("data", function (file) {
      revisioner = file.revisioner;
      files = revisioner.files;
    });
  };

  describe("basic usage", function () {
    it("should be able to call all methods", function (done) {
      gulp
        .src(["test/fixtures/config1/**"])
        .pipe(RevAll.revision())
        .pipe(RevAll.versionFile())
        .pipe(
          es.map(function (file, callback) {
            Path.basename(file.path).should.equal("rev-version.json");
            return callback(null, file);
          })
        )
        .pipe(RevAll.manifestFile())
        .pipe(
          es.map(function (file, callback) {
            Path.basename(file.path).should.equal("rev-manifest.json");
            done();
            return callback(null, file);
          })
        );
    });

    it("should throw an error when versionFile() is called before revision()", function (done) {
      gulp
        .src(["test/fixtures/config1/**"])
        .pipe(RevAll.versionFile())
        .on("error", function (err) {
          err.message.should.equal("revision() must be called first!");
          done();
        })
        .pipe(
          es.map(function () {
            done("shouldnt get here");
          })
        );
    });

    it("should throw an error when manifestFile() is called before revision()", function (done) {
      gulp
        .src(["test/fixtures/config1/**"])
        .pipe(RevAll.manifestFile())
        .on("error", function (err) {
          err.message.should.equal("revision() must be called first!");
          done();
        })
        .pipe(
          es.map(function () {
            done("shouldnt get here");
          })
        );
    });
  });

  describe("resource hash calculation", function () {
    it("should not change on consecutive runs with no changes", function (done) {
      setup();

      streamRevision.on("end", function () {
        var pathBaseline = files["/css/style.css"].path;

        // Re-run the revisioner to re-calculate the filename hash
        revisioner.run();
        files["/css/style.css"].path.should.equal(pathBaseline);

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should change if child reference changes", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var pathBaseline = files["/css/style.css"].path;

        // Modify the hash of a dependency
        files["/img/image1.jpg"].revHashOriginal = "changed";

        // Re-run the revisioner to re-calculate the filename hash
        revisioner.run();
        files["/css/style.css"].path.should.not.equal(pathBaseline);

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should change if the prefix changed and it has absolute references", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var pathBaseline = files["/index.html"].path;

        // Apply a prefix to absolute references.
        revisioner.options.prefix = "http://example.com/";

        // Re-run the revisioner to re-calculate the filename hash
        revisioner.run();
        files["/index.html"].path.should.not.equal(pathBaseline);

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    /**
     * Should resolve hash change, both ways
     * Context: https://github.com/smysnk/gulp-rev-all/pull/44
     */
    it("should handle circular reference scenario both ways", function (done) {
      // Increase allowed time, so doesn't timeout on travis-ci
      this.timeout(3000);

      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        // Gather baseline paths
        revisioner.run();
        var pathGpsBaseline = files["/view/gps.html"].path;
        var hashGpsBaseline = files["/view/gps.html"].revHashOriginal;

        var pathAboutBaseline = files["/view/about.html"].path;

        var pathMainBaseline = files["/view/main.html"].path;

        // Change one of the references
        files["/view/gps.html"].revHashOriginal = "changed";
        revisioner.run();

        // All 3 should have changed
        files["/view/gps.html"].path.should.not.equal(pathGpsBaseline);
        files["/view/about.html"].path.should.not.equal(pathAboutBaseline);
        files["/view/main.html"].path.should.not.equal(pathMainBaseline);

        // Revert back
        files["/view/gps.html"].revHashOriginal = hashGpsBaseline;
        revisioner.run();
        files["/view/gps.html"].path.should.equal(pathGpsBaseline);
        files["/view/about.html"].path.should.equal(pathAboutBaseline);
        files["/view/main.html"].path.should.equal(pathMainBaseline);

        // Try the other reference
        files["/view/main.html"].revHashOriginal = "changed";
        revisioner.run();

        // All 3 should have changed
        files["/view/gps.html"].path.should.not.equal(pathGpsBaseline);
        files["/view/about.html"].path.should.not.equal(pathAboutBaseline);
        files["/view/main.html"].path.should.not.equal(pathMainBaseline);

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });
  });

  describe("should process images", function () {
    it("should not corrupt them", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var file = files["/img/image1.jpg"];
        file.contents[0].should.equal(255);
        file.contents[1].should.equal(216);
        file.contents[2].should.equal(255);
        file.contents[3].should.equal(224);

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });
  });

  describe("should process pdf documents", function () {
    it("should not corrupt them", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var file = files["/pdf/file.pdf"];
        var md5sum = crypto
          .createHash("md5")
          .update(file.contents)
          .digest("hex");
        md5sum.should.equal("c0bd1ef1ddc413b21eff81e705012bfc");

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });
  });

  describe("options:", function () {
    describe("prefix", function () {
      it("should prefix absolute references", function (done) {
        setup({ prefix: "http://example.com/" });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.match(
            /"http:\/\/example\.com\/index\.[a-z0-9]{8}\.html"/
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should not prefix relative references", function (done) {
        setup({ prefix: "http://example.com/" });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.not.match(
            /"http:\/\/example\.com\/img\/image1\.[a-z0-9]{8}\.jpg"/
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });
    });

    describe("filename", function () {
      it("should have proper hash length when specified", function (done) {
        setup({ hashLength: 4 });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          files["/index.html"].path.should.match(/\.[a-z0-9]{4}\.[a-z]{2,4}$/);
          done();
        });

        gulp.src(["test/fixtures/config1/index.html"]).pipe(streamRevision);
      });

      it("should be transformed when transform function is specified", function (done) {
        setup({
          dontGlobal: [],
          dontUpdateReference: [],
          dontRenameFile: [],
          transformFilename: function (file, hash) {
            var ext = Path.extname(file.path);
            return hash.slice(0, 5) + "." + Path.basename(file.path, ext) + ext; // 3410c.glob.ext
          },
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          for (var path in files) {
            Path.basename(files[path].path).should.match(
              /[a-z0-9]{5}\..*\.[a-z]{2,4}$/
            );
          }
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });
    });

    describe("dontGlobal", function () {
      it("should not update favicon.ico reference by default", function (done) {
        setup();

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.not.match(
            /"favicon\.[a-z0-9]{8}\.ico"/g
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should not update references when specified with file extension", function (done) {
        setup({
          dontGlobal: [".html"],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.not.match(
            /\.[a-z0-9]{8}\.html/g
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should not update references when specified with file regex", function (done) {
        setup({
          dontGlobal: [/.html$/g],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.not.match(
            /\.[a-z0-9]{8}\.html/g
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should not rename when specified with files extension", function (done) {
        setup({
          dontGlobal: [".js"],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.match(
            /"[a-z0-9/]*\.js"/
          );
          done();
        });
        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should not rename when specified with files extension", function (done) {
        setup({
          dontGlobal: [/.js$/g],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.match(
            /"[a-z0-9/]*\.js"/
          );
          done();
        });
        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });
    });

    describe("dontRenameFile", function () {
      it("should rename nested index", function (done) {
        setup({
          dontRenameFile: [/^\/index.html/g],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          files["/nested/index.html"].path.should.not.match(
            /\/nested\/index\.html$/
          );
          files["/index.html"].path.should.not.match(
            /index\.[a-z0-9]{8}\.html$/
          );

          done();
        });
        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should not rename html files when specified", function (done) {
        setup({
          dontRenameFile: [".html"],
        });

        streamRevision.on("data", function (file) {
          Path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.html$/);
        });

        streamRevision.on("end", done);
        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should still process and re-write references in a dontRenameFile file", function (done) {
        setup({
          dontRenameFile: [".html"],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.match(
            /[a-z0-9]*\.[a-z0-9]{8}\.[a-z]{2,4}/
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });
    });

    describe("dontUpdateReference", function () {
      it("should not update reference when specified with file extension", function (done) {
        setup({
          dontUpdateReference: [".html"],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.not.match(
            /\.[a-z0-9]{8}\.html/g
          );
          String(files["/index.html"].contents).should.match(
            /\.[a-z0-9]{8}\.jpg/g
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should not update reference when specified with file regex", function (done) {
        setup({
          dontUpdateReference: [/.html$/g],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.not.match(
            /\.[a-z0-9]{8}\.html/g
          );
          String(files["/index.html"].contents).should.match(
            /\.[a-z0-9]{8}\.jpg/g
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });
    });

    describe("dontSearchFile", function () {
      it("should not update reference when specified with file extension", function (done) {
        setup({
          dontSearchFile: [".html"],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.not.match(
            /\.[a-z0-9]{8}\./g
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should not update reference when specified with file regex", function (done) {
        setup({
          dontSearchFile: [/.html$/g],
        });

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/index.html"].contents).should.not.match(
            /\.[a-z0-9]{8}\./g
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });
    });
  });

  describe("globbing", function () {
    describe("multiple globs", function () {
      it("should set base to common directory", function (done) {
        setup();

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          revisioner.pathBase.should.match(/\/test\/fixtures\/config1\/$/g);
          done();
        });

        gulp
          .src([
            "test/fixtures/config1/script/**",
            "test/fixtures/config1/lib/**",
          ])
          .pipe(streamRevision);
      });

      it("should resolve references correctly", function (done) {
        setup();

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          String(files["/script/main.js"].contents).should.containEql(
            Path.basename(
              files["/lib/angular.js"].revFilename,
              files["/lib/angular.js"].revFilenameExtOriginal
            )
          );
          done();
        });

        gulp
          .src([
            "test/fixtures/config1/script/**",
            "test/fixtures/config1/lib/**",
          ])
          .pipe(streamRevision);
      });
    });
  });

  describe("root html", function () {
    it("should resolve absolute path reference", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        String(files["/index.html"].contents).should.match(
          /"\/index\.[a-z0-9]{8}\.html"/
        );
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should replaced references using transform if it is supplied", function (done) {
      setup({
        transformPath: function (reved) {
          return this.Tool.join_path_url(
            "//images.example.com/",
            reved.replace("img/", "")
          );
        },
      });

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        String(files["/index.html"].contents).should.match(
          /\/\/images\.example\.com\/image1\.[a-z0-9]{8}\.jpg/
        );
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve reference to css", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        String(files["/index.html"].contents).match(
          /\/css\/style\.[a-z0-9]{8}\.css/g
        );
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve reference reference to angularjs view", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        String(files["/index.html"].contents).match(
          /\/view\/main\.[a-z0-9]{8}\.html/g
        );
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve reference reference to javascript include", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        String(files["/index.html"].contents).match(
          /"\/script\/main\.[a-z0-9]{8}\.js"/g
        );
        String(files["/index.html"].contents).match(
          /"\/lib\/require\.[a-z0-9]{8}\.js"/g
        );

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve reference in double quotes", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        String(files["/index.html"].contents).match(
          /"\/img\/image1\.[a-z0-9]{8}\.jpg"/g
        );
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve reference in single quotes", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        String(files["/index.html"].contents).match(
          /'\/img\/image2\.[a-z0-9]{8}\.jpg'/g
        );
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should replace srcset referencess", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var count = String(files["/index.html"].contents).match(
          /image-[0-4]x\.[a-z0-9]{8}\.png/g
        );
        count.length.should.eql(4);

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should replace multiple occurances of the same reference", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var count = String(files["/index.html"].contents).match(
          /img\/image3\.[a-z0-9]{8}\.jpg/g
        );
        count.length.should.eql(2);
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });
  });

  describe("nested html", function () {
    it("should prioritize relative refereference", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var hashRelative = files["/nested/config.js"].revFilename;
        var hashAbsolute = files["/config.js"].revFilename;

        var contents = String(files["/nested/index.html"].contents);
        contents.should.containEql(hashRelative);
        contents.should.not.containEql(hashAbsolute);
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve both relative and absolute references correctly", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var hashRelative = files["/nested/index.html"].revFilename;
        var hashAbsolute = files["/index.html"].revFilename;

        var contents = String(files["/nested/index.html"].contents);
        contents.should.containEql(hashRelative);
        contents.should.containEql(hashAbsolute);
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });
  });

  describe("angularjs view", function () {
    it("should resolve references to images", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var count = String(files["/view/main.html"].contents).match(
          /\.[a-z0-9]{8}\.jpg/g
        );
        count.length.should.eql(1);
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve references to angular includes", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var count = String(files["/view/main.html"].contents).match(
          /view\/core\/footer\.[a-z0-9]{8}\.html/g
        );
        count.length.should.eql(1);
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });
  });

  describe("css", function () {
    it("should resolve references to fonts", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var contents = String(files["/css/style.css"].contents);

        contents.should.containEql(files["/font/font1.eot"].revFilename);
        contents.should.containEql(files["/font/font1.woff"].revFilename);
        contents.should.containEql(files["/font/font1 space.ttf"].revFilename);
        contents.should.containEql(files["/font/font1.svg"].revFilename);

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve references to images", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var contents = String(files["/css/style.css"].contents);

        contents.should.containEql(files["/img/image1.jpg"].revFilename);
        contents.should.containEql(files["/img/image2.jpg"].revFilename);

        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });
  });

  describe("reference resolution", function () {
    it("should resolve references when base is specified", function (done) {
      streamRevision = RevAll.revision({
        prefix: "http://cdn.com/",
        dontGlobal: [/\/favicon\.ico$/],
        dontRenameFile: [/\.html$/],
      });

      streamRevision.on("data", function (file) {
        revisioner = file.revisioner;
        files = revisioner.files;
      });

      streamRevision.on("end", function () {
        String(files["/view/main.html"].contents).should.match(
          /"http:\/\/cdn\.com\/css\/style\.[a-z0-9]{8}\.css"/
        );
        done();
      });

      gulp
        .src(
          [
            "test/fixtures/config1/view/**",
            "test/fixtures/config1/font/**",
            "test/fixtures/config1/img/**",
            "test/fixtures/config1/script/app.js",
            "test/fixtures/config1/css/style.css",
          ],
          {
            base: "test/fixtures/config1",
          }
        )
        .pipe(streamRevision);
    });

    it("should not add .js to short references", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var contents = String(files["/script/app.js"].contents);
        contents.should.not.containEql(
          "var short = require(" + files["/script/short.js"].revFilename + ");"
        );
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should not resolve arbitrary text with the same name as a file", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var contents = String(files["/script/app.js"].contents);
        contents.should.not.containEql(
          "var " + files["/script/short.js"].revFilename
        );
        contents.should.not.containEql(
          "function (" + files["/script/app.js"].revFilename + ")"
        );
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve references to regular commonjs include", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var contents = String(files["/script/app.js"].contents);
        contents.should.containEql(files["/script/layout.js"].revFilename);
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve references to short style commonjs include", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var contents = String(files["/script/app.js"].contents);

        // Rebuild include as we should expect it, eg.  require('./short.abcdef');
        var reference =
          "./" +
          files["/script/short.js"].revFilename.substr(
            0,
            files["/script/short.js"].revFilename.length - 3
          );
        contents.should.containEql(reference);

        reference =
          "./" +
          files["/script/shortDuplicate.js"].revFilename.substr(
            0,
            files["/script/shortDuplicate.js"].revFilename.length - 3
          );
        contents.should.containEql(reference);
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve references to angularjs views", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var contents = String(files["/script/app.js"].contents);
        contents.should.containEql(files["/view/gps.html"].revFilename);
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    it("should resolve references in angularjs inline templates", function (done) {
      setup();

      streamRevision.on("data", function () {});
      streamRevision.on("end", function () {
        var contents = String(files["/script/app.js"].contents);
        contents.should.containEql(files["/img/image1.jpg"].revFilename);
        done();
      });

      gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
    });

    describe("source map", function () {
      it("should resolve reference with spaces after map statement", function (done) {
        setup();

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          var contents = String(files["/script/app.js"].contents);
          contents.should.containEql(
            "//# sourceMappingURL=" + files["/script/app.js.map"].revFilename
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });

      it("should resolve reference with no characters after map statement", function (done) {
        setup();

        streamRevision.on("data", function () {});
        streamRevision.on("end", function () {
          var contents = String(
            files["/script/no_space_after_map.js"].contents
          );
          contents.should.containEql(
            "//# sourceMappingURL=" +
              files["/script/no_space_after_map.js.map"].revFilename
          );
          done();
        });

        gulp.src(["test/fixtures/config1/**"]).pipe(streamRevision);
      });
    });
  });

  describe("Tool", function () {
    describe("joinPath", function () {
      describe("windows", function () {
        it("should correct slashes", function () {
          Tool.join_path("d:\\first\\second", "images.png").should.equal(
            "/first/second/images.png"
          );
        });

        it("should not add starting slash", function () {
          Tool.join_path("first\\second", "images.png").should.equal(
            "first/second/images.png"
          );
        });
      });

      describe("posix", function () {
        it("should correct slashes", function () {
          Tool.join_path("/first/second", "images.png").should.equal(
            "/first/second/images.png"
          );
        });

        it("should not add starting slash", function () {
          Tool.join_path("first/second", "images.png").should.equal(
            "first/second/images.png"
          );
        });
      });
    });

    describe("get_relative_path", function () {
      it("should only truncate paths that overap with the base", function () {
        Tool.get_relative_path("/base/", "sub/index.html").should.equal(
          "sub/index.html"
        );
        Tool.get_relative_path("/base/", "/sub/index.html").should.equal(
          "/sub/index.html"
        );
        Tool.get_relative_path("/base/", "/base/sub/index.html").should.equal(
          "/sub/index.html"
        );
      });

      describe("windows", function () {
        it("should correct slashes", function () {
          Tool.get_relative_path(
            "c:\\base",
            "c:\\base\\sub\\index.html"
          ).should.equal("/sub/index.html");
          Tool.get_relative_path(
            "c:\\base\\",
            "c:\\base\\sub\\index.html"
          ).should.equal("/sub/index.html");
        });

        it("should remove starting slash", function () {
          Tool.get_relative_path(
            "d:\\base",
            "d:\\base\\sub\\index.html",
            true
          ).should.equal("sub/index.html");
          Tool.get_relative_path(
            "d:\\base\\",
            "d:\\base\\sub\\index.html",
            true
          ).should.equal("sub/index.html");
        });

        it("should work on base", function () {
          Tool.get_relative_path(
            "e:\\base\\sub",
            "e:\\base\\sub\\index.html",
            true
          ).should.equal("index.html");
          Tool.get_relative_path(
            "e:\\base\\sub\\",
            "e:\\base\\sub\\index.html",
            true
          ).should.equal("index.html");
        });
      });

      describe("posix", function () {
        it("should correct slashes", function () {
          Tool.get_relative_path("/base/", "/base/sub/index.html").should.equal(
            "/sub/index.html"
          );
          Tool.get_relative_path("/base", "/base/sub/index.html").should.equal(
            "/sub/index.html"
          );
        });

        it("should remove starting slash", function () {
          Tool.get_relative_path(
            "/base/",
            "/base/sub/index.html",
            true
          ).should.equal("sub/index.html");
          Tool.get_relative_path(
            "/base",
            "/base/sub/index.html",
            true
          ).should.equal("sub/index.html");
        });

        it("should work on base", function () {
          Tool.get_relative_path(
            "/base/sub/",
            "/base/sub/index.html",
            true
          ).should.equal("index.html");
          Tool.get_relative_path(
            "/base/sub",
            "/base/sub/index.html",
            true
          ).should.equal("index.html");
        });
      });
    });

    describe("get_reference_representations", function () {
      describe("_relative", function () {
        describe("producing alternate representations for javascript (without the extension)", function () {
          it("should not when the context is a html file", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/third/script.js",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("script.js");
            references[1].should.equal("./script.js");
          });

          it("should when the context is a javascript file", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/other.js",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/third/script.js",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("script.js");
            references[1].should.equal("./script.js");
          });
        });

        describe("should resolve references that have 0 traversals", function () {
          it("0 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/third/other.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("other.html");
            references[1].should.equal("./other.html");
          });

          it("1 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/third/fourth/other.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("fourth/other.html");
            references[1].should.equal("./fourth/other.html");
          });

          if (/^win/.test(process.platform)) {
            it("windows path", function () {
              var base = "c:\\first\\second";

              var file = new Vinyl({
                path: "c:\\first\\second\\third\\index.html",
                base: base,
              });

              var fileReference = new Vinyl({
                path: "c:\\first\\second\\third\\fourth\\other.html",
                base: base,
              });

              file.revPathOriginal = file.path;
              fileReference.revPathOriginal = fileReference.path;

              var references = Tool.get_reference_representations_relative(
                fileReference,
                file
              );

              references.length.should.equal(2);
              references[0].should.equal("fourth/other.html");
              references[1].should.equal("./fourth/other.html");
            });
          }
        });

        describe("should resolve references that have 1 traversals", function () {
          it("0 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(1);
            references[0].should.equal("../index.html");
          });

          it("1 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/other/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(1);
            references[0].should.equal("../other/index.html");
          });

          it("1 deep to similar directory", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/thirder/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(1);
            references[0].should.equal("../thirder/index.html");
          });

          it("2 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/other/advanced/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(1);
            references[0].should.equal("../other/advanced/index.html");
          });
        });

        describe("should resolve references that have 2 traversals", function () {
          it("0 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/fourth/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(1);
            references[0].should.equal("../../index.html");
          });

          it("1 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/fourth/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/other/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(1);
            references[0].should.equal("../../other/index.html");
          });

          it("2 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/fourth/fifth/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/other/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_relative(
              fileReference,
              file
            );

            references.length.should.equal(1);
            references[0].should.equal("../../../other/index.html");
          });
        });
      });

      describe("_absolute", function () {
        describe("producing alternate representations for javascript (without the extension)", function () {
          it("should not when the context is a html file", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/third/script.js",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/third/script.js");
            references[1].should.equal("third/script.js");
          });

          it("should when the context is a javascript file", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/other.js",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/third/script.js",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/third/script.js");
            references[1].should.equal("third/script.js");
          });
        });

        describe("should resolve references that have 0 traversals", function () {
          it("0 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/third/other.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/third/other.html");
            references[1].should.equal("third/other.html");
          });

          it("1 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/third/fourth/other.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/third/fourth/other.html");
            references[1].should.equal("third/fourth/other.html");
          });
        });

        describe("should resolve references that have 1 traversals", function () {
          it("0 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/index.html");
            references[1].should.equal("index.html");
          });

          it("1 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/other/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/other/index.html");
            references[1].should.equal("other/index.html");
          });

          it("1 deep to similar directory", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/thirder/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/third/index.html");
            references[1].should.equal("third/index.html");
          });

          it("2 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/other/advanced/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/other/advanced/index.html");
            references[1].should.equal("other/advanced/index.html");
          });
        });

        describe("should resolve references that have 2 traversals", function () {
          it("0 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/fourth/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/index.html");
            references[1].should.equal("index.html");
          });

          it("1 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/fourth/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/other/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/other/index.html");
            references[1].should.equal("other/index.html");
          });

          it("2 deep", function () {
            var base = "/first/second";

            var file = new Vinyl({
              path: "/first/second/third/fourth/fifth/index.html",
              base: base,
            });

            var fileReference = new Vinyl({
              path: "/first/second/other/index.html",
              base: base,
            });

            file.revPathOriginal = file.path;
            fileReference.revPathOriginal = fileReference.path;

            var references = Tool.get_reference_representations_absolute(
              fileReference,
              file
            );

            references.length.should.equal(2);
            references[0].should.equal("/other/index.html");
            references[1].should.equal("other/index.html");
          });
        });
      });
    });
  });
});
