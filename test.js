var revall = require("./index");
var toolFactory = require("./tool");
var should = require("should");
var gulp = require("gulp");
var es = require("event-stream");
var fs = require("fs");
var util = require("util");
var Stream = require("stream");
var assert = require("assert");
var path = require('path');
var gutil = require("gulp-util");
var glob = require("glob");
 
require("mocha");

describe("gulp-rev-all", function () {

    describe('should process imagess', function() {
        var stream;

        beforeEach(function (done) {
            stream = revall();
            done();
        });

        var writeFile = function() {
            //write all files to stream
            var base = path.join(__dirname, 'test/fixtures/config1');
            glob("test/fixtures/config1/**/*.*", {}, function (er, fileNames) {
                fileNames.forEach(function (fileName) {
                    stream.write(new gutil.File({
                        path: path.join(__dirname, fileName),
                        contents: fs.readFileSync(fileName),
                        base: base
                    }));
                });

                stream.end()
            });
        };

        it("should revision images without corrupting them", function(done) {
            stream.on('data', function (file) {
            });
            stream.on('end', function () {
                done();
            })

            writeFile();
        });
    })

    describe('should process images', function() {
        var stream;

        beforeEach(function (done) {
            stream = revall();
            done();
        });

        var base = path.join(__dirname, 'test/fixtures/config1');
        var filename = path.join(base, 'img/image1.jpg');
        var writeFile = function() {
            stream.write(new gutil.File({
                path: filename,
                contents: fs.readFileSync(filename),
                base: base
            }));
        }

        it("should revision images without corrupting them", function(done) {
            stream.on('data', function (file) {
                file.contents[0].should.equal(255);
                file.contents[1].should.equal(216);
                file.contents[2].should.equal(255);
                file.contents[3].should.equal(224);
                done();
            });

            writeFile();
        });
    })

    describe("options:", function() {

        var stream;

        var writeFile = function() {
            //write all files to stream
            var base = path.join(__dirname, 'test/fixtures/config1');
            glob("test/fixtures/config1/**/*.*", {}, function (er, fileNames) {
                fileNames.forEach(function (fileName) {
                    stream.write(new gutil.File({
                        path: path.join(__dirname, fileName),
                        contents: fs.readFileSync(fileName),
                        base: base
                    }));
                });

                stream.end()
            });
        };

        describe("filename", function() {

            it("should have proper hash length when specified", function(done) {

                stream = revall({hashLength: 4, ignore: []});
                stream.on('data', function (file) {
                    path.basename(file.path).should.match(/\.[a-z0-9]{4}\.[a-z]{2,4}$/);
                });

                stream.on('end', done);

                writeFile();
            });

            it("should be transformed when transform function is specified", function(done) {

                stream = revall({
                    ignore: [],
                    transformFilename: function (file, hash) {
                        var ext = path.extname(file.path);
                        return hash.slice(0, 5) + '.'  + path.basename(file.path, ext) + ext; // 3410c.filename.ext
                    }
                });
                stream.on('data', function (file) {
                    path.basename(file.path).should.match(/[a-z0-9]{5}\..*\.[a-z]{2,4}$/);
                });

                stream.on('end', done);

                writeFile();
            });

        });


        describe("ignore", function() {


            it("should not rename favicon.ico by default", function (done) {
                stream = revall();
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/favicon\.[a-z0-9]{8}\.ico$/);
                });

                stream.on('end', done);

                writeFile();
            });

            it("should rename nested index", function (done) {
                stream = revall({ ignore: [ /^\/index.html/g ] });
                stream.on('data', function (file) {
                    file.path.should.not.match(/nested\/index\.html$/);
                    file.path.should.not.match(/config1\/index\.[a-z0-9]{8}\.html$/);
                });

                stream.on('end', done);

                writeFile();
            });

            it("should not rename html files when specified", function (done) {
                stream = revall({ ignore: ['.html'] });
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.html$/);
                });

                stream.on('end', done);

                writeFile();
            });


            it("should not rename js files when specified", function (done) {
                stream = revall({ ignore: ['.js'] });
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.js$/);
                });
                stream.on('end', done);

                writeFile();
            });


            it("should not rename woff files when specified", function (done) {
                stream = revall({ ignore: ['.woff'] });
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.woff$/);
                });
                stream.on('end', done);

                writeFile();
            });


            it("should rename all files when ignore not specified", function (done) {
                stream = revall();
                stream.on('data', function (file) {
                    path.basename(file.path).should.match(/(\.[a-z0-9]{8}\.[a-z]{2,4}$|favicon\.ico$)/);
                });
                stream.on('end', done);

                writeFile();
            });
        });

    });

    describe("root html", function() {
        var stream;
        var tool;

        beforeEach(function (done) {
            tool = toolFactory({hashLength: 8, ignore: ['favicon.ico'], dirRoot: path.join(__dirname, 'test/fixtures/config1') });
            stream = revall()
            done()
        });

        var base = path.join(__dirname, 'test/fixtures/config1');
        var filename = path.join(base, 'index.html');
        var writeFile = function() {
            stream.write(new gutil.File({
                path: filename,
                contents: fs.readFileSync(filename),
                base: base
            }));
        }

        it("should resolve absolute path reference", function(done) {
            stream.on('data', function (file) {

                String(file.contents).should.match(/'\/index\.[a-z0-9]{8}\.html'/);
                done();
            });

            writeFile();
        });

        it("should prefix replaced references if a prefix is supplied", function(done) {
            stream = revall({
                prefix: 'http://example.com/'
            });
            stream.on('data', function (file) {
                String(file.contents).should.match(/'http:\/\/example\.com\/index\.[a-z0-9]{8}\.html'/);
                done();
            });

            writeFile();
        });

        it("should replaced references using transform if it is supplied", function(done) {
            stream = revall({
                transformPath: function (reved, source, path) {
                    return this.joinPathUrl('//images.example.com/', reved.replace('img/', ''));
                }
            });
            stream.on('data', function (file) {
                //String(file.contents).should.containEql("//images.example.com/" + revedImage.replace('img/', ''));
                String(file.contents).should.match(/'\/\/images\.example\.com\/image\.[a-z0-9]{8}\.jpg'/);
                done();
            });

            writeFile();
        });

        it("should resolve reference to css", function(done) {
            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revFile('test/fixtures/config1/css/style.css'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

        it("should resolve reference reference to angularjs view", function(done) {
            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revFile('test/fixtures/config1/view/main.html'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });


        it("should resolve reference reference to javascript include", function(done) {
            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revFile('test/fixtures/config1/application.js'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });


        it("should resolve reference in double quotes ", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revFile('test/fixtures/config1/img/image1.jpg'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

        it("should resolve reference in single quotes", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revFile('test/fixtures/config1/img/image2.jpg'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

        it("should replace all references", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revFile('test/fixtures/config1/img/image3.jpg'));
                var count = String(file.contents).match(RegExp(revedReference, 'g'));
                count.length.should.eql(2);
                done();
            });

            writeFile();
        });

    });

    xdescribe("angularjs view", function() {
        var stream;

        beforeEach(function (done) {
            stream = revall()
            done()
        });

        var base = path.join(__dirname, 'test/fixtures/config1');
        var filename = path.join(base, 'view/main.html');
        var writeFile = function() {
            stream.write(new gutil.File({
                path: filename,
                contents: fs.readFileSync(filename),
                base: base
            }));
        }

        it("should resolve references to images", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revFile('test/fixtures/config1/img/image1.jpg'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

        it("should resolve references to angular includes", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tool.revFile('test/fixtures/config1/view/core/footer.html'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

    });

    xdescribe("css", function() { var stream;

        beforeEach(function (done) {
            stream = revall()
            done()
        });

        var base = path.join(__dirname, 'test/fixtures/config1');
        var filename = path.join(base, 'css/style.css');
        var writeFile = function() {
            stream.write(new gutil.File({
                path: filename,
                contents: fs.readFileSync(filename),
                base: base
            }));
        }

        it("should resolve references to fonts", function (done) {
            stream.on('data', function (file) {
                var revedReference1 = path.basename(tool.revFile('test/fixtures/config1/font/font1.eot'));
                String(file.contents).should.containEql(revedReference1);

                var revedReference2 = path.basename(tool.revFile('test/fixtures/config1/font/font1.woff'));
                String(file.contents).should.containEql(revedReference2);

                var revedReference3 = path.basename(tool.revFile('test/fixtures/config1/font/font1.ttf'));
                String(file.contents).should.containEql(revedReference3);

                var revedReference4 = path.basename(tool.revFile('test/fixtures/config1/font/font1.svg'));
                String(file.contents).should.containEql(revedReference4);

                done();
            });

            writeFile();

        });

        it("should resolve references to images", function (done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tool.revFile('test/fixtures/config1/img/image1.jpg'));
                String(file.contents).should.containEql(revedReference);

                var revedReference = path.basename(tool.revFile('test/fixtures/config1/img/image2.jpg'));
                String(file.contents).should.containEql(revedReference);

                done();
            });

            writeFile();
        });


    });

    xdescribe("main js", function() {

        var stream;

        beforeEach(function (done) {
            stream = revall()
            done()
        });
    
        var base = path.join(__dirname, 'test/fixtures/config1');
        var filename = path.join(base, 'application.js');
        var writeFile = function() {
            stream.write(new gutil.File({
                path: filename,
                contents: fs.readFileSync(filename)
            }));
        }

        it("should resolve references to angularjs views", function(done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tool.revFile('test/fixtures/config1/view/gps.html'));
                String(file.contents).should.containEql(revedReference);

                done()
            });

            writeFile();

        });

    });

});
