import { Transform, type TransformCallback, type TransformOptions } from "node:stream";

type TransformChunkHandler<TInput, TOutput> = (chunk: TInput) => Promise<TOutput | undefined>;
type TransformFlushHandler<TOutput> = () => AsyncIterable<TOutput | undefined>;

/**
 * Creates an object-mode transform stream backed by async transform and flush handlers.
 *
 * This is a small internal replacement for `easy-transform-stream` so the package
 * can expose a real CommonJS entrypoint without depending on ESM-only runtime code.
 */
export default function createAsyncTransform<TInput, TOutput>(
  options: TransformOptions,
  handleChunk: TransformChunkHandler<TInput, TOutput>,
  handleFlush?: TransformFlushHandler<TOutput>,
): Transform {
  return new Transform({
    ...options,
    async transform(
      this: Transform,
      chunk: TInput,
      _encoding: BufferEncoding,
      callback: TransformCallback,
    ) {
      try {
        const output = await handleChunk(chunk);
        if (output !== undefined) {
          this.push(output);
        }

        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
    async flush(this: Transform, callback: TransformCallback) {
      try {
        if (handleFlush) {
          for await (const output of handleFlush()) {
            if (output !== undefined) {
              this.push(output);
            }
          }
        }

        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}
