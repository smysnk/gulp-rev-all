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

        // it('should change if child reference changes', function (done) {
        it('should change if child reference changes', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () {

                var pathBaseline = files['/css/style.css'].path;

                // Modify the hash of a dependency
                files['/img/image1.jpg'].revHashOriginal = 'changed';

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
                    dontGlobal: [],
                    dontUpdateReference: [],
                    dontRenameFile: [],
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

        describe('dontGlobal', function () {

            it('should not update favicon.ico reference by default', function (done) {

                setup();

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    String(files['/index.html'].contents).should.not.match(/favicon\.[a-z0-9]{8}\.ico/g);
                    done();

                });

                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should not update references when specified with file extension', function (done) {

                setup({ 
                    dontGlobal: ['.html']
                });

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {
                    
                    String(files['/index.html'].contents).should.not.match(/\.[a-z0-9]{8}\.html/g);
                    done();

                });

                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should not update references when specified with file regex', function (done) {

                setup({ 
                    dontGlobal: [ /.html$/g ]
                });

                streamRevision.on('data', function (file) {});
                streamRevision.on('end', function () {
                    
                    String(files['/index.html'].contents).should.not.match(/\.[a-z0-9]{8}\.html/g);
                    done();

                });

                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should not rename when specified with files extension', function (done) {

                setup({ 
                    dontGlobal: ['.js']
                });

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    String(files['/index.html'].contents).should.match(/\"[a-z0-9\/]*\.js\"/);
                    done();

                });
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
                

            });

            it('should not rename when specified with files extension', function (done) {

                setup({ 
                    dontGlobal: [ /.js$/g ]
                });

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    String(files['/index.html'].contents).should.match(/\"[a-z0-9\/]*\.js\"/);
                    done();

                });
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
                

            });

        });


        describe('dontRenameFile', function () {

            it('should rename nested index', function (done) {

                setup({ 
                    dontRenameFile: [ /^\/index.html/g ] 
                });

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    files['/nested/index.html'].path.should.not.match(/nested\/index\.html$/);
                    files['/index.html'].path.should.not.match(/index\.[a-z0-9]{8}\.html$/);

                    done();

                });
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should not rename html files when specified', function (done) {

                setup({ 
                    dontRenameFile: ['.html'] 
                });

                streamRevision.on('data', function (file) {
                    Path.basename(file.path).should.not.match(/\.[a-z0-9]{8}\.html$/);
                });

                streamRevision.on('end', done);
                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should still process and re-write references in a dontRenameFile file', function (done) {

                setup({ 
                    dontRenameFile: ['.html'] 
                });

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {

                    String(files['/index.html'].contents).should.match(/[a-z0-9]*\.[a-z0-9]{8}\.[a-z]{2,4}/);
                    done();

                });

                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });            

        });

        describe('dontUpdateReference', function () {            

            it('should not update reference when specified with file extension', function (done) {

                setup({ 
                    dontUpdateReference: ['.html'] 
                });

                streamRevision.on('data', function (file) { });
                streamRevision.on('end', function () {
                    
                    String(files['/index.html'].contents).should.not.match(/\.[a-z0-9]{8}\.html/g);
                    done();

                });

                Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

            });

            it('should not update reference when specified with file regex', function (done) {

                setup({ 
                    dontUpdateReference: [ /.html$/g ]  
                });

                streamRevision.on('data', function (file) {});
                streamRevision.on('end', function () {
                    
                    String(files['/index.html'].contents).should.not.match(/\.[a-z0-9]{8}\.html/g);
                    done();

                });

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
                transformPath: function (reved, source, path) {
                    return this.Tool.join_path_url('//images.example.com/', reved.replace('img/', ''));
                }
            });

            streamRevision.on('data', function () {});
            streamRevision.on('end', function () { 

                String(files['/index.html'].contents).should.match(/\/\/images\.example\.com\/image1\.[a-z0-9]{8}\.jpg/);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

        it('should resolve reference to css', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {

                String(files['/index.html'].contents).match(/\/css\/style\.[a-z0-9]{8}\.css/g);
                done();
                
            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
 
        });

        it('should resolve reference reference to angularjs view', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {
                
                String(files['/index.html'].contents).match(/\/view\/main\.[a-z0-9]{8}\.html/g);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });


        it('should resolve reference reference to javascript include', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {

                String(files['/index.html'].contents).match(/\/script\/main\.[a-z0-9]{8}\.js/g);
                String(files['/index.html'].contents).match(/\/lib\/require\.[a-z0-9]{8}\.js/g);

                done();
            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });


        it('should resolve reference in double quotes', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {
                
                String(files['/index.html'].contents).match(/\/img\/image1\.[a-z0-9]{8}\.jpg/g);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
        });

        it('should resolve reference in single quotes', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {

                String(files['/index.html'].contents).match(/\/img\/image2\.[a-z0-9]{8}\.jpg/g);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
        });

        it('should replace srcset referencess', function (done) {

            setup();

            streamRevision.on('data', function () { });
            streamRevision.on('end', function () {
                
                var count = String(files['/index.html'].contents).match(/image-[0-4]x\.[a-z0-9]{8}\.png/g);
                count.length.should.eql(4);

                done();
            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
        });

        it('should replace multiple occurances of the same reference', function (done) {

            setup();

            streamRevision.on('data', function () {  });
            streamRevision.on('end', function () {

                var count = String(files['/index.html'].contents).match(/img\/image3\.[a-z0-9]{8}\.jpg/g);
                count.length.should.eql(2);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
        });

    });

    describe('angularjs view', function () {
        
        it('should resolve references to images', function (done) {

            setup();

            streamRevision.on('data', function () {  });
            streamRevision.on('end', function () {

                var count = String(files['/view/main.html'].contents).match(/\.[a-z0-9]{8}\.jpg/g);
                count.length.should.eql(1);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
        });

        it('should resolve references to angular includes', function (done) {

            setup();

            streamRevision.on('data', function () {  });
            streamRevision.on('end', function () {

                var count = String(files['/view/main.html'].contents).match(/view\/core\/footer\.[a-z0-9]{8}\.html/g);
                count.length.should.eql(1);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

    });

    describe('css', function () { 

        it('should resolve references to fonts', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () { 

                var contents = String(files['/css/style.css'].contents);

                contents.should.containEql(files['/font/font1.eot'].revFilename);
                contents.should.containEql(files['/font/font1.woff'].revFilename);
                contents.should.containEql(files['/font/font1 space.ttf'].revFilename);
                contents.should.containEql(files['/font/font1.svg'].revFilename);

                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

        it('should resolve references to images', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () { 

                var contents = String(files['/css/style.css'].contents);

                contents.should.containEql(files['/img/image1.jpg'].revFilename);
                contents.should.containEql(files['/img/image2.jpg'].revFilename);

                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);
        });


    });

    describe('main js', function () {

        it('should not resolve arbitrarty text with the same name as a file', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () { 

                var contents = String(files['/script/app.js'].contents);
                contents.should.not.containEql('var ' + files['/script/short.js'].revFilename);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

        it('should resolve references to regular commonjs include', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () { 

                var contents = String(files['/script/app.js'].contents);
                contents.should.containEql(files['/script/layout.js'].revFilename);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

        it('should resolve references to short style commonjs include', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () { 

                var contents = String(files['/script/app.js'].contents);
                
                // Rebuild include as we should expect it, eg.  require('./short.abcdef');                
                var reference = './' + files['/script/short.js'].revFilename.substr(0, files['/script/short.js'].revFilename.length - 3);
                contents.should.containEql(reference);
                done();

            });

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

    
        it('should resolve references to angularjs views', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () { 

                var contents = String(files['/script/app.js'].contents);
                contents.should.containEql(files['/view/gps.html'].revFilename);
                done();

            });            

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

        it('should resolve references in angularjs inline templates', function (done) {

            setup();

            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () { 

                var contents = String(files['/script/app.js'].contents);
                contents.should.containEql(files['/img/image1.jpg'].revFilename);
                done();

            });            

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

        it('should resolve references to source map', function (done) {

            setup();


            streamRevision.on('data', function (file) { });
            streamRevision.on('end', function () { 

                var contents = String(files['/script/app.js'].contents);
                contents.should.containEql('//# sourceMappingURL=' + files['/script/app.js.map'].revFilename);
                done();

            });    

            Tool.write_glob_to_stream(base, 'test/fixtures/config1/**', streamRevision);

        });

    });


    describe('Tool', function () {

        describe('joinPath', function () {

            describe('windows', function () {

                it('should correct slashes', function () {

                    Tool.join_path('\\first\\second', 'images.png').should.equal('/first/second/images.png');

                });

                it('should add starting slash', function () {

                    Tool.join_path('first\\second', 'images.png').should.equal('/first/second/images.png');

                });

            });

            describe('posix', function () {

                it('should correct slashes', function () {

                    Tool.join_path('/first/second', 'images.png').should.equal('/first/second/images.png');

                });

                it('should add starting slash', function () {

                    Tool.join_path('first/second', 'images.png').should.equal('/first/second/images.png');

                });

            });

        });

        describe('get_relative_path', function () {

            describe('windows', function () {

                it('should correct slashes', function () {

                    Tool.get_relative_path('\\base', '\\base\\sub\\index.html').should.equal('/sub/index.html');

                });

                it('should remove starting slash', function () {

                    Tool.get_relative_path('\\base', '\\base\\sub\\index.html', true).should.equal('sub/index.html');

                });

                it('should work on base', function () {

                    Tool.get_relative_path('\\base\\sub', '\\base\\sub\\index.html', true).should.equal('index.html');

                });


            });

            describe('posix', function () {

                it('should correct slashes', function () {

                    Tool.get_relative_path('/base', '/base/sub/index.html').should.equal('/sub/index.html');

                });

                it('should remove starting slash', function () {

                    Tool.get_relative_path('/base', '/base/sub/index.html', true).should.equal('sub/index.html');

                });


                it('should work on base', function () {

                    Tool.get_relative_path('/base/sub', '/base/sub/index.html', true).should.equal('index.html');

                });

            });

        });

        describe('get_reference_representations', function () {

            describe('producing alternate representations for javascript (without the extension)', function () {

                it('should not when the context is a html file', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/index.html',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/third/script.js',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);

                    references.length.should.equal(4);
                    references[0].should.equal('/third/script.js');
                    references[1].should.equal('third/script.js');
                    references[2].should.equal('script.js');
                    references[3].should.equal('./script.js');                

                });

                it('should when the context is a javascript file', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/other.js',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/third/script.js',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);

                    references.length.should.equal(7);
                    references[0].should.equal('/third/script.js');
                    references[1].should.equal('third/script.js');
                    references[2].should.equal('script.js');
                    references[3].should.equal('./script.js');                
                    references[4].should.equal('/third/script');
                    references[5].should.equal('third/script');
                    references[6].should.equal('./script');

                });

            });

            describe('should resolve references that have 0 traversals', function () {

                it('0 deep', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/index.html',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/third/other.html',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);

                    references.length.should.equal(4);
                    references[0].should.equal('/third/other.html');
                    references[1].should.equal('third/other.html');
                    references[2].should.equal('other.html');
                    references[3].should.equal('./other.html');

                });

                it('1 deep', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/index.html',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/third/fourth/other.html',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);

                    references.length.should.equal(4);
                    references[0].should.equal('/third/fourth/other.html');
                    references[1].should.equal('third/fourth/other.html');
                    references[2].should.equal('fourth/other.html');
                    references[3].should.equal('./fourth/other.html');

                });

            });

            describe('should resolve references that have 1 traversals', function () {

                it('0 deep', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/index.html',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/index.html',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);                
                    
                    references.length.should.equal(3);
                    references[0].should.equal('/index.html');                    
                    references[1].should.equal('index.html');                    
                    references[2].should.equal('../index.html');

                });

                it('1 deep', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/index.html',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/other/index.html',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);                
                    
                    references.length.should.equal(3);
                    references[0].should.equal('/other/index.html');
                    references[1].should.equal('other/index.html');
                    references[2].should.equal('../other/index.html');

                });

                it('2 deep', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/index.html',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/other/advanced/index.html',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);                
                    
                    references.length.should.equal(3);
                    references[0].should.equal('/other/advanced/index.html');
                    references[1].should.equal('other/advanced/index.html');
                    references[2].should.equal('../other/advanced/index.html');

                });

            });

            describe('should resolve references that have 2 traversals', function () {

                it('0 deep', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/fourth/index.html',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/index.html',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);                

                    references.length.should.equal(3);
                    references[0].should.equal('/index.html');
                    references[1].should.equal('index.html');
                    references[2].should.equal('../../index.html');

                });

                it('1 deep', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/fourth/index.html',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/other/index.html',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);                
                    
                    references.length.should.equal(3);
                    references[0].should.equal('/other/index.html');
                    references[1].should.equal('other/index.html');
                    references[2].should.equal('../../other/index.html');

                });

                it('2 deep', function () {

                    var base = '/first/second';

                    var file = new gutil.File({
                        path: '/first/second/third/fourth/fifth/index.html',
                        base: base
                    });

                    var fileReference = new gutil.File({
                        path: '/first/second/other/index.html',
                        base: base
                    });

                    file.revPathOriginal = file.path;
                    fileReference.revPathOriginal = fileReference.path;

                    var references = Tool.get_reference_representations(fileReference, file);                
                    
                    references.length.should.equal(3);
                    references[0].should.equal('/other/index.html');
                    references[1].should.equal('other/index.html');
                    references[2].should.equal('../../../other/index.html');

                });

            });

        });

    });

});
