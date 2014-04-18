# [gulp](https://github.com/wearefractal/gulp)-rev-all [![Build Status](https://travis-ci.org/smysnk/gulp-rev-all.png?branch=master)](https://travis-ci.org/smysnk/gulp-rev-all)

> Static asset revisioning by appending content hash to filenames: unicorn.css => unicorn-098f6bcd.css, also re-writes references in each file to new reved name.


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
        .pipe(gulp.dest('s3'));
});
```


```js
var gulp = require('gulp');
var s3 = require("gulp-s3");
var revall = require('gulp-rev-all');
var gzip = require("gulp-gzip");
var cloudfront = require("gulp-cloudfront");

var options = { gzippedOnly: true };
var aws = {
    "key": "AKIAI3Z7CUAFHG53DMJA",
    "secret": "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",
    "bucket": "bucket-name",
    "region": "eu-west-1",
    "distributionId": "E1SYAKGEMSK3OD"
};

gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall())
        .pipe(gzip())
        .pipe(s3(aws, options));
        .pipe(cloudfront(aws))

});
```
** Note: I have submitted a [pull request](https://github.com/nkostelnik/gulp-s3/pull/7) to gulp-s3 as it currently does not support file contents from streams, which makes it incompatible with [gulp-gzip](https://github.com/jstuckey/gulp-gzip).  In the mean time you can use my forked version [here](https://github.com/smysnk/gulp-s3).

## Ignoring Extensions

In some cases, you may not want to rev your `*.html` files:

```js
gulp.task('default', function () {
    gulp.src('dist/**')
        .pipe(revall({ ignoredExtensions: ['.html'] }))
        .pipe(gulp.dest('dist'))
});
```

## Tips

Make sure to set the files to [never expire](http://developer.yahoo.com/performance/rules.html#expires) for this to have an effect.


## License

[MIT](http://opensource.org/licenses/MIT) © [Joshua Bellamy-Henn](http://www.psidox.com)
