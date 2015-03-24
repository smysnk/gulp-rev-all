var RevAll = require('./index');
var Tool = require('./tool');
var should = require('should');
var Path = require('path');


var es = require('event-stream');
var util = require('util');
var Stream = require('stream');
var assert = require('assert');
var gutil = require('gulp-util');
var sinon = require('sinon');
var Q = require('q');
 
require('mocha');

describe('gulp-rev-all', function () {

    var base = Path.join(__dirname, 'test/fixtures/config1'); 

    var revAll, streamRevision, revisioner, files;

    var setup = function (options) {

        revAll = new RevAll(options);
        revisioner = revAll.revisioner;
        streamRevision = revAll.revision();
        files = revisioner.files;

    };   

    describe('resource hash calculation', function () {

        it.only('should change if child reference changes', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () {

                var pathBaseline = files['/css/style.css'].path;

                // Modify the hash of a dependency
                files['/img/image1.jpg'].hashOriginal = 'changed';

                // Re-run the revisioner to re-calculate the filename hash
                revisioner.run();
                files['/css/style.css'].path.should.not.equal(pathBaseline);

                done();
            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

    });

    describe('should process images', function () {

        it('should not corrupt them', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () {

                var file = files['/img/image1.jpg'];
                file.contents[0].should.equal(255);
                file.contents[1].should.equal(216);
                file.contents[2].should.equal(255);
                file.contents[3].should.equal(224);

                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });
    });

    describe('options:', function () {

        describe('filename', function () {

            it('should have proper hash length when specified', function (done) {

                setup({ hashLength: 4 });

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    files['/index.html'].path.should.match(/\.[a-z0-9]{4}\.[a-z]{2,4}$/);
                    done();

                });

                Tool.write_glob_to_stream(base, 'test/fixtures/config1/index.html', streamRevision);

            });

            it('should be transformed when transform function is specified', function (done) {

                setup({
                    ignore: [],
                    transformFilename: function (file, hash) {
                        var ext = Path.extname(file.path);
                        return hash.slice(0, 5) + '.' + Path.basename(file.path, ext) + ext; // 3410c.glob.ext
                    }
                });
              
                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    for (var path in files) {
                        Path.basename(files[path].path).should.match(/[a-z0-9]{5}\..*\.[a-z]{2,4}$/);
                    }
                    done();

                });

                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

        });


        describe('ignore', function () {

            it('should not rename favicon.ico by default', function (done) {

                setup();

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    files['/favicon.ico'].path.should.not.match(/favicon\.[a-z0-9]{8}\.ico$/);
                    done();

                });

                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should rename nested index', function (done) {

                setup({ ignore: [ /^\/index.html/g ] });

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    files['/nested/index.html'].path.should.not.match(/nested\/index\.html$/);
                    files['/index.html'].path.should.not.match(/index\.[a-z0-9]{8}\.html$/);

                    done();

                });
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should not rename html files when specified', function (done) {

                setup({ ignore: ['.html'] });

                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.html$/);
                });

                streamRevision.on('end', done);
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should still process and re-write references in a ignored file', function (done) {

                setup({ ignore: ['.html'] });

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    String(files['/index.html'].contents).should.match(/\"[a-z0-9]*\.[a-z0-9]{8}\.[a-z]{2,4}\"/);

                });

                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should not rename reference if that reference is ignored', function (done) {

                setup({ ignore: ['.js'] });

                streamRevision.on('data', function (file) {
                    String(file.contents).should.match(/\"[a-z0-9]*\.js\"/);
                });

                streamRevision.on('end', done);
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/index.html', streamRevision);

            });

            it('should not rename js files when specified', function (done) {

                setup({ ignore: ['.js'] });

                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.js$/);
                });

                streamRevision.on('end', done);
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });


            it('should not rename woff files when specified', function (done) {

                setup({ ignore: ['.woff'] });

                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.woff$/);
                });

                streamRevision.on('end', done);
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });


            it('should rename all files when ignore not specified', function (done) {

                setup();
                
                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.match(/(\.[a-z0-9]{8}\.[a-z]{2,4}$|favicon\.ico$)/);
                });

                streamRevision.on('end', done);
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });
        });

    });

    describe('root html', function () {

        var glob = Path.join(base, 'index.html');

        it('should resolve absolute path reference', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {

                String(files['/index.html'].contents).should.match(/'\/index\.[a-z0-9]{8}\.html'/);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

        it('should prefix replaced references if a prefix is supplied', function (done) {

            setup({ prefix: 'http://example.com/' });

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {

                String(files['/index.html'].contents).should.match(/'http:\/\/example\.com\/index\.[a-z0-9]{8}\.html'/);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

        it('should replaced references using transform if it is supplied', function (done) {

            setup({
                cache: cache,
                transformPath: function (reved, source, path) {
                    return this.joinPathUrl('//images.example.com/', reved.replace('img/', ''));
                }
            });

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () { 

                String(files['/index.html'].contents).should.match(/'http:\/\/example\.com\/index\.[a-z0-9]{8}\.html'/);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

        it('should resolve reference to css', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {

                String(files['/index.html'].contents).should.containEql(files['/css/style.css'].path);
                done();
                
            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
 
        });

        it('should resolve reference reference to angularjs view', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {
                var file = Tool.cache[Tool.cachePath(glob)].file;
                var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/view/main.html')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            Tool.write_glob_to_stream(base, glob, streamRevision);
        });


        it('should resolve reference reference to javascript include', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {
                var file = Tool.cache[Tool.cachePath(glob)].file;
                var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/application.js')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            Tool.write_glob_to_stream(base, glob, streamRevision);

        });


        it('should resolve reference in double quotes', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {
                var file = Tool.cache[Tool.cachePath(glob)].file;
                var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            Tool.write_glob_to_stream(base, glob, streamRevision);
        });

        it('should resolve reference in single quotes', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {
                var file = Tool.cache[Tool.cachePath(glob)].file;
                var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/img/image2.jpg')).path);
                String(file.contents).should.containEql(revedReference);
                done();
            });

            Tool.write_glob_to_stream(base, glob, streamRevision);
        });

        it('should replace srcset referencess', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {
                var file = Tool.cache[Tool.cachePath(glob)].file;
                var count = String(file.contents).match(/image-[0-4]x\.[a-z0-9]{8}\.png/g);
                count.length.should.eql(4);
                done();
            });

            Tool.write_glob_to_stream(base, glob, streamRevision);
        });

        it('should replace all references', function (done) {

            setup();

            streamRevision.on('data', function () {  });
            streamRevision.on('end', function () {
                var file = Tool.cache[Tool.cachePath(glob)].file;
                var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/img/image3.jpg')).path);
                var count = String(file.contents).match(RegExp(revedReference, 'g'));
                count.length.should.eql(2);
                done();
            });

            Tool.write_glob_to_stream(base, glob, streamRevision);
        });

    });

    describe('angularjs view', function () {
        
        var glob = Path.join(base, 'view/main.html');

        it('should resolve references to images', function (done) {

            setup();

            var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/img/image1.jpg')).path);
            streamRevision.on('data', function (file) {

                String(file.contents).should.containEql(revedReference);
                done();

            });
           
            Tool.write_glob_to_stream(base, glob, streamRevision);
        });

        it('should resolve references to angular includes', function (done) {

            setup();

            var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/view/core/footer.html')).path);
            streamRevision.on('data', function (file) {

                String(file.contents).should.containEql(revedReference);                
                done();

            });

            Tool.write_glob_to_stream(base, glob, streamRevision);
        });

    });

    describe('css', function () { 

        var base = Path.join(__dirname, 'test/fixtures/config1');
        var glob = Path.join(base, 'css/style.css');

        it('should resolve references to fonts', function (done) {

            setup();

            streamRevision.on('data', function (file) {
                var contents = String(file.contents);
                var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/font/font1.eot')).path);
                contents.should.containEql(revedReference);

                revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/font/font1.woff')).path);
                contents.should.containEql(revedReference);

                revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/font/font1 space.ttf')).path);
                contents.should.containEql(revedReference);

                revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/font/font1.svg')).path);
                contents.should.containEql(revedReference);
                done();
            });

            Tool.write_glob_to_stream(base, glob, streamRevision);

        });

        it('should resolve references to images', function (done) {

            setup();

            streamRevision.on('data', function (file) {

                var revedReference;
                revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/img/image1.jpg')).path);
                String(file.contents).should.containEql(revedReference);

                revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/img/image2.jpg')).path);
                String(file.contents).should.containEql(revedReference);

                done();

            });

            Tool.write_glob_to_stream(base, glob, streamRevision);
        });


    });

    describe('main js', function () {

        glob = Path.join(base, 'application.js');

        it('should not resolve arbitrarty text with the same name as a file', function (done) {

            setup();

            var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/short.js')).path);
            streamRevision.on('data', function (file) {

                String(file.contents).should.not.containEql('var ' + revedReference);
                done();

            });

            Tool.write_glob_to_stream(base, glob, streamRevision);

        });

        it('should resolve references to regular commonjs include', function (done) {

            setup();

            var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/layout.js')).path).replace('.js', '');
            streamRevision.on('data', function (file) {

                String(file.contents).should.containEql(revedReference);
                String(file.contents).should.containEql('./');
                done();

            });

            Tool.write_glob_to_stream(base, glob, streamRevision);

        });

        it('should resolve references to short style commonjs include', function (done) {

            setup();

            streamRevision.on('data', function (file) {

                var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/short.js')).path).replace('.js', '');
                String(file.contents).should.containEql(revedReference);
                String(file.contents).should.containEql('./');

                done();

            });

            Tool.write_glob_to_stream(base, glob, streamRevision);

        });

    
        it('should resolve references to angularjs views', function (done) {

            setup();

            var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/view/gps.html')).path);
            streamRevision.on('data', function (file) {

                String(file.contents).should.containEql(revedReference);
                done();

            });

            Tool.write_glob_to_stream(base, glob, streamRevision);

        });

        it('should resolve references to compiled templates', function (done) {

            setup();

            var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/img/image1.jpg')).path);
            streamRevision.on('data', function (file) {

                String(file.contents).should.containEql(revedReference);
                done();

            });

            Tool.write_glob_to_stream(base, glob, streamRevision);

        });

        it('should resolve references to source map', function (done) {

            setup();

            var revedReference = Path.basename(Tool.revisionFile(get_file('test/fixtures/config1/application.js.map')).path);
            streamRevision.on('data', function (file) {

                String(file.contents).should.containEql(revedReference);
                done();

            });

            Tool.write_glob_to_stream(base, glob, streamRevision);

        });

    });


    describe('Tool', function () {

        describe('joinPath', function () {

            it('should correct windows style slashes', function () {

                Tool.join_path('', '\\long\\widows\\path\\images.png').should.equal('/long/widows/path/images.png');

            });

        });

    });

});
