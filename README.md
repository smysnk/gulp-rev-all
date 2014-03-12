# [gulp](https://github.com/wearefractal/gulp)-rev-all [![Build Status](https://travis-ci.org/smysnk/gulp-rev-all.png?branch=master)](https://travis-ci.org/smysnk/gulp-rev-all)

> Static asset revisioning by appending content hash to filenames: unicorn.css => unicorn-098f6bcd.css, also re-writes references in each file to new reved name.

This project was forked from [gulp-rev](https://github.com/sindresorhus/gulp-rev) to add reference re-writing functionality.
When rev'ing an entire project it is important to update all references in html, js & css files to add the revision hash.
I wasn't able to find any existing plugin that handled this task. 

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
    gulp.src('src/**')
        .pipe(revall())
        .pipe(gulp.dest('dist'));
});
```

## Tips

Make sure to set the files to [never expire](http://developer.yahoo.com/performance/rules.html#expires) for this to have an effect.


## License

[MIT](http://opensource.org/licenses/MIT) © [Joshua Bellamy-Henn](http://www.psidox.com)