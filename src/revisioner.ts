import chalk from "chalk";
import fancyLog from "fancy-log";
import Path from "node:path";
import Vinyl from "vinyl";
import {
  get_reference_representations_absolute,
  get_reference_representations_relative,
  get_relative_path,
  is_binary_file,
  join_path,
  join_path_url,
  md5,
  path_without_ext,
} from "./tool.js";

/**
 * Pattern used to match files by relative path.
 */
export type FileMatchRule = RegExp | string;

/**
 * A mutable content fragment produced by {@link RevisionOptions.annotator}.
 */
export interface AnnotatedFragment {
  /**
   * Fragment text that will be reassembled into the final file contents.
   */
  contents: string;
  [key: string]: unknown;
}

/**
 * A discovered reference from one file to another file in the revision set.
 */
export interface ReferenceDescriptor {
  /**
   * File that is being referenced.
   */
  file: RevisionedFile;
  /**
   * Reference text exactly as it appears in the source content.
   */
  path: string;
}

/**
 * Internal record used when replacing a discovered file reference.
 */
export interface ReferencePathEntry {
  /**
   * File that the reference resolves to.
   */
  file: RevisionedFile;
  /**
   * Original reference text that matched in the source file.
   */
  path: string;
  /**
   * Regular expressions that can be used to replace this reference in content fragments.
   */
  regExps: RegExp[];
}

/**
 * Reference candidates grouped by matching priority.
 */
export interface ReferenceGroupsContainer {
  /**
   * Absolute references, checked after relative references.
   */
  absolute: ReferenceDescriptor[];
  /**
   * Relative references, checked before absolute references.
   */
  relative: ReferenceDescriptor[];
}

/**
 * Vinyl file shape after it has been processed by the revisioner.
 */
export type RevisionedFile = Vinyl & {
  /**
   * Buffer contents for the file.
   */
  contents: Buffer;
  /**
   * Discovered references organized by relative and absolute matching.
   */
  referenceGroupsContainer: ReferenceGroupsContainer;
  /**
   * Snapshot of the original file contents before any reference rewriting.
   */
  revContentsOriginal: Buffer;
  /**
   * Final revisioned filename, including extension.
   */
  revFilename: string;
  /**
   * Original file extension, including the leading dot.
   */
  revFilenameExtOriginal: string;
  /**
   * Original filename without its extension.
   */
  revFilenameOriginal: string;
  /**
   * Final hash used to revision the file.
   */
  revHash: string;
  /**
   * Hash of the file contents before dependency-aware recalculation.
   */
  revHashOriginal: string;
  /**
   * Alias of {@link revPathOriginal} kept for compatibility with existing consumers.
   */
  revOrigPath: string;
  /**
   * Final revisioned path relative to the revision base.
   */
  revPath: string;
  /**
   * Original absolute file path before revisioning.
   */
  revPathOriginal: string;
  /**
   * Referenced files keyed by their absolute path.
   */
  revReferenceFiles: Record<string, RevisionedFile>;
  /**
   * Reference replacement metadata keyed by original reference text.
   */
  revReferencePaths: Record<string, ReferencePathEntry>;
  /**
   * Revisioner instance that processed this file.
   */
  revisioner?: Revisioner;
};

/**
 * Manifest mapping original relative asset paths to revisioned relative asset paths.
 */
export type RevisionManifest = Record<string, string>;

/**
 * Options that control file hashing, renaming, and reference rewriting.
 */
