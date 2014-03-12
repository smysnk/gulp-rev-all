var revall = require("../");
var tools = require("../tools");
var should = require("should");
var gulp = require("gulp");
var es = require("event-stream");
var fs = require("fs");
var util = require("util");
var Stream = require("stream");
var assert = require("assert");
var path = require('path');

require("mocha");

describe("gulp-rev-all", function() {

    describe("root html", function() {

        it("should resolve reference to css", function(done) {
            
            var stream = gulp.src('fixtures/config1/index.html')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {
                    
                    var revedReference = path.basename(tools.revFile('fixtures/config1/css/style.css'));
                    should(String(file.contents)).containEql(revedReference);
                    cb(null, file);
                    
                }));

            stream.on('end', done);

        });

        it("should resolve reference reference to angularjs view", function(done) {
            
            var stream = gulp.src('fixtures/config1/index.html')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {

                    var revedReference = path.basename(tools.revFile('fixtures/config1/view/main.html'));                    
                    should(String(file.contents)).containEql(revedReference);
                    cb(null, file);
                    
                }));

            stream.on('end', done);

        });


        it("should resolve reference reference to javascript include", function(done) {
            
            var stream = gulp.src('fixtures/config1/index.html')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {

                    var revedReference = path.basename(tools.revFile('fixtures/config1/application.js'));                    
                    should(String(file.contents)).containEql(revedReference);
                    cb(null, file);
                    
                }));

            stream.on('end', done);

        });


        it("should resolve reference in double quotes ", function(done) {
            
            var stream = gulp.src('fixtures/config1/index.html')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {

                    var revedReference = path.basename(tools.revFile('fixtures/config1/img/image1.jpg'));                    
                    should(String(file.contents)).containEql(revedReference);
                    cb(null, file);
                    
                }));

            stream.on('end', done);

        });

        it("should resolve reference in single quotes", function(done) {

            
            var stream = gulp.src('fixtures/config1/index.html')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {
                    
                    var revedReference = path.basename(tools.revFile('fixtures/config1/img/image2.jpg'));
                    should(String(file.contents)).containEql(revedReference);
                    cb(null, file);
                    
                }));

            stream.on('end', done);

        });

    });

    describe("angularjs view", function() {

        it("should resolve references to images", function(done) {
            
            var stream = gulp.src('fixtures/config1/view/main.html')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {
                    
                    var revedReference = path.basename(tools.revFile('fixtures/config1/img/image1.jpg'));
                    should(String(file.contents)).containEql(revedReference);
                    cb(null, file);
                    
                }));

            stream.on('end', done);

        });

        it("should resolve references to angular incldues", function(done) {

            var stream = gulp.src('fixtures/config1/view/main.html')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {
                    
                    var revedReference = path.basename(tools.revFile('fixtures/config1/view/core/footer.html'));
                    should(String(file.contents)).containEql(revedReference);

                    cb(null, file);                    
                }));

            stream.on('end', done);

        });

    });

    describe("css", function() {

        it("should resolve references to fonts", function(done) {

            var stream = gulp.src('fixtures/config1/css/style.css')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {
                    
                    var revedReference = path.basename(tools.revFile('fixtures/config1/font/font1.eot'));
                    should(String(file.contents)).containEql(revedReference);

                    var revedReference = path.basename(tools.revFile('fixtures/config1/font/font1.woff'));
                    should(String(file.contents)).containEql(revedReference);

                    var revedReference = path.basename(tools.revFile('fixtures/config1/font/font1.ttf'));
                    should(String(file.contents)).containEql(revedReference);

                    var revedReference = path.basename(tools.revFile('fixtures/config1/font/font1.svg'));
                    should(String(file.contents)).containEql(revedReference);

                    cb(null, file);                    
                }));

            stream.on('end', done);

        });

        it("should resolve references to images", function(done) {

            var stream = gulp.src('fixtures/config1/css/style.css')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {
                    
                    var revedReference = path.basename(tools.revFile('fixtures/config1/img/image1.jpg'));
                    should(String(file.contents)).containEql(revedReference);

                    cb(null, file);                    
                }));

            stream.on('end', done);

        });

    });

    describe("main js", function() {

        it("should resolve references to angularjs views", function(done) {

            var stream = gulp.src('fixtures/config1/application.js')
                .pipe(revall({rootDir:'fixtures/config1'}))
                .pipe(es.map(function(file, cb) {
                    
                    var revedReference = path.basename(tools.revFile('fixtures/config1/view/gps.html'));
                    should(String(file.contents)).containEql(revedReference);

                    cb(null, file);                    
                }));

            stream.on('end', done);

        });

    });

});
