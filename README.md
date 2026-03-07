# gulp-rev-all [![NPM version](https://img.shields.io/npm/v/gulp-rev-all.svg)](https://www.npmjs.com/package/gulp-rev-all) [![Run tests](https://github.com/smysnk/gulp-rev-all/actions/workflows/test.yml/badge.svg)](https://github.com/smysnk/gulp-rev-all/actions/workflows/test.yml) ![Dependency Status](https://img.shields.io/librariesio/release/npm/gulp-rev-all)

> Gulp plugin that revisions static assets, rewrites references, and makes parent file hashes change when referenced assets change.

## What Problem Does This Solve?

`gulp-rev` is useful for adding content hashes to filenames, but it treats files independently.

That becomes a problem when one file references another. For example, if `style.css` references `image.jpg` and the image changes, the image gets a new hashed filename, but the CSS file may still keep the same hash if its own source text has not changed. Clients can then keep using cached CSS that points at the old asset path.

`gulp-rev-all` solves that by scanning references, rewriting them, and including referenced files when calculating hashes. If a child asset changes, parent assets that depend on it change too.

This makes it easier to use long cache lifetimes with static assets behind regular web servers, CDNs, or other immutable-asset deployment strategies.

## Why Not Just `gulp-rev`?

Use [gulp-rev](https://github.com/sindresorhus/gulp-rev) when you only need per-file fingerprinting.

Use `gulp-rev-all` when your build output contains references between files and you want cache invalidation to follow those dependencies. This plugin:

- renames files with content hashes
- rewrites references to the new hashed filenames
- recalculates parent file hashes when referenced files change

## Example

Suppose `style.css` contains:

```css
background-image: url("../img/logo.png");
```

If `logo.png` changes:

- `gulp-rev` can rename `logo.png`
- but `style.css` may still keep the same hash
- cached CSS can still point at the old filename

`gulp-rev-all` updates both:

- `logo.png` gets a new hashed filename
- the reference inside `style.css` is rewritten
- `style.css` also gets a new hash because one of its dependencies changed

## Install

Install with [npm](https://npmjs.org/)

```
npm install --save-dev gulp-rev-all
```

Or [yarn](https://yarnpkg.com/):

```
yarn add --dev gulp-rev-all
```

## Usage

```js
import gulp from "gulp";
import RevAll from "gulp-rev-all";

gulp.task("default", function () {
  return gulp.src("dist/**").pipe(RevAll.revision()).pipe(gulp.dest("cdn"));
});
```

```js
import gulp from "gulp";
import RevAll from "gulp-rev-all";
import awspublish from "gulp-awspublish";
import cloudfront from "gulp-cloudfront";

var aws = {
  params: {
    Bucket: "bucket-name",
  },
  accessKeyId: "AKIAI3Z7CUAFHG53DMJA",
  secretAccessKey: "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",
  distributionId: "E1SYAKGEMSK3OD",
  region: "us-standard",
};

var publisher = awspublish.create(aws);
var headers = { "Cache-Control": "max-age=315360000, no-transform, public" };

gulp.task("default", function () {
  return gulp
    .src("dist/**")
    .pipe(RevAll.revision())
    .pipe(awspublish.gzip())
    .pipe(publisher.publish(headers))
    .pipe(publisher.cache())
    .pipe(awspublish.reporter())
    .pipe(cloudfront(aws));
});
```

- See [gulp-awspublish](https://www.npmjs.org/package/gulp-awspublish), [gulp-cloudfront](https://www.npmjs.org/package/gulp-cloudfront)

## Methods

### .revision({ options })

Returns a transform function that can be used to pipe files through so that they may be revisioned, also corrects refererences to said files.

### .manifestFile()

Returns a transform function that will filter out any existing files going through the pipe and will emit a new manifest file. Must be called after `.revision()`.

```js
import gulp from "gulp";
import RevAll from "gulp-rev-all";

gulp.task("default", function () {
  return gulp
    .src(["assets/**"])
    .pipe(gulp.dest("build/assets"))
    .pipe(RevAll.revision())
    .pipe(gulp.dest("build/assets"))
    .pipe(RevAll.manifestFile())
    .pipe(gulp.dest("build/assets"));
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

Returns a transform function that will filter out any existing files going through the pipe and will emit a new version file. Must be called after `.revision()`.

```js
import gulp from "gulp";
import RevAll from "gulp-rev-all";

gulp.task("default", function () {
  return gulp
    .src(["assets/**"])
    .pipe(gulp.dest("build/assets"))
    .pipe(RevAll.revision())
    .pipe(gulp.dest("build/assets"))
    .pipe(RevAll.versionFile())
    .pipe(gulp.dest("build/assets"));
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
gulp.src("dist/**").pipe(RevAll.revision({ options }));
```

#### fileNameVersion

Type: `String`<br/>
Default: `rev-version.json`<br />
Set the filename of the file created by revAll.versionFile()<br/>

#### fileNameManifest

Set the filename of the file created by revAll.manifestFile()<br/>
Type: `String`<br/>
Default: `rev-manifest.json`

#### includeFilesInManifest

Add only specific file types to the manifest file<br/>
Type: `Array of strings`<br/>
Default: `['.css', '.js']`

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
gulp.task("default", function () {
  return gulp
    .src("dist/**")
    .pipe(RevAll.revision({ dontRenameFile: [/^\/favicon.ico$/g, ".html"] }))
    .pipe(gulp.dest("cdn"));
});
```

Every html file except the root `/index.html` file:

```js
gulp.task('default', function () {

  return gulp
    .src('dist/**')
    .pipe(RevAll.revision({ dontRenameFile: [/^\/favicon.ico$/g, /^\/index.html/g] })))
    .pipe(gulp.dest('cdn'))

});
```

#### hashLength

Change the length of the hash appended to the end of each revisioned file (use `transformFilename` for more complicated scenarios).<br/>
Type: `hashLength`<br/>
Default: `8`<br/>

```js
gulp.task("default", function () {
  return gulp
    .src("dist/**")
    .pipe(RevAll.revision({ hashLength: 4 }))
    .pipe(gulp.dest("cdn"));
});
```

#### prefix

Prefixes absolute references with a string (use `transformPath` for more complicated scenarios). Useful for adding a full url path to files.<br/>
Type: `prefix`<br/>
Default: `none`<br/>

```js
gulp.task("default", function () {
  return gulp
    .src("dist/**")
    .pipe(RevAll.revision({ prefix: "http://1234.cloudfront.net/" }))
    .pipe(gulp.dest("cdn"));
});
```

#### baseHref

Matches absolute references that are already served under a base path. Useful when your app is mounted under a subdirectory such as `/www` and files contain references like `/www/script/app.js`.<br/>
Type: `string`<br/>
Default: `""`<br/>

```js
gulp.task("default", function () {
  return gulp
    .src("dist/**")
    .pipe(RevAll.revision({ baseHref: "/www" }))
    .pipe(gulp.dest("cdn"));
});
```

For example, with `baseHref: "/www"`, a reference like `/www/script/app.js` will be rewritten to `/www/script/app.<hash>.js`.

#### transformPath

Specify a function to transform the reference path. Useful in instances where the local file structure does not reflect what the remote file structure will be.<br/>
Type: `function (rev, source, path)`<br/>
Default: `none`<br/>

The function takes three arguments:

- `rev` - revisioned reference path
- `source` - original reference path
- `path` - path to the file

```js
gulp.task("default", function () {
  return gulp
    .src("dist/**")
    .pipe(
      RevAll.revision({
        transformPath: function (rev, source, path) {
          // on the remote server, image files are served from `/images`
          return rev.replace("/img", "/images");
        },
      })
    )
    .pipe(gulp.dest("cdn"));
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
gulp.task("default", function () {
  return gulp
    .src("dist/**")
    .pipe(
      RevAll.revision({
        transformFilename: function (file, hash) {
          var ext = path.extname(file.path);
          return hash.substr(0, 5) + "." + path.basename(file.path, ext) + ext; // 3410c.filename.ext
        },
      })
    )
    .pipe(gulp.dest("cdn"));
});
```

#### debug

If you set this options to true, verbose logging will be emitted to console.<br/>
Type: `Boolean`<br/>
Default: `false`<br/>

## Annotater & Replacer

In some cases, false-positives may occur. Strings that are similar to a file reference may be incorrectly replaced.<br/>

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

This behaviour can be avoided by passing custom `annotator` and `replacer` functions in as options.

### Annotator

The annotator function is called with the original file content and path.
Annotator function should return a list of objects that contain fragments of the file content in order.
You may split the file up into as many fragments as necessary and attach any other metadata to the fragments.
The file will be reassembled in order. <br/>

The default annotator returns one fragment with no annotations:

```js
options.annotator = function (contents, path) {
  var fragments = [{ contents: contents }];
  return fragments;
};
```

### Replacer

The replacer function's job is to replace references to revisioned files. The paremeters are as follows:<br/>

`fragment`: a file fragment as created in the annotator function.<br/>
`replaceRegExp`: parameter is a regular expression that can be used to match the part of the fragement to be replaced. The regular expression has 4 capture groups. $1 & $4 are what precedes and follows the reference. $2 is the file path without the extension, and $3 is the file extension.<br/>
`newReference`: what gulp-rev-all wants to replace the file path without the extension (\$2) with.<br/>
`referencedFile`: contains additional properties of the file reference thats being replaced. See the 'Additional Properties' section for more information.<br/>

The default replacer function is as follows:

```js
options.replacer = function (
  fragment,
  replaceRegExp,
  newReference,
  referencedFile
) {
  fragment.contents = fragment.contents.replace(
    replaceRegExp,
    "$1" + newReference + "$3$4"
  );
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

Make sure to set the files to [never expire](https://developer.yahoo.com/performance/rules.html#expires) for this to have an effect.

## License

[MIT](https://opensource.org/licenses/MIT) © [Joshua Bellamy](https://smysnk.com)