export interface RevisionOptions {
  /**
   * Splits file contents into replacable fragments. Use this to avoid rewriting
   * references in regions that should be ignored.
   *
   * @defaultValue `(contents) => [{ contents }]`
   */
  annotator?: (contents: string, path: string) => AnnotatedFragment[];
  /**
   * Prefix applied while matching absolute references in source files.
   * Useful when source references already include a deployment base path.
   *
   * @defaultValue `""`
   */
  baseHref?: string;
  /**
   * Enables verbose logging through `fancy-log`.
   *
   * @defaultValue `false`
   */
  debug?: boolean;
  /**
   * Rules that disable renaming, searching, and reference updates for matching files.
   *
   * @defaultValue `[/^\/favicon.ico$/g]`
   */
  dontGlobal?: FileMatchRule[];
  /**
   * Rules for files that should keep their original filename.
   *
   * @defaultValue `[]`
   */
  dontRenameFile?: FileMatchRule[];
  /**
   * Rules for files whose contents should not be searched for references.
   *
   * @defaultValue `[]`
   */
  dontSearchFile?: FileMatchRule[];
  /**
   * Rules for files whose references should not be rewritten.
   *
   * @defaultValue `[]`
   */
  dontUpdateReference?: FileMatchRule[];
  /**
   * Output filename for the generated manifest file.
   *
   * @defaultValue `"rev-manifest.json"`
   */
  fileNameManifest?: string;
  /**
   * Output filename for the generated version file.
   *
   * @defaultValue `"rev-version.json"`
   */
  fileNameVersion?: string;
  /**
   * Number of hash characters appended when using the default filename format.
   *
   * @defaultValue `8`
   */
  hashLength?: number;
  /**
   * File extensions that should be included in the generated manifest.
   *
   * @defaultValue `[".css", ".js"]`
   */
  includeFilesInManifest?: string[];
  /**
   * Prefix applied to rewritten absolute references.
   *
   * @defaultValue `""`
   */
  prefix?: string;
  /**
   * Converts a discovered reference into the regular expressions used for matching and replacement.
   *
   * @defaultValue Built-in matcher that supports absolute and relative asset paths,
   * including quoted extensionless JavaScript and TypeScript references.
   */
  referenceToRegexs?: (reference: ReferenceDescriptor) => RegExp[];
  /**
   * Rewrites a matched reference within an annotated fragment.
   *
   * @defaultValue Built-in replacer that rewrites `$2` in the provided regular
   * expression match to the new reference path while preserving the original extension.
   */
  replacer?: (
    fragment: AnnotatedFragment,
    replaceRegExp: RegExp,
    newReference: string,
    referencedFile: RevisionedFile,
  ) => void;
  /**
   * Custom filename formatter. Receives the processed file and its final hash.
   *
   * @defaultValue `undefined`, which uses `<name>.<hash>.<ext>`.
   */
  transformFilename?: (this: Revisioner, file: RevisionedFile, hash: string) => string;
  /**
   * Custom path formatter for rewritten references.
   *
   * @defaultValue `undefined`, which leaves relative paths unchanged and applies
   * {@link RevisionOptions.prefix} to absolute paths.
   */
  transformPath?: (
    this: Revisioner,
    revisionedPath: string,
    sourcePath: string,
    referencedFile: RevisionedFile,
    contextFile: RevisionedFile,
  ) => string;
}

type ResolvedRevisionOptions = Required<
  Omit<RevisionOptions, "transformFilename" | "transformPath">
> &
  Pick<RevisionOptions, "transformFilename" | "transformPath">;

type Logger = (...args: unknown[]) => void;

function referenceToRegexs(reference: ReferenceDescriptor): RegExp[] {
  const escapedRefPathBase = path_without_ext(reference.path).replace(
    /([^0-9a-z])/gi,
    "\\$1",
  );
  const escapedRefPathExt = Path.extname(reference.path).replace(/([^0-9a-z])/gi, "\\$1");

  const regExps: RegExp[] = [];
  const nonFileNameChar = "[^a-zA-Z0-9\\.\\-\\_\\/]";
  const qoutes = "'|\"";
  const isJSReference = reference.path.match(/\.js$/);
  const isTSReference = reference.path.match(/\.ts$/);

  if (isJSReference || isTSReference) {
    const regExp = `(${qoutes})(${escapedRefPathBase})()(${qoutes}|$)`;
    regExps.push(new RegExp(regExp, "g"));
  }

  const regExp = `(${nonFileNameChar})(${escapedRefPathBase})(${escapedRefPathExt})(${nonFileNameChar}|$)`;
  regExps.push(new RegExp(regExp, "g"));

  return regExps;
}

function annotator(contents: string): AnnotatedFragment[] {
  return [{ contents }];
}

