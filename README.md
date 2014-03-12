# [gulp](https://github.com/wearefractal/gulp)-rev-all [![Build Status](https://travis-ci.org/smysnk/gulp-rev-all.png?branch=master)](https://travis-ci.org/smysnk/gulp-rev-all)

> Static asset revisioning by appending content hash to filenames: unicorn.css => unicorn-098f6bcd.css, also re-writes references in each file to new reved name.


## Purpose

When rev'ing an entire project it is important to update all references in html, js & css files to add the revision hash.

I wasn't able to find any existing plugins that could hand this task.
[Gulp-rev](https://github.com/sindresorhus/gulp-rev) could revision all files but not update references.
[Gulp-usemin](https://www.npmjs.org/package/gulp-usemin) could do both but only using special markup, I needed a solution that would not require me to add markup everwhere.
This project was forked from [gulp-rev](https://github.com/sindresorhus/gulp-rev) to add reference re-writing functionality.


## Install

Install with [npm](https://npmjs.org/package/gulp-rev-all)

```
npm install --save-dev gulp-rev-all
```

## Example

```js
var gulp = require('gulp');
var revall = require('gulp-rev-all');

gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall())
        .pipe(gulp.dest('s3'));
});
```


Revision, GZip, Upload to AWS S3.
```js
var gulp = require('gulp');
var s3 = require("gulp-s3");
var revall = require('gulp-rev-all');
var gzip = require("gulp-gzip");

var options = { gzippedOnly: true };
var aws = {
  "key": "AKIAI3Z7CUAFHG53DMJA",
  "secret": "acYxWRu5RRa6CwzQuhdXEfTpbQA+1XQJ7Z1bGTCx",
  "bucket": "dev.example.com",
  "region": "eu-west-1"
};

gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall())
        .pipe(gzip())
        .pipe(s3(aws, options));
        
});
```
** Note: I have submitted a [pull request](https://github.com/nkostelnik/gulp-s3/pull/7) to gulp-s3 as it currently does not support file contents from streams, which makes it incompatible with [gulp-gzip](https://github.com/jstuckey/gulp-gzip).  In the mean time you can use my forked version [here](https://github.com/smysnk/gulp-s3).

## Tips

Make sure to set the files to [never expire](http://developer.yahoo.com/performance/rules.html#expires) for this to have an effect.


## License

[MIT](http://opensource.org/licenses/MIT) © [Joshua Bellamy-Henn](http://www.psidox.com)