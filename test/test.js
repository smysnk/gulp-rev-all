var revall = require("../index");
var toolsFactory = require("../tools");
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

    var tools = toolsFactory({});

    describe('should process images', function() {
        var stream;

        beforeEach(function (done) {
            stream = revall({rootDir:'test/fixtures/config1'})
            done()
        });

        var writeFile = function() {
            stream.write(new gutil.File({
                path: 'test/fixtures/config1/img/image1.jpg',
                contents: fs.readFileSync('test/fixtures/config1/img/image1.jpg')
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
            glob("test/fixtures/config1/**/*.*", {}, function (er, fileNames) {
                fileNames.forEach(function (fileName) {
                    stream.write(new gutil.File({
                        path: fileName,
                        contents: fs.readFileSync(fileName)
                    }));
                });

                stream.end()
            });
        }

        describe("noIndexHtmlRev", function () {
            it('should not rename index.html if noIndexHtmlRev is set', function(done) {

                stream = revall({rootDir: 'test/fixtures/config1', noIndexHtmlRev: true});
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\index-[a-z0-9]{8}\.html$/);
                    if (file.path == 'index.html') {
                        var revedReference = path.basename(tools.revFile('test/fixtures/config1/css/style.css'));
                        String(file.contents).should.containEql(revedReference);
                    }
                });

                stream.on('end', done);

                writeFile();
            });

        });

        describe("hash length", function() {

            it("should have proper length when specified", function(done) {

                stream = revall({rootDir: 'test/fixtures/config1', hashLength: 4});
                stream.on('data', function (file) {
                    path.basename(file.path).should.match(/\-[a-z0-9]{4}\.[a-z]{2,4}$/);
                });

                stream.on('end', done);

                writeFile();
            });

        });


        describe("ignore extension", function() {


            it("should not rename html files when specified", function (done) {
                stream = revall({rootDir: 'test/fixtures/config1', ignoredExtensions: ['.html']});
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\-[a-z0-9]{8}\.html$/);
                });

                stream.on('end', done);

                writeFile();
            });


            it("should not rename js files when specified", function (done) {
                stream = revall({rootDir: 'test/fixtures/config1', ignoredExtensions: ['.js']});
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\-[a-z0-9]{8}\.js$/);
                });
                stream.on('end', done);

                writeFile();
            });


            it("should not rename woff files when specified", function (done) {
                stream = revall({rootDir: 'test/fixtures/config1', ignoredExtensions: ['.woff']});
                stream.on('data', function (file) {
                    path.basename(file.path).should.not.match(/\-[a-z0-9]{8}\.woff$/);
                });
                stream.on('end', done);

                writeFile();
            });
        });

    });

    describe("root html", function() {
        var stream;

        beforeEach(function (done) {
            stream = revall({rootDir:'test/fixtures/config1'})
            done()
        });

        var writeFile = function() {
            stream.write(new gutil.File({
                path: 'test/fixtures/config1/index.html',
                contents: fs.readFileSync('test/fixtures/config1/index.html')
            }));
        }

        it("should resolve reference to css", function(done) {
            stream.on('data', function (file) {
                var revedReference = path.basename(tools.revFile('test/fixtures/config1/css/style.css'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

        it("should resolve reference reference to angularjs view", function(done) {
            stream.on('data', function (file) {
                var revedReference = path.basename(tools.revFile('test/fixtures/config1/view/main.html'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });


        it("should resolve reference reference to javascript include", function(done) {
            stream.on('data', function (file) {
                var revedReference = path.basename(tools.revFile('test/fixtures/config1/application.js'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });


        it("should resolve reference in double quotes ", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tools.revFile('test/fixtures/config1/img/image1.jpg'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

        it("should resolve reference in single quotes", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tools.revFile('test/fixtures/config1/img/image2.jpg'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

        it("should replace all references", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tools.revFile('test/fixtures/config1/img/image3.jpg'));
                var count = String(file.contents).match(RegExp(revedReference, 'g'));
                count.length.should.eql(2);
                done();
            });

            writeFile();
        });

    });

    describe("angularjs view", function() {
        var stream;

        beforeEach(function (done) {
            stream = revall({rootDir:'test/fixtures/config1'})
            done()
        });

        var writeFile = function() {
            stream.write(new gutil.File({
                path: 'test/fixtures/config1/view/main.html',
                contents: fs.readFileSync('test/fixtures/config1/view/main.html')
            }));
        }

        it("should resolve references to images", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tools.revFile('test/fixtures/config1/img/image1.jpg'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

        it("should resolve references to angular includes", function(done) {

            stream.on('data', function (file) {
                var revedReference = path.basename(tools.revFile('test/fixtures/config1/view/core/footer.html'));
                String(file.contents).should.containEql(revedReference);
                done();
            });

            writeFile();
        });

    });

    describe("css", function() { var stream;

        beforeEach(function (done) {
            stream = revall({rootDir:'test/fixtures/config1'})
            done()
        });

        var writeFile = function() {
            stream.write(new gutil.File({
                path: 'test/fixtures/config1/css/style.css',
                contents: fs.readFileSync('test/fixtures/config1/css/style.css')
            }));
        }

        it("should resolve references to fonts", function (done) {
            stream.on('data', function (file) {
                var revedReference1 = path.basename(tools.revFile('test/fixtures/config1/font/font1.eot'));
                String(file.contents).should.containEql(revedReference1);

                var revedReference2 = path.basename(tools.revFile('test/fixtures/config1/font/font1.woff'));
                String(file.contents).should.containEql(revedReference2);

                var revedReference3 = path.basename(tools.revFile('test/fixtures/config1/font/font1.ttf'));
                String(file.contents).should.containEql(revedReference3);

                var revedReference4 = path.basename(tools.revFile('test/fixtures/config1/font/font1.svg'));
                String(file.contents).should.containEql(revedReference4);

                done();
            });

            writeFile();

        });

        it("should resolve references to images", function (done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tools.revFile('test/fixtures/config1/img/image1.jpg'));
                String(file.contents).should.containEql(revedReference);

                done();
            });

            writeFile();
        });


    });

    describe("main js", function() {

        var stream;

        beforeEach(function (done) {
            stream = revall({rootDir:'test/fixtures/config1'})
            done()
        });

        var writeFile = function() {
            stream.write(new gutil.File({
                path: 'test/fixtures/config1/application.js',
                contents: fs.readFileSync('test/fixtures/config1/application.js')
            }));
        }

        it("should resolve references to angularjs views", function(done) {

            stream.on('data', function (file) {

                var revedReference = path.basename(tools.revFile('test/fixtures/config1/view/gps.html'));
                String(file.contents).should.containEql(revedReference);

                done()
            });

            writeFile();

        });

    });

});
