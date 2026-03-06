import { type Transform } from "node:stream";
import transformStream from "easy-transform-stream";
import PluginError from "plugin-error";
import type Vinyl from "vinyl";
import Revisioner, { type RevisionOptions, type RevisionedFile } from "./revisioner.js";

const PLUGIN_NAME = "gulp-rev-all";

type RevisionStreamFile = Vinyl & {
  revisioner?: Revisioner;
};

/**
 * Gulp plugin for static asset revisioning with dependency considerations,
 * appends content hash to each filename (eg. unicorn.css => unicorn.098f6bcd.css),
 * re-writes references.
 */
export interface RevisionAllPlugin {
  /**
   * Creates a transform stream that discards the upstream files and emits a
   * generated manifest file. Must be used after {@link revision}.
   *
   * @returns An object-mode transform stream that emits one {@link RevisionedFile}
   * whose path defaults to `rev-manifest.json` and whose contents are the JSON
   * manifest map.
   */
  manifestFile(): Transform;
  /**
   * Creates a transform stream that revisions incoming files and rewrites references
   * to other files in the same stream.
   *
   * @param options Optional revision behavior overrides. When omitted, the plugin
   * uses the same defaults as {@link Revisioner.constructor}.
   * @returns An object-mode transform stream that buffers the full input set and
   * emits the revised Vinyl files after hashing, renaming, and reference rewriting.
   */
  revision(options?: RevisionOptions): Transform;
  /**
   * Creates a transform stream that discards the upstream files and emits a
   * generated version descriptor file. Must be used after {@link revision}.
   *
   * @returns An object-mode transform stream that emits one {@link RevisionedFile}
   * whose path defaults to `rev-version.json` and whose contents are a JSON object
   * with `hash` and `timestamp` fields.
   */
  versionFile(): Transform;
}

/**
 * Default plugin export consumed from `gulp-rev-all`.
 */
const RevAll: RevisionAllPlugin = {
  revision(options) {
    const revisioner = new Revisioner(options);

    return transformStream(
      { objectMode: true },
      async (chunk) => {
        const file = chunk as RevisionStreamFile;

        if (file.isStream()) {
          throw new PluginError(PLUGIN_NAME, "Streams not supported!");
        }

        if (file.isBuffer()) {
          revisioner.processFile(file);
        }

        file.revisioner = revisioner;
        return undefined;
      },
      async function* () {
        revisioner.run();
        yield* Object.values(revisioner.files);
      },
    );
  },

  versionFile() {
    let revisioner: Revisioner | undefined;

    return transformStream(
      { objectMode: true },
      async (chunk) => {
        const file = chunk as RevisionStreamFile;

        if (!revisioner) {
          revisioner = file.revisioner;
        }

        return undefined;
      },
      async function* () {
        if (!revisioner) {
          throw new PluginError(PLUGIN_NAME, "revision() must be called first!");
        }

        yield revisioner.versionFile();
      },
    );
  },

  manifestFile() {
    let revisioner: Revisioner | undefined;

    return transformStream(
      { objectMode: true },
      async (chunk) => {
        const file = chunk as RevisionStreamFile;

        if (!revisioner) {
          revisioner = file.revisioner;
        }

        return undefined;
      },
      async function* () {
        if (!revisioner) {
          throw new PluginError(PLUGIN_NAME, "revision() must be called first!");
        }

        yield revisioner.manifestFile();
      },
    );
  },
};

export default RevAll;
export type {
  AnnotatedFragment,
  FileMatchRule,
  ReferenceDescriptor,
  ReferenceGroupsContainer,
  ReferencePathEntry,
  RevisionManifest,
  RevisionOptions,
  RevisionedFile,
} from "./revisioner.js";
