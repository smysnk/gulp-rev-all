# [gulp](https://github.com/wearefractal/gulp)-rev-all [![Build Status](https://travis-ci.org/smysnk/gulp-rev-all.png?branch=master)](https://travis-ci.org/smysnk/gulp-rev-all)

> Static asset revisioning by appending content hash to filenames: unicorn.css => unicorn-098f6bcd.css, also re-writes references in each file to new reved name.

This project was forked from [gulp-rev](https://github.com/sindresorhus/gulp-rev) to add reference re-writing functionality.

Make sure to set the files to [never expire](http://developer.yahoo.com/performance/rules.html#expires) for this to have an effect.

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
    gulp.src('src/**')
        .pipe(revall())
        .pipe(gulp.dest('dist'));
});
```


## License

[MIT](http://opensource.org/licenses/MIT) © [Joshua Bellamy-Henn](http://www.psidox.com)