function replacer(
  fragment: AnnotatedFragment,
  replaceRegExp: RegExp,
  newReference: string,
): void {
  fragment.contents = fragment.contents.replace(
    replaceRegExp,
    `$1${newReference}$3$4`,
  );
}

function toRuleRegExp(rule: FileMatchRule): RegExp {
  return rule instanceof RegExp ? rule : new RegExp(`${rule}$`, "ig");
}

function matchesAnyRule(filename: string, rules: FileMatchRule[]): boolean {
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    if (filename.match(toRuleRegExp(rules[index]))) {
      return true;
    }
  }

  return false;
}

/**
 * Stateful revision engine used internally by the gulp plugin.
 */
export default class Revisioner {
  /**
   * Processed files keyed by their path relative to the revision base.
   */
  public files: Record<string, RevisionedFile> = {};
  /**
   * Incoming files collected before the revision pass runs.
   */
  public filesTemp: RevisionedFile[] = [];
  /**
   * Combined hash of the processed file set.
   */
  public hashCombined = "";
  /**
   * Logger implementation, enabled when {@link RevisionOptions.debug} is true.
   */
  public log: Logger;
  /**
   * Generated manifest of original-to-revisioned asset paths.
   */
  public manifest: RevisionManifest = {};
  /**
   * Effective options after defaults have been applied.
   */
  public options: ResolvedRevisionOptions;
  /**
   * Common base path shared by all processed files.
   */
  public pathBase?: string;
  /**
   * Working directory associated with the current revision run.
   */
  public pathCwd?: string;

  /**
   * Creates a new revision engine instance.
   *
   * @param options Optional revision behavior overrides.
   * @defaultValue `{}`
   */
  public constructor(options: RevisionOptions = {}) {
    const defaults: ResolvedRevisionOptions = {
      annotator,
      baseHref: "",
      debug: false,
      dontGlobal: [/^\/favicon.ico$/g],
      dontRenameFile: [],
      dontSearchFile: [],
      dontUpdateReference: [],
      fileNameManifest: "rev-manifest.json",
      fileNameVersion: "rev-version.json",
      hashLength: 8,
      includeFilesInManifest: [".css", ".js"],
      prefix: "",
      referenceToRegexs,
      replacer,
      transformFilename: undefined,
      transformPath: undefined,
    };

    this.options = { ...defaults, ...options };
    this.log = this.options.debug ? fancyLog : () => {};
  }

  /**
   * Creates the version file containing the combined hash and timestamp for the run.
   *
   * @returns A buffer-backed Vinyl file whose path defaults to `rev-version.json`
   * and whose JSON contents have the shape `{ hash: string, timestamp: string }`
   * once serialized.
   */
  public versionFile(): RevisionedFile {
    const out = {
      hash: this.hashCombined,
      timestamp: new Date(),
    };

    const file = new Vinyl({
      base: this.pathBase,
      contents: Buffer.from(JSON.stringify(out, null, 2)),
      cwd: this.pathCwd,
      path: Path.join(this.pathBase ?? "", this.options.fileNameVersion),
      revisioner: this,
    }) as unknown as RevisionedFile;

    file.revisioner = this;
    return file;
  }

  /**
   * Creates the manifest file containing the original-to-revisioned path map.
   *
   * @returns A buffer-backed Vinyl file whose path defaults to `rev-manifest.json`
   * and whose JSON contents map original relative asset paths to revisioned relative paths.
   */
  public manifestFile(): RevisionedFile {
    const file = new Vinyl({
      base: this.pathBase,
      contents: Buffer.from(JSON.stringify(this.manifest, null, 2)),
      cwd: this.pathCwd,
      path: Path.join(this.pathBase ?? "", this.options.fileNameManifest),
    }) as unknown as RevisionedFile;

    file.revisioner = this;
    return file;
  }

