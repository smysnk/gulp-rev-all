var RevAll = require('./index');
var toolFactory = require('./tool');
var should = require('should');
var gulp = require('gulp');
var es = require('event-stream');
var fs = require('fs');
var util = require('util');
var Stream = require('stream');
var assert = require('assert');
var Path = require('path');
var gutil = require('gulp-util');
var glob = require('glob');
var sinon = require('sinon');
var Q = require('q');
 
require('mocha');

describe('gulp-rev-all', function () {

    var base = Path.join(__dirname, 'test/fixtures/config1');
    var write_glob_to_stream = function (path, stream) {

        glob(path, {}, function (er, fileNames) {
            fileNames.forEach(function (fileName) {
                stream.write(new gutil.File({
                    path: Path.resolve(fileName),
                    contents: fs.readFileSync(fileName),
                    base: base
                }));
            });

            stream.end();
        });

    };

    var write_to_stream = function (name, content, stream) {

        var file = new gutil.File({
            path: name,
            contents: new Buffer(content),
            base: base
        });
        stream.write(file);

    };

    var get_file = function (filePath) {

        return new gutil.File({
            path: Path.join(__dirname, filePath),
            contents: fs.readFileSync(filePath),
            base: base
        });

    };

    var revAll, streamRevision, tool, cache;

    beforeEach(function () {

        cache = {};
        revAll = new RevAll({ cache: cache });
        streamRevision = revAll.revision();
        tool = revAll.getTool();

    });    

    describe('resource hash calculation', function () {

        it('should change if child reference changes', function (done) {
            
            var fileStyleBaseline = revAll.getTool().revisionFile(get_file('test/fixtures/config1/css/style.css'));
            
            // All child references of style.css should return contents 'dummy' instead of regular content
            var fsMock = {
                readFileSync: sinon.stub().returns(new Buffer('dummy')),
                existsSync: sinon.stub().returns(true),
                lstatSync: function () { 
                    return {
                        isDirectory: function (abc) { 
                            return false; 
                        }
                    }; 
                }
            };

            revAll = new RevAll({ fs: fsMock });
            streamRevision = revAll.revision();
            console.log('cache', revAll.getTool().cache);

            streamRevision.on('data', function (file) {
                file.path.should.not.equal(fileStyleBaseline.path);
            });

            streamRevision.on('end', function () {
                done();
            });

            write_glob_to_stream('test/fixtures/config1/css/style.css', streamRevision);

        });

        it('should change if a circular referenced file changes', function (done) {

            var FILE_A = 'a.html';
            var FILE_B = 'b.html';

            var fileSystem1 = {};
            fileSystem1[FILE_A] = '<a href="b.html">Go to B</a>';
            fileSystem1[FILE_B] = '<a href="a.html">Go to A</a>';

            var fileSystem2 = {};
            fileSystem2[FILE_A] = '<a href="b.html">Click here ro go to B</a>';
            fileSystem2[FILE_B] = '<a href="a.html">Go to A</a>';

            var pathMock = {
                resolve: function (filepath) {
                    return filepath;
                },
                join: Path.join,
                extname: Path.extname,
                basename: Path.basename,
                dirname: Path.dirname,
            };


            var run = function (fileSystem) {

                var fsMock = {
                    existsSync: sinon.stub().returns(true),
                    lstatSync: sinon.stub().returns({ isDirectory: function () { return false; }}),
                    readFileSync: function (filepath) {
                        var parts = filepath.split('/');
                        var filename = parts[parts.length - 1];
                        console.log(fileSystem[filename]);
                        return new Buffer(fileSystem[filename]);
                    },
                };

                var cache = {};
                var cacheDeferred = Q.defer();
                var revAll = new RevAll({ fs: fsMock, path: pathMock, cache: cache });
                var streamRevision = revAll.revision();

                streamRevision.on('data', function () {});
                streamRevision.on('end', function () {
                    cacheDeferred.resolve(cache);
                });

                write_to_stream(FILE_A, fileSystem[FILE_A], streamRevision);
                write_to_stream(FILE_B, fileSystem[FILE_B], streamRevision);
                streamRevision.end();

                return cacheDeferred.promise;

            };

            Q.all([run(fileSystem1), run(fileSystem2)])
                .then(function (caches) { 

                    caches[0][FILE_A].hash.should.not.be.equal(caches[1][FILE_A].hash);
                    caches[0][FILE_B].hash.should.not.be.equal(caches[1][FILE_B].hash);

                })
                .done();

        });

    });

    describe('should process images', function () {

        var filename = Path.join(base, 'img/image1.jpg');
        it('without corrupting them', function (done) {

            streamRevision.on('data', function (file) {
                file.contents[0].should.equal(255);
                file.contents[1].should.equal(216);
                file.contents[2].should.equal(255);
                file.contents[3].should.equal(224);
                done();
            });

            write_glob_to_stream(filename, streamRevision);

        });
    });

    describe('options:', function () {

        describe('filename', function () {

            it('should have proper hash length when specified', function (done) {

                var streamRevision = new RevAll({ hashLength: 4, ignore: [] }).revision();
                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.match(/\.[a-z0-9]{4}\.[a-z]{2,4}$/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/**/*.*', streamRevision);

            });

            it('should be transformed when transform function is specified', function (done) {

                var streamRevision = new RevAll({
                    ignore: [],
                    transformFilename: function (file, hash) {
                        var ext = Path.extname(file.path);
                        return hash.slice(0, 5) + '.'  + Path.basename(file.path, ext) + ext; // 3410c.filename.ext
                    }
                }).revision();

                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.match(/[a-z0-9]{5}\..*\.[a-z]{2,4}$/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/**/*.*', streamRevision);

            });

        });


        describe('ignore', function () {

            it('should not rename favicon.ico by default', function (done) {

                streamRevision = new RevAll().revision();
                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.not.match(/favicon\.[a-z0-9]{8}\.ico$/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/**/*.*', streamRevision);

            });

            it('should rename nested index', function (done) {

                streamRevision = new RevAll({ ignore: [ /^\/index.html/g ] }).revision();
                streamRevision.on('data', function (file) {
                    file.path.should.not.match(/nested\/index\.html$/);
                    file.path.should.not.match(/config1\/index\.[a-z0-9]{8}\.html$/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/**/*.*', streamRevision);

            });

            it('should not rename html files when specified', function (done) {

                streamRevision = new RevAll({ ignore: ['.html'] }).revision();
                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.html$/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/**/*.*', streamRevision);

            });

            it('should still process and re-write references in a ignored file', function (done) {

                streamRevision = new RevAll({ ignore: ['.html'] }).revision();
                streamRevision.on('data', function (file) {
                    String(file.contents).contents.should.match(/\'[a-z0-9]*\.[a-z0-9]{8}\.[a-z]{2,4}\'/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/index.html', streamRevision);

            });

            it('should not rename reference if that reference is ignored', function (done) {

                streamRevision = new RevAll({ ignore: ['.js'] }).revision();
                streamRevision.on('data', function (file) {
                    String(file.contents).should.match(/\'[a-z0-9]*\.js\'/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/index.html', streamRevision);

            });

            it('should not rename js files when specified', function (done) {

                streamRevision = new RevAll({ ignore: ['.js'] }).revision();
                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.js$/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/**/*.*', streamRevision);

            });


            it('should not rename woff files when specified', function (done) {

                streamRevision = new RevAll({ ignore: ['.woff'] }).revision();
                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.woff$/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/**/*.*', streamRevision);

            });


            it('should rename all files when ignore not specified', function (done) {

                streamRevision = new RevAll().revision();
                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.match(/(\.[a-z0-9]{8}\.[a-z]{2,4}$|favicon\.ico$)/);
                });

                streamRevision.on('end', done);
                write_glob_to_stream('test/fixtures/config1/**/*.*', streamRevision);

            });
        });

    });

    describe('root html', function () {

        var filename = Path.join(base, 'index.html');

        it('should resolve absolute path reference', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var file = cache[tool.cachePath(filename)].file;
                String(file.contents).should.match(/'\/index\.[a-z0-9]{8}\.html'/);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

        it('should prefix replaced references if a prefix is supplied', function (done) {

            cache = {};
            revAll = new RevAll({ prefix: 'http://example.com/', cache: cache });
            streamRevision = revAll.revision();

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var file = cache[tool.cachePath(filename)].file;
                String(file.contents).should.match(/'http:\/\/example\.com\/index\.[a-z0-9]{8}\.html'/);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

        it('should replaced references using transform if it is supplied', function (done) {

            cache = {};
            revAll = new RevAll({
                cache: cache,
                transformPath: function (reved, source, path) {
                    return this.joinPathUrl('//images.example.com/', reved.replace('img/', ''));
                }
            });
            tool = revAll.getTool();
            streamRevision = revAll.revision();

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () { 
                var file = cache[tool.cachePath(filename)].file;
                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/css/style.css')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

        it('should resolve reference to css', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var file = tool.cache[tool.cachePath(filename)].file;
                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/css/style.css')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

        it('should resolve reference reference to angularjs view', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var file = tool.cache[tool.cachePath(filename)].file;
                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/view/main.html')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });


        it('should resolve reference reference to javascript include', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var file = tool.cache[tool.cachePath(filename)].file;
                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/application.js')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            write_glob_to_stream(filename, streamRevision);

        });


        it('should resolve reference in double quotes', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var file = tool.cache[tool.cachePath(filename)].file;
                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

        it('should resolve reference in single quotes', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var file = tool.cache[tool.cachePath(filename)].file;
                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image2.jpg')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

        it('should replace srcset referencess', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var file = tool.cache[tool.cachePath(filename)].file;
                var count = String(file.contents).match(/image-[0-4]x\.[a-z0-9]{8}\.png/g);
                count.length.should.eql(4);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

        it('should replace all references', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var file = tool.cache[tool.cachePath(filename)].file;
                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image3.jpg')).path);
                var count = String(file.contents).match(RegExp(revedReference, 'g'));
                count.length.should.eql(2);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

    });

    describe('angularjs view', function () {
        
        var filename = Path.join(base, 'view/main.html');
        var file;

        it('should resolve references to images', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

        it('should resolve references to angular includes', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/view/core/footer.html')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });

    });

    describe('css', function () { 

        var base = Path.join(__dirname, 'test/fixtures/config1');
        var filename = Path.join(base, 'css/style.css');

        it('should resolve references to fonts', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {
                var revedReference1 = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/font/font1.eot')).path);
                String(file.contents).should.containEql(revedReference1);

                var revedReference2 = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/font/font1.woff')).path);
                String(file.contents).should.containEql(revedReference2);

                var revedReference3 = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/font/font1 space.ttf')).path);
                String(file.contents).should.containEql(revedReference3);

                var revedReference4 = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/font/font1.svg')).path);
                String(file.contents).should.containEql(revedReference4);

                done();
            });

            write_glob_to_stream(filename, streamRevision);

        });

        it('should resolve references to images', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {

                var revedReference;
                revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);

                revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image2.jpg')).path);
                String(file.contents).should.containEql(revedReference);

                done();
            });

            write_glob_to_stream(filename, streamRevision);
        });


    });

    describe('main js', function () {

        filename = Path.join(base, 'application.js');

        it('should not resolve arbitrarty text with the same name as a file', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {

                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/short.js')).path);
                String(file.contents).should.not.containEql('var ' + revedReference);

                done();
            });

            write_glob_to_stream(filename, streamRevision);

        });

        it('should resolve references to regular commonjs include', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {

                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/layout.js')).path).replace('.js', '');
                String(file.contents).should.containEql(revedReference);
                String(file.contents).should.containEql('./');

                done();
            });

            write_glob_to_stream(filename, streamRevision);

        });

        it('should resolve references to short style commonjs include', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {

                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/short.js')).path).replace('.js', '');
                String(file.contents).should.containEql(revedReference);
                String(file.contents).should.containEql('./');

                done();
            });

            write_glob_to_stream(filename, streamRevision);

        });

    
        it('should resolve references to angularjs views', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {

                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/view/gps.html')).path);
                String(file.contents).should.containEql(revedReference);

                done();
            });

            write_glob_to_stream(filename, streamRevision);

        });

        it('should resolve references to compiled templates', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {

                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);

                done();
            });

            write_glob_to_stream(filename, streamRevision);

        });

        it('should resolve references to source map', function (done) {

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () {

                var revedReference = Path.basename(tool.revisionFile(getFile('test/fixtures/config1/application.js.map')).path);
                String(file.contents).should.containEql(revedReference);

                done();
            });

            write_glob_to_stream(filename, streamRevision);

        });

    });


    describe('tool', function () {

        describe('joinPath', function () {

            it('should correct windows style slashes', function () {

                var pathMock = {
                    join: function () {}
                };
                var joinStub = sinon.stub(pathMock, 'join');
                joinStub.returns('\\long\\widows\\path\\images.png');

                var tool = new toolFactory({ dirRoot: Path.join(__dirname, 'test/fixtures/config1'), path: pathMock });
                tool.joinPath().should.equal('/long/widows/path/images.png');

            });

        });

        describe('isFileIgnored', function () {

            it('should correct windows style slashes', function () {

                var tool = new toolFactory({ ignore: [ /^\/favicon.ico$/g ]});
                var file = new gutil.File({
                    path: Path.join(__dirname, 'test/fixtures/config1/favicon.ico').replace(/\//g, '\\'),
                    base: base
                });

                tool.isFileIgnored(file).should.be.true;

            });

        });

    });

});
