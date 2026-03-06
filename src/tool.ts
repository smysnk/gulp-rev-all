import crypto from "node:crypto";
import Path from "node:path";
import { isBinaryFileSync } from "isbinaryfile";

type FileReferenceContext = {
  base: string;
  contents: Buffer;
  path: string;
  revPathOriginal: string;
};

/**
 * Removes the final file extension from a path string.
 *
 * @param path Path to trim.
 * @returns The path without its final extension.
 */
export function path_without_ext(path: string): string {
  const ext = Path.extname(path);
  return path.slice(0, path.length - ext.length);
}

/**
 * Returns a normalized directory name with a trailing forward slash.
 *
 * @param path File system path to normalize.
 * @returns Normalized directory path ending in `/`.
 */
export function dirname_with_sep(path: string): string {
  return `${Path.dirname(path).replace(/\\/g, "/")}/`;
}

/**
 * Joins a URL prefix with a path using a single `/` separator.
 *
 * @param prefix URL prefix such as a CDN origin.
 * @param path Asset path to append.
 * @returns The combined URL path.
 */
export function join_path_url(prefix: string, path: string): string {
  const sanitizedPrefix = prefix.replace(/\/$/, "");
  const sanitizedPath = path.replace(/^\//, "");
  return [sanitizedPrefix, sanitizedPath].join("/");
}

/**
 * Joins a directory and a filename using normalized forward slashes.
 *
 * @param directory Directory portion of the path.
 * @param filename File or trailing path segment to append.
 * @returns A normalized path string.
 */
export function join_path(directory: string, filename: string): string {
  return Path.join(directory, filename)
    .replace(/^[a-z]:\\/i, "/")
    .replace(/\\/g, "/");
}

/**
 * Given a base path and resource path, will return resource path relative to the base.
 * Also normalizes Windows paths to forward slashes.
 *
 * @param base Base path to strip when the resource lives under it.
 * @param path Resource path to normalize.
 * @param noStartingSlash When provided, controls whether the returned path starts with `/`.
 * @returns The normalized relative path.
 */
export function get_relative_path(
  base: string,
  path: string,
  noStartingSlash?: boolean,
): string {
  if (base === path) {
    return "";
  }

  base = `${base.replace(/^[a-z]:/i, "").replace(/\\/g, "/").replace(/\/$/g, "")}/`;
  path = path.replace(/^[a-z]:/i, "").replace(/\\/g, "/");

  if (base === path.slice(0, base.length)) {
    path = `/${path.slice(base.length)}`;
  }

  const modifyStartingSlash = noStartingSlash !== undefined;
  if (modifyStartingSlash) {
    if (path[0] === "/" && noStartingSlash) {
      path = path.slice(1);
    } else if (path[0] !== "/" && !noStartingSlash) {
      path = `/${path}`;
    }
  }

  return path;
}

/**
 * Creates an MD5 hash from a string or buffer value.
 *
 * @param buf Value to hash.
 * @returns Lowercase hexadecimal MD5 hash.
 */
export function md5(buf: crypto.BinaryLike): string {
  return crypto.createHash("md5").update(buf).digest("hex");
}

/**
 * Detects whether a file's contents should be treated as binary.
 *
 * @param file File-like object exposing buffer contents.
 * @returns `true` when the contents are binary.
 */
export function is_binary_file(file: Pick<FileReferenceContext, "contents">): boolean {
  return isBinaryFileSync(file.contents, file.contents.length);
}

/**
 * Given a file (context) and a file reference, return all the possible representations of paths to get from
 * the context to the reference file.
 *
 * @param fileCurrentReference Referenced file.
 * @param file File containing the reference.
 * @returns All relative path forms that may point at the referenced file.
 */
export function get_reference_representations_relative(
  fileCurrentReference: FileReferenceContext,
  file: FileReferenceContext,
): string[] {
  const representations: string[] = [];

  if (
    dirname_with_sep(fileCurrentReference.path).indexOf(dirname_with_sep(file.path)) === 0
  ) {
    representations.push(
      get_relative_path(
        Path.dirname(file.path),
        fileCurrentReference.revPathOriginal,
        true,
      ),
    );

    representations.push(
      `.${get_relative_path(
        Path.dirname(file.path),
        fileCurrentReference.revPathOriginal,
        false,
      )}`,
    );
  }

  if (
    dirname_with_sep(file.path) !== dirname_with_sep(fileCurrentReference.path) &&
    dirname_with_sep(fileCurrentReference.path).indexOf(dirname_with_sep(file.path)) === -1
  ) {
    const pathCurrentReference = dirname_with_sep(
      get_relative_path(
        fileCurrentReference.base,
        fileCurrentReference.revPathOriginal,
      ),
    );
    const pathFile = dirname_with_sep(get_relative_path(file.base, file.revPathOriginal));

    let relPath = Path.relative(pathFile, pathCurrentReference);
    relPath = relPath.replace(/\\/g, "/");
    representations.push(
      join_path(relPath, Path.basename(fileCurrentReference.revPathOriginal)),
    );
  }

  return representations;
}

/**
 * Given a file (context) and a file reference, return all the possible representations of paths to get from
 * the context to the reference file.
 *
 * @param fileCurrentReference Referenced file.
 * @returns All absolute path forms that may point at the referenced file.
 */
export function get_reference_representations_absolute(
  fileCurrentReference: Pick<FileReferenceContext, "base" | "revPathOriginal">,
): string[] {
  const representations: string[] = [];

  representations.push(
    get_relative_path(fileCurrentReference.base, fileCurrentReference.revPathOriginal, false),
  );

  const representation = get_relative_path(
    fileCurrentReference.base,
    fileCurrentReference.revPathOriginal,
    true,
  );
  if (representation.indexOf("/")) {
    representations.push(representation);
  }

  return representations;
}