  /**
   * Adds an input file to the revision run and captures its original metadata.
   *
   * Non-buffer files are ignored because stream contents are not supported.
   *
   * @param file Input Vinyl file from the gulp stream.
   * @returns `void`. The file is stored internally and annotated with original hash
   * and path metadata for the later revision pass.
   */
  public processFile(file: Vinyl): void {
    if (!Buffer.isBuffer(file.contents)) {
      return;
    }

    if (!this.pathCwd) {
      this.pathCwd = file.cwd;
    }

    if (!file.base.match(/^(\/|[a-z]:)/i)) {
      file.base = join_path(file.cwd, file.base);
    }

    if (!this.pathBase) {
      this.pathBase = file.base;
    } else if (file.base.indexOf(this.pathBase) === -1) {
      const levelsBase = this.pathBase.split(/[/|\\]/);
      const levelsFile = file.base.split(/[/|\\]/);
      const common: string[] = [];

      for (let level = 0; level < levelsFile.length; level += 1) {
        if (
          level < levelsBase.length &&
          level < levelsFile.length &&
          levelsBase[level] === levelsFile[level]
        ) {
          common.push(levelsFile[level]);
          continue;
        }
      }

      if (common[common.length - 1] !== "") {
        common.push("");
      }
      this.pathBase = common.join("/");
    }

    const revisionedFile = file as RevisionedFile;
    revisionedFile.revPathOriginal = revisionedFile.revOrigPath = file.path;
    revisionedFile.revFilenameExtOriginal = Path.extname(file.path);
    revisionedFile.revFilenameOriginal = Path.basename(
      file.path,
      revisionedFile.revFilenameExtOriginal,
    );
    revisionedFile.revHashOriginal = md5(file.contents);
    revisionedFile.revContentsOriginal = file.contents;

    this.filesTemp.push(revisionedFile);
  }

  /**
   * Executes the full revision pass for all buffered files.
   *
   * This resolves references, computes dependency-aware hashes, renames files,
   * updates references, and refreshes the combined manifest and version hash.
   *
   * @returns `void`. Results are exposed by mutating {@link files}, {@link manifest},
   * and each collected {@link RevisionedFile}.
   */
  public run(): void {
    this.hashCombined = "";

    for (const file of this.filesTemp) {
      file.base = this.pathBase ?? file.base;
      const path = get_relative_path(this.pathBase ?? "", file.path);
      this.files[path] = file;
    }

    for (const path in this.files) {
      this.resolveReferences(this.files[path]);
    }

    for (const path in this.files) {
      this.revisionFilename(this.files[path]);
    }

    this.hashCombined = md5(this.hashCombined);

    for (const path in this.files) {
      this.updateReferences(this.files[path]);
    }
  }

