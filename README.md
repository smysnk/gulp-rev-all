# [gulp](https://github.com/wearefractal/gulp)-rev-all [![Build Status](https://travis-ci.org/smysnk/gulp-rev-all.png?branch=master)](https://travis-ci.org/smysnk/gulp-rev-all)

> Static asset revisioning with dependency considerations, appends content hash to each filename (eg. unicorn.css => unicorn.098f6bcd.css), re-writes references.


## Purpose

By using the HTTP server response header ``expires`` combined with filename revisioning, static assets can be made cacheable for extended periods of time. Returning visitors will have the assets cached for super fast load times.

Additionally, content distribution networks like [CloudFront](http://aws.amazon.com/cloudfront/) let you cache static assets in [Edge Locations](http://aws.amazon.com/about-aws/globalinfrastructure/) for extended periods of time.


## Why fork?

This project was forked from [gulp-rev](https://github.com/sindresorhus/gulp-rev) to add reference processing and rewriting functionality.  
It is the philosophy of `gulp-rev` that concerns should be seperated between revisioning the files and re-writing references to those files.  `gulp-rev-all` does not agree with this, we believe you need to analyze each revisioned files' references, to calculate a final hash for caching purposes.  

### Consider the following example:
A css file makes reference to an image.  If the image changes, the hash of the css file remains the same since its contents have not changed.  Web clients that have previously cached this css file will not correctly resolve the new image.
If we take in to consideration the dependency graph while calculating the css file hash, we can have it change if any of its child references have changed.

So to recap, `gulp-rev-all` not only handles reference re-writing but it also takes child references into consideration when calculating a hashes.

## Upgrading to v0.8.x

NOTICE: Major breaking changes occured between the last release v0.7.6 and v0.8.x that you should be aware of.
  - It is now required to instantiate a `var revAll = new RevAll()` instance before piping through revAll.revision()
  - Reference dependency analysis has been greatly simplified, previous method was way too complex
  - No longer requires references to exist physically on disk, can now be piped through, embracing nature of gulp
  - New Feature: Ignoring files has changed, `ignore` option has been removed and has been replaced with `dontGlobal, dontRenameFile, dontUpdateReference, dontSearchFile` which allows for more control and less ambiguity on what is being ignored
  - New Feature: Manifest and Version files can be created in the same gulp-rev-all run without issue
  - Bug Fix: References without quotes were not getting updated 
  - Change: `silent` & `quiet` options, renamed to `debug` to control logging output

## Install

Install with [npm](https://npmjs.org/)

```
npm install --save-dev gulp-rev-all
```

## Usage

```js
var gulp = require('gulp');
var RevAll = require('gulp-rev-all');

gulp.task('default', function () {

    var revAll = new RevAll();
    gulp.src('dist/**')
        .pipe(revAll.revision())
        .pipe(gulp.dest('cdn'));

});
```


```js
var gulp = require('gulp');
var RevAll = require('gulp-rev-all');
var awspublish = require('gulp-awspublish');
var cloudfront = require("gulp-cloudfront");

var aws = {
  "params": {
    "Bucket": "bucket-name"
  },
  "accessKeyId": "AKIAI3Z7CUAFHG53DMJA",
  "secretAccessKey": "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",
  "distributionId": "E1SYAKGEMSK3OD",
  "region": "us-standard",
};

var publisher = awspublish.create(aws);
var headers = {'Cache-Control': 'max-age=315360000, no-transform, public'};

gulp.task('default', function () {

    var revAll = new RevAll();
    gulp.src('dist/**')
        .pipe(revAll.revision())
        .pipe(awspublish.gzip())
        .pipe(publisher.publish(headers))
        .pipe(publisher.cache())
        .pipe(awspublish.reporter())
        .pipe(cloudfront(aws));

});
```
  * See [gulp-awspublish](https://www.npmjs.org/package/gulp-awspublish), [gulp-cloudfront](https://www.npmjs.org/package/gulp-cloudfront)

## Methods

### .revision()
Returns a transform function that can be used to pipe files through so that they may be revisioned, also corrects refererences to said files.

### .manifestFile()
Returns a transform function that will filter out any existing files going through the pipe and will emit a new manifest file.  Must be called after `.revision()`.

```js
var gulp = require('gulp');
var RevAll = require('gulp-rev-all');

gulp.task('default', function () {

    var revAll = new RevAll();
    return gulp.src(['assets/**'])
        .pipe(gulp.dest('build/assets'))  
        .pipe(revAll.revision())
        .pipe(gulp.dest('build/assets'))  
        .pipe(revAll.manifestFile())
        .pipe(gulp.dest('build/assets')); 

});
```

An asset manifest, mapping the original paths to the revisioned paths, will be written to `build/assets/rev-manifest.json`:

```json
{
    "css/unicorn.css": "css/unicorn.098f6bcd.css",
    "js/unicorn.js": "js/unicorn.273c2cin.js"
}
```

### .versionFile()
Returns a transform function that will filter out any existing files going through the pipe and will emit a new version file.  Must be called after `.revision()`.

```js
var gulp = require('gulp');
var RevAll = require('gulp-rev-all');

gulp.task('default', function () {

    var revAll = new RevAll();
    return gulp.src(['assets/**'])
        .pipe(gulp.dest('build/assets'))
        .pipe(revAll.revision())
        .pipe(gulp.dest('build/assets'))
        .pipe(revAll.versionFile())
        .pipe(gulp.dest('build/assets'));

});
```

The version file will contain the build date and a combined hash of all the revisioned files, will be written to `build/assets/rev-version.json`.

```json
{
    "hash": "c969a1154f2a5c0689d8ec4b0eafd584",
    "timestamp": "2014-10-11T12:13:48.466Z"
}
```


## Options
```js
var revAll = new RevAll({ options });
```

#### fileNameVersion
Type: `String`<br/>
Default: `rev-version.json`<br />
Set the filename of the file created by revAll.versionFile()<br/>

#### fileNameManifest
Set the filename of the file created by revAll.manifestFile()<br/>
Type: `String`<br/>
Default: `rev-manifest.json`

#### dontGlobal

Don't rename, search or update refrences in files matching these rules<br/>
Type: `Array of (Regex and/or String)`<br/>
Default: `[ /^\/favicon.ico$/ ]`<br/>

#### dontRenameFile
Don't rename files matching these rules<br/>
Type: `Array of (Regex and/or String)`<br/>
Default: `[]`

#### dontUpdateReference
Don't update references matching these rules<br/>
Type: `Array of (Regex and/or String)`<br/>
Default: `[]`

#### dontSearchFile
Don't search for references in files matching these rules<br/>
Type: `Array of (Regex and/or String)`<br/>
Default: `[]`

In some cases, you may not want to rev your `*.html` files:

```js
gulp.task('default', function () {

    var revAll = new RevAll({ dontRenameFile: [/^\/favicon.ico$/g, '.html'] });
    gulp.src('dist/**')
        .pipe(revAll.revision())
        .pipe(gulp.dest('cdn'))

});
```

Every html file except the root `/index.html` file:

```js
gulp.task('default', function () {

    var revAll = new RevAll({ dontRenameFile: [/^\/favicon.ico$/g, /^\/index.html/g] });
    gulp.src('dist/**')
        .pipe(revAll.revision()))
        .pipe(gulp.dest('cdn'))
});
```

#### hashLength
Change the length of the hash appended to the end of each revisioned file (use `transformFilename` for more complicated scenarios).<br/>
Type: `hashLength`<br/>
Default: `8`<br/>

```js
gulp.task('default', function () {

    var revAll = new RevAll({ hashLength: 4 });
    gulp.src('dist/**')
        .pipe(revAll.revision())
        .pipe(gulp.dest('cdn'))
});
```

#### prefix
Prefixes absolute references with a string (use `transformPath` for more complicated scenarios). Useful for adding a full url path to files.<br/>
Type: `prefix`<br/>
Default: `none`<br/>

```js
gulp.task('default', function () {

    var revAll = new RevAll({ prefix: 'http://1234.cloudfront.net/' });
    gulp.src('dist/**')
        .pipe(revAll.revision())
        .pipe(gulp.dest('cdn'))

});
```

#### transformPath
Specify a function to transform the reference path. Useful in instances where the local file structure does not reflect what the remote file structure will be.<br/>
Type: `function (rev, source, path)`<br/>
Default: `none`<br/>

The function takes three arguments:
  - `rev` - revisioned reference path
  - `source` - original reference path
  - `path` - path to the file


```js
gulp.task('default', function () {

    var revAll = new RevAll({
        transformPath: function (rev, source, path) {
            // on the remote server, image files are served from `/images`
            return rev.replace('/img', '/images');
        }
    });

    gulp.src('dist/**')
        .pipe(revAll.revision())
        .pipe(gulp.dest('cdn'))

});
```

#### transformFilename
If the default naming convention does not suite your needs, you can specify a custom filename transform. <br/>
Type: `function (file, hash)`<br/>
Default: `none`<br/>

The function takes one argument:
  - `file` - file to be revisioned
  - `hash` - calculated hash of the file

```js
gulp.task('default', function () {

    var revAll = new RevAll({
        transformFilename: function (file, hash) {
            var ext = path.extname(file.path);
            return hash.substr(0, 5) + '.'  + path.basename(file.path, ext) + ext; // 3410c.filename.ext
        }
    });

    gulp.src('dist/**')
        .pipe(revAll.revision())
        .pipe(gulp.dest('cdn'))
        
});
```

#### debug
If you set this options to true, verbose logging will be emitted to console.<br/>
Type: `Boolean`<br/>
Default: `false`<br/>

## Annotater & Replacer

In some cases, false-positives may occur.  Strings that are similar to a file reference may be incorrectly replaced.<br/>

In the example below, the 2nd instance of 'xyz' is not reference to the file xyz.js:

```js
require('xyz');

angular.controller('myController', ['xyz', function(xyz) {
   ...
}]);
```

It will still however be replaced resulting in file corruption:

```js
require('xyz.123');

angular.controller('myController', ['xyz.123', function(xyz) {
   ...
}]);
```

This behaviour can be avoided by passing custom ```annotator``` and ```replacer``` functions in as options.

### Annotator

The annotator function is called with the original file content and path.
Annotator function should return a list of objects that contain fragments of the file content in order.
You may split the file up into as many fragments as necessary and attach any other metadata to the fragments.
The file will be reassembled in order. <br/>

The default annotator returns one fragment with no annotations:

```js
options.annotator = function(contents, path) {
    var fragments = [{'contents': contents}];
    return fragments;
};
```

### Replacer

The replacer function's job is to replace references to revisioned files. The paremeters are as follows:<br/>

```fragment```: a file fragment as created in the annotator function.<br/>
```replaceRegExp```: parameter is a regular expression that can be used to match the part of the fragement to be replaced. The regular expression has 4 capture groups. $1 & $4 are what precedes and follows the reference. $2 is the file path without the extension, and $3 is the file extension.<br/>
```newReference```: what gulp-rev-all wants to replace the file path without the extension ($2) with.<br/>
```referencedFile```: contains additional properties of the file reference thats being replaced. See the 'Additional Properties' section for more information.<br/>

The default replacer function is as follows:

```js
options.replacer = function(fragment, replaceRegExp, newReference, referencedFile) {
     fragment.contents = fragment.contents.replace(replaceRegExp, '$1' + newReference + '$3$4');
};
```

You can overide the default annotator and replacer to change the behaviour of gulp-rev-all and deal with problematic edge cases.

## Additional Properties

### file.revPathOriginal 
The original full path of the file, before revisioning.

### file.revFilenameOriginal
The original filename less the file extension, before revisioning.

### file.revFilenameExtOriginal
The original file extension, before revisioning.

### file.revHashOriginal
The original hash of the asset before any calculations by `gulp-rev-all`.

### file.revHash
The hash of the asset as calculated by `gulp-rev-all`, you can use this for customizing the file renaming, or for building different manifest formats.


## Tips

Make sure to set the files to [never expire](http://developer.yahoo.com/performance/rules.html#expires) for this to have an effect.


## License

[MIT](http://opensource.org/licenses/MIT) © [Joshua Bellamy-Henn](http://www.joshuabellamyhenn.com)
