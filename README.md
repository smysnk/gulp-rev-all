# [gulp](https://github.com/wearefractal/gulp)-rev-all [![Build Status](https://travis-ci.org/smysnk/gulp-rev-all.png?branch=master)](https://travis-ci.org/smysnk/gulp-rev-all)

> Static asset revisioning with dependency considerations, appends content hash to each filename (eg. unicorn.css => unicorn.098f6bcd.css), re-writes references.


## Purpose

By using the Expires header you can make static assets cacheable for extended periods of time so that visitors to your website do not need to make unnecessary HTTP requests for subsequent page views.
Also content distribution networks like [CloudFront](http://aws.amazon.com/cloudfront/) let you cache static assets in [Edge Locations](http://aws.amazon.com/about-aws/globalinfrastructure/) for extended periods of time.
A problem occurs however when you go to release a new version of your website, previous visitors of your website will hit their cache instead.
In the case of CloudFront, you will need to invalidate items or wait for the cache TTL to expire before vistors of your website will see the vew version.

A solution to this problem is adding a revisioned number to the name your static assets.  In the case of this gulp plugin, the revision number is `md5( md5(file) + md5(reference1) + md5(reference2) + md5(reference..) ).substr(0, 8)`.  eg. unicorn.css => unicorn.098f6bcd.css


## Why fork?

This project was forked from [gulp-rev](https://github.com/sindresorhus/gulp-rev) to add reference processing and rewriting functionality.  
It is the philosophy of `gulp-rev` that concerns should be seperated between revisioning the files and correcting internal references.  That is to say it is not `gulp-rev`'s responsibility to analyse or re-write references.
`gulp-rev-all` does not agree with this idea for the simple reason that to accurately calculate a file's hash for caching purposes you need to take child references in to consideration.

eg. A revisioned css file makes a reference to an image.  If the image contents changes, the hash of the css file will remain the same since none of its contents have changed.  Web clients that have previously cached this css file will not correctly resolve the new image file.
If we take in to consideration the dependency graph while calculating the css file hash, we can have it change if any of it child references have changed.

So to recap, `gulp-rev-all` not only handles reference re-writing but it also takes child references into consideration when calculating a hashes.


## Install

Install with [npm](https://npmjs.org/)

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


## Original path

Original file paths are stored at `file.revOrigPath`. 

## Asset hash

The hash of each rev'd file is stored at `file.revHash`. You can use this for customizing the file renaming, or for building different manifest formats.

## Asset manifest

```js
var gulp = require('gulp');
var revall = require('gulp-rev-all');

gulp.task('default', function () {
    // by default, gulp would pick `assets/css` as the base,
    // so we need to set it explicitly:
    return gulp.src(['assets/css/*.css', 'assets/js/*.js'], { base: 'assets' })
        .pipe(gulp.dest('build/assets'))  // copy original assets to build dir
        .pipe(revall())
        .pipe(gulp.dest('build/assets'))  // write rev'd assets to build dir
        .pipe(revall.manifest({ fileName: 'manifest.json' })) // create manifest (`fileName` is optional)
        .pipe(gulp.dest('build/assets')); // write manifest to build dir
});
```

An asset manifest, mapping the original paths to the revisioned paths, will be written to `build/assets/rev-manifest.json`:

```json
{
    "css/unicorn.css": "css/unicorn.098f6bcd.css",
    "js/unicorn.js": "js/unicorn.273c2cin.js"
}
```

## Version file

```js
var gulp = require('gulp');
var revall = require('gulp-rev-all');

gulp.task('default', function () {
    return gulp.src(['assets/css/*.css', 'assets/js/*.js'], { base: 'assets' })
        .pipe(gulp.dest('build/assets'))  // copy original assets to build dir
        .pipe(revall())
        .pipe(gulp.dest('build/assets'))  // write rev'd assets to build dir
        .pipe(revall.versionFile({ fileName: 'version.json' })) // create version file (`fileName` is optional)
        .pipe(gulp.dest('build/assets')); // write version file to build dir
});
```

The version file will contain the build date and a combined hash of all the revisioned files.

```json
{
    "hash": "c969a1154f2a5c0689d8ec4b0eafd584",
    "timestamp": "2014-10-11T12:13:48.466Z"
}
```

## Options

#### options.ignore

Type: `Array of (Regex and/or String)`
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

Type: `function (file, hash)`
Default: `none`

If the default naming convention does not suite your needs, you can specify a custom filename transform. 

The function takes one argument:
  - `file` - file to be revisioned
  - `hash` - calculated hash of the file

```js
gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall({
            transformFilename: function (file, hash) {
                var ext = path.extname(file.path);
                return hash.substr(0, 5) + '.'  + path.basename(file.path, ext) + ext; // 3410c.filename.ext
            }
        }))
        .pipe(gulp.dest('cdn'))
});
```

#### options.base

Type: `String` or `[]`
Default: `none`

This option allows you to set addition search paths `gulp-rev-all` will use to resolve file references.

#### options.silent
#### options.quiet

Type: `Boolean`
Default: `false`

If you set this options to true gulp will no longer emit `gulp-rev-all` log messages.

## Tips

Make sure to set the files to [never expire](http://developer.yahoo.com/performance/rules.html#expires) for this to have an effect.


## License

[MIT](http://opensource.org/licenses/MIT) © [Joshua Bellamy-Henn](http://www.psidox.com)