  /**
   * Scans a file for references to every other file in the current revision set.
   *
   * @param fileResolveReferencesIn File whose contents should be searched.
   * @returns `void`. Discovered references are written to
   * `fileResolveReferencesIn.revReferencePaths` and `fileResolveReferencesIn.revReferenceFiles`.
   */
  public resolveReferences(fileResolveReferencesIn: RevisionedFile): void {
    const contents = String(fileResolveReferencesIn.revContentsOriginal);
    const referenceGroupRelative: ReferenceDescriptor[] = [];
    const referenceGroupAbsolute: ReferenceDescriptor[] = [];

    fileResolveReferencesIn.revReferencePaths = {};
    fileResolveReferencesIn.revReferenceFiles = {};
    fileResolveReferencesIn.referenceGroupsContainer = {
      relative: referenceGroupRelative,
      absolute: referenceGroupAbsolute,
    };

    if (
      is_binary_file(fileResolveReferencesIn) ||
      !this.shouldSearchFile(fileResolveReferencesIn)
    ) {
      return;
    }

    for (const path in this.files) {
      const fileCurrentReference = this.files[path];
      let references = get_reference_representations_relative(
        fileCurrentReference,
        fileResolveReferencesIn,
      );
      for (let index = 0; index < references.length; index += 1) {
        referenceGroupRelative.push({
          file: this.files[path],
          path: references[index],
        });
      }

      references = get_reference_representations_absolute(fileCurrentReference);
      for (let index = 0; index < references.length; index += 1) {
        referenceGroupAbsolute.push({
          file: this.files[path],
          path: join_path(this.options.baseHref, references[index]),
        });
      }
    }

    for (const referenceType in fileResolveReferencesIn.referenceGroupsContainer) {
      const referenceGroup =
        fileResolveReferencesIn.referenceGroupsContainer[
          referenceType as keyof ReferenceGroupsContainer
        ];

      for (
        let referenceIndex = 0;
        referenceIndex < referenceGroup.length;
        referenceIndex += 1
      ) {
        const reference = referenceGroup[referenceIndex];
        const regExps = this.options.referenceToRegexs(reference);

        for (let index = 0; index < regExps.length; index += 1) {
          if (contents.match(regExps[index])) {
            if (!fileResolveReferencesIn.revReferencePaths[reference.path]) {
              fileResolveReferencesIn.revReferenceFiles[reference.file.path] = reference.file;
              fileResolveReferencesIn.revReferencePaths[reference.path] = {
                file: reference.file,
                path: reference.path,
                regExps: [regExps[index]],
              };
              this.log(
                "gulp-rev-all:",
                "Found",
                referenceType,
                "reference [",
                chalk.magenta(reference.path),
                "] -> [",
                chalk.green(reference.file.path),
                "] in [",
                chalk.blue(fileResolveReferencesIn.revPathOriginal),
                "]",
              );
            } else if (
              fileResolveReferencesIn.revReferencePaths[reference.path].file
                .revPathOriginal === reference.file.revPathOriginal
            ) {
              fileResolveReferencesIn.revReferencePaths[reference.path].regExps.push(
                regExps[index],
              );
            } else {
              this.log(
                "gulp-rev-all:",
                "Possible ambiguous reference detected [",
                chalk.red(
                  fileResolveReferencesIn.revReferencePaths[reference.path].path,
                ),
                " (",
                fileResolveReferencesIn.revReferencePaths[reference.path].file
                  .revPathOriginal,
                ")] <-> [",
                chalk.red(reference.path),
                "(",
                chalk.red(reference.file.revPathOriginal),
                ")]",
              );
            }
          }
        }
      }
    }
  }

  /**
   * Calculates a dependency-aware hash for a file.
   *
   * The hash is based on the file contents and the hashes of all referenced files,
   * with cycle detection for circular references.
   *
   * @param file File to hash.
   * @param stack Traversal stack used internally to break cycles.
   * @returns The computed hash string. If the file has no discovered references,
   * this is `file.revHashOriginal`.
   */
  public calculateHash(file: RevisionedFile, stack: RevisionedFile[] = []): string {
    let hash = file.revHashOriginal;
    const hashArray: string[] = [];

    stack.push(file);

    if (Object.keys(file.revReferenceFiles).length > 0) {
      hashArray.push(hash);

      for (const key in file.revReferenceFiles) {
        if (stack.indexOf(file.revReferenceFiles[key]) === -1) {
          hashArray.push(this.calculateHash(file.revReferenceFiles[key], stack));
        }
      }

      if (
        this.options.prefix &&
        Object.keys(file.referenceGroupsContainer.absolute).length
      ) {
        hashArray.push(this.options.prefix);
      }

      hashArray.sort();
      hash = md5(hashArray.join(""));
    }

    stack.pop();
    return hash;
  }

  /**
   * Applies the final revisioned filename to a file and updates manifest state.
   *
   * @param file File to rename.
   * @returns `void`. The method updates `file.revHash`, `file.revFilename`,
   * `file.revPath`, and, when allowed, `file.path`.
   */
  public revisionFilename(file: RevisionedFile): void {
    let filename = file.revFilenameOriginal;
    const ext = file.revFilenameExtOriginal;

    file.revHash = this.calculateHash(file);

    if (this.options.transformFilename) {
      filename = this.options.transformFilename.call(this, file, file.revHash);
    } else {
      filename = `${filename}.${file.revHash.slice(0, this.options.hashLength)}${ext}`;
    }

    file.revFilename = filename;

    if (this.shouldFileBeRenamed(file)) {
      file.path = join_path(Path.dirname(file.path), filename);
    }

    this.hashCombined += file.revHash;

    const pathOriginal = get_relative_path(this.pathBase ?? "", file.revPathOriginal, true);
    const pathRevisioned = get_relative_path(file.base, file.path, true);
    if (this.options.includeFilesInManifest.indexOf(ext) !== -1) {
      this.manifest[pathOriginal] = pathRevisioned;
    }

    file.revPath = pathRevisioned;
  }

