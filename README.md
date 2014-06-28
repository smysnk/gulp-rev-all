# [gulp](https://github.com/wearefractal/gulp)-rev-all [![Build Status](https://travis-ci.org/smysnk/gulp-rev-all.png?branch=master)](https://travis-ci.org/smysnk/gulp-rev-all)

> Static asset revisioning by appending content hash to each filename (eg. unicorn.css => unicorn-098f6bcd.css) and re-writes references to the file.


## Purpose

By using the Expires header you can make static assets cacheable for extended periods of time so that visitors to your website do not need to make unnecessary HTTP requests for subsequent page views.
Also content distribution networks like [CloudFront](http://aws.amazon.com/cloudfront/) let you cache static assets in [Edge Locations](http://aws.amazon.com/about-aws/globalinfrastructure/) for extended periods of time.
A problem occurs however when you go to release a new version of your website, previous visitors of your website will hit their cache instead.
In the case of CloudFront, you will need to invalidate items or wait for the cache TTL to expire before vistors of your website will see the vew version.

A solution to this problem is adding a revisioned number to the name your static assets.  In the case of this gulp plugin, the revision number is the first 8 characters of the MD5 hash of the file.  eg. unicorn.css => unicorn-098f6bcd.css


## Why fork?

This project was forked from [gulp-rev](https://github.com/sindresorhus/gulp-rev) to add reference re-writing functionality.
When rev'ing an entire project it is important to update all references in html, js & css files to add the revision hash.

I wasn't able to find any existing plugins that could handle this task.
[Gulp-rev](https://github.com/sindresorhus/gulp-rev) could revision all files but not update references.
[Gulp-usemin](https://www.npmjs.org/package/gulp-usemin) could do both but only using special markup, I needed a solution that would not require me to add markup everwhere.


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
        .pipe(gulp.dest('cdn'));
});
```


```js
var gulp = require('gulp');
var revall = require('gulp-rev-all');
var awspublish = require('gulp-awspublish');
var cloudfront = require("gulp-cloudfront");

var aws = {
    "key": "AKIAI3Z7CUAFHG53DMJA",
    "secret": "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",
    "bucket": "bucket-name",
    "region": "us-standard",
    "distributionId": "E1SYAKGEMSK3OD"
};

var publisher = awspublish.create(aws);
var headers = {'Cache-Control': 'max-age=315360000, no-transform, public'};

gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall())
        .pipe(awspublish.gzip())
        .pipe(publisher.publish(headers))
        .pipe(publisher.cache())
        .pipe(awspublish.reporter())
        .pipe(cloudfront(aws));
});
```

  * See [gulp-awspublish](https://www.npmjs.org/package/gulp-awspublish), [gulp-cloudfront](https://www.npmjs.org/package/gulp-cloudfront)


## API

#### options.ignore

Type: `Array of RegEx or String`
Default: `[ /^\/favicon.ico$/ ]`

In some cases, you may not want to rev your `*.html` files:

```js
gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall({ ignore: [/^\/favicon.ico$/g, '.html'] }))
        .pipe(gulp.dest('cdn'))
});
```

Every html file except the root `/index.html` file:

```js
gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall({ ignore: [/^\/favicon.ico$/g, /^\/index.html/g] }))
        .pipe(gulp.dest('cdn'))
});
```

#### options.hashLength

Type: `hashLength`
Default: `8`

Change the length of the hash appended to the end of each revisioned file (use `options.transformFilename` for more complicated scenarios).

```js
gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall({ hashLength: 4 }))
        .pipe(gulp.dest('cdn'))
});
```

#### options.prefix

Type: `prefix`
Default: `none`

Prefixes matched files with a string (use `options.transformPath` for more complicated scenarios). Useful for adding a full url path to files.

```js
gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall({ prefix: 'http://1234.cloudfront.net/' }))
        .pipe(gulp.dest('cdn'))
});
```

#### options.transformPath

Type: `function (rev, source, path)`
Default: `none`

Specify a function to transform the reference path. Useful in instances where the local file structure does not reflect what the remote file structure will be.

The function takes three arguments:
  - `rev` - revisioned reference path
  - `source` - original reference path
  - `path` - path to the file


```js
gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall({
            transformPath: function (rev, source, path) {
                // on the remote server, image files are served from `/images`
                return rev.replace('/img', '/images');
            }
        }))
        .pipe(gulp.dest('cdn'))
});
```

#### options.transformFilename

Type: `function (filePath)`
Default: `none`

If the default naming convention does not suite your needs, you can specify a custom filename transform. 

The function takes one argument:
  - `filePath` - path to file to be revisioned

```js
var path = require('path');
var fs = require('fs');
gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall({
            transformFilename: function (filePath) {
                var contents = fs.readFileSync(filePath).toString();
                var hash = this.md5(contents).slice(0, 5);  
                var ext = path.extname(filePath);
                return hash + '.'  + path.basename(filePath, ext) + ext; // 3410c.filename.ext
            }
        }))
        .pipe(gulp.dest('cdn'))
});
```

#### options.fileExt

Type: `array`
Default: `['.js', '.css', '.html', '.jade']`

Specify the types of files to re-write references in.

```js
var path = require('path');
var fs = require('fs');
gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall({ fileExt: ['.js', '.css', '.html', '.jade', '.php'] }))
        .pipe(gulp.dest('cdn'))
});
```

## Tips

Make sure to set the files to [never expire](http://developer.yahoo.com/performance/rules.html#expires) for this to have an effect.


## License

[MIT](http://opensource.org/licenses/MIT) © [Joshua Bellamy-Henn](http://www.psidox.com)
