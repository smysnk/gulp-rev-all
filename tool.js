import Path from "path";
import crypto from "crypto";
import { isBinaryFileSync } from "isbinaryfile";

export function path_without_ext(path) {
  var ext = Path.extname(path);
  return path.substr(0, path.length - ext.length);
}

export function dirname_with_sep(path) {
  return Path.dirname(path).replace(/\\/g, "/") + "/";
}

export function join_path_url(prefix, path) {
  prefix = prefix.replace(/\/$/, "");
  path = path.replace(/^\//, "");
  return [prefix, path].join("/");
}

/**
 * Joins a directory and a filename, replaces Windows forward-slash with a backslash.
 */
export function join_path(directory, filename) {
  return Path.join(directory, filename)
    .replace(/^[a-z]:\\/i, "/")
    .replace(/\\/g, "/");
}

/**
 * Given a base path and resource path, will return resource path relative to the base.
 * Also replaces Windows forward-slash with a backslash.
 */
export function get_relative_path(base, path, noStartingSlash) {
  if (base === path) {
    return "";
  }

  // Sanitize inputs, convert windows to posix style slashes, ensure trailing slash for base
  base =
    base
      .replace(/^[a-z]:/i, "")
      .replace(/\\/g, "/")
      .replace(/\/$/g, "") + "/";
  path = path.replace(/^[a-z]:/i, "").replace(/\\/g, "/");

  // Only truncate paths that overap with the base
  if (base === path.substr(0, base.length)) {
    path = "/" + path.substr(base.length);
  }

  var modifyStartingSlash = noStartingSlash !== undefined;
  if (modifyStartingSlash) {
    if (path[0] === "/" && noStartingSlash) {
      path = path.substr(1);
    } else if (path[0] !== "/" && !noStartingSlash) {
      path = "/" + path;
    }
  }

  return path;
}

export function md5(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

export function is_binary_file(file) {
  return isBinaryFileSync(file.contents, file.contents.length);
}

/**
 * Given a file (context) and a file reference, return all the possible representations of paths to get from
 * the context to the reference file.
 *
 */
export function get_reference_representations_relative(
  fileCurrentReference,
  file
) {
  var representations = [];

  //  Scenario 2: Current file is the same directory or lower than the reference
  //        (ie. file.path and the reference file.path are the same)
  //
  //          file.base = /user/project
  //          file.path = /user/project/second/current_file.html
  //  fileCurrentReference.path = /user/project/second/index.html

  if (
    dirname_with_sep(fileCurrentReference.path).indexOf(
      dirname_with_sep(file.path)
    ) === 0
  ) {
    //  index.html
    representations.push(
      get_relative_path(
        Path.dirname(file.path),
        fileCurrentReference.revPathOriginal,
        true
      )
    );

    //  ./index.html   (reference: relative)
    representations.push(
      "." +
        get_relative_path(
          Path.dirname(file.path),
          fileCurrentReference.revPathOriginal,
          false
        )
    );
  }

  //  Scenario 3: Current file is in a different child directory than the reference
  //      (ie. file.path and the reference file.path are different, not in root directory)
  //
  //          file.base = /user/project
  //          file.path = /user/project/first/index.html
  //  fileCurrentReference.path = /user/project/second/index.html

  if (
    dirname_with_sep(file.path) !==
      dirname_with_sep(fileCurrentReference.path) &&
    dirname_with_sep(fileCurrentReference.path).indexOf(
      dirname_with_sep(file.path)
    ) === -1
  ) {
    var pathCurrentReference = dirname_with_sep(
      get_relative_path(
        fileCurrentReference.base,
        fileCurrentReference.revPathOriginal
      )
    );
    var pathFile = dirname_with_sep(
      get_relative_path(file.base, file.revPathOriginal)
    );

    // ../second/index.html
    var relPath = Path.relative(pathFile, pathCurrentReference);
    relPath = relPath.replace(/\\/g, "/");
    representations.push(
      join_path(relPath, Path.basename(fileCurrentReference.revPathOriginal))
    );
  }

  return representations;
}

/**
 * Given a file (context) and a file reference, return all the possible representations of paths to get from
 * the context to the reference file.
 *
 */
export function get_reference_representations_absolute(fileCurrentReference) {
  var representations = [];
  var representation;

  //  Scenario 1: Current file is anywhere
  //  /view/index.html  (reference: absolute)
  representations.push(
    get_relative_path(
      fileCurrentReference.base,
      fileCurrentReference.revPathOriginal,
      false
    )
  );

  // Without starting slash, only if it contains a directory
  // view/index.html  (reference: absolute, without slash prefix)
  representation = get_relative_path(
    fileCurrentReference.base,
    fileCurrentReference.revPathOriginal,
    true
  );
  if (representation.indexOf("/")) {
    representations.push(representation);
  }

  return representations;
}