  /**
   * Rewrites all discovered references in a file to use their revisioned paths.
   *
   * @param file File whose contents should be updated.
   * @returns `void`. The method replaces `file.contents` with a new `Buffer`
   * containing the rewritten file text.
   */
  public updateReferences(file: RevisionedFile): void {
    if (is_binary_file(file) || !this.shouldSearchFile(file)) {
      return;
    }

    let contents = String(file.revContentsOriginal);
    const annotatedContent = this.options.annotator(contents, file.revPathOriginal);

    for (const pathReference in file.revReferencePaths) {
      const reference = file.revReferencePaths[pathReference];

      const referencePath = reference.path.slice(
        0,
        reference.path.length -
          (reference.file.revFilenameOriginal.length +
            reference.file.revFilenameExtOriginal.length),
      );
      let pathReferenceReplace =
        referencePath +
        (this.shouldFileBeRenamed(reference.file)
          ? reference.file.revFilename
          : reference.file.revFilenameOriginal);

      if (this.options.transformPath) {
        pathReferenceReplace = this.options.transformPath.call(
          this,
          pathReferenceReplace,
          reference.path,
          reference.file,
          file,
        );
      } else if (this.options.prefix && pathReferenceReplace[0] === "/") {
        pathReferenceReplace = join_path_url(this.options.prefix, pathReferenceReplace);
      }

      if (this.shouldUpdateReference(reference.file)) {
        const noExtReplace = path_without_ext(pathReferenceReplace);

        for (let fragmentIndex = 0; fragmentIndex < annotatedContent.length; fragmentIndex += 1) {
          for (let regexIndex = 0; regexIndex < reference.regExps.length; regexIndex += 1) {
            this.options.replacer(
              annotatedContent[fragmentIndex],
              reference.regExps[regexIndex],
              noExtReplace,
              reference.file,
            );
          }
        }
      }
    }

    contents = annotatedContent
      .map((annotation) => annotation.contents)
      .join("");
    file.contents = Buffer.from(contents);
  }

  /**
   * Checks whether a file should be renamed.
   *
   * @param file File to evaluate.
   * @returns `true` when the file should receive a revisioned filename, or `false`
   * when it matches {@link RevisionOptions.dontGlobal} or {@link RevisionOptions.dontRenameFile}.
   */
  public shouldFileBeRenamed(file: RevisionedFile): boolean {
    const filename = get_relative_path(file.base, file.revPathOriginal);

    if (matchesAnyRule(filename, this.options.dontGlobal)) {
      return false;
    }

    if (matchesAnyRule(filename, this.options.dontRenameFile)) {
      return false;
    }

    return true;
  }

  /**
   * Checks whether references to a file should be rewritten.
   *
   * @param file Referenced file to evaluate.
   * @returns `true` when references to the file may be updated, or `false` when
   * it matches {@link RevisionOptions.dontGlobal} or {@link RevisionOptions.dontUpdateReference}.
   */
  public shouldUpdateReference(file: RevisionedFile): boolean {
    const filename = get_relative_path(file.base, file.revPathOriginal);

    if (matchesAnyRule(filename, this.options.dontGlobal)) {
      return false;
    }

    if (matchesAnyRule(filename, this.options.dontUpdateReference)) {
      return false;
    }

    return true;
  }

  /**
   * Checks whether a file's contents should be searched for references.
   *
   * @param file File to evaluate.
   * @returns `true` when the file should be scanned for references, or `false`
   * when it matches {@link RevisionOptions.dontGlobal} or {@link RevisionOptions.dontSearchFile}.
   */
  public shouldSearchFile(file: RevisionedFile): boolean {
    const filename = get_relative_path(file.base, file.revPathOriginal);

    if (matchesAnyRule(filename, this.options.dontGlobal)) {
      return false;
    }

    if (matchesAnyRule(filename, this.options.dontSearchFile)) {
      return false;
    }

    return true;
  }
}
