import { ReadableStream } from 'node:stream/web';

/**
 * Apply `mapper` to each chunk of an input stream and return a new stream.
 *
 * Python analogy:
 *   async for chunk in input_stream:
 *       yield mapper(chunk)
 *
 * C++ analogy:
 *   transform each element as it is pulled from the input iterator.
 */
export function mapStream<TInput, TOutput>(
  input: ReadableStream<TInput>,
  mapper: (chunk: TInput) => TOutput,
): ReadableStream<TOutput> {
  const reader = input.getReader();

  return new ReadableStream<TOutput>({
    async pull(controller) {
      const readResult = await reader.read();

      if (readResult.done) {
        controller.close();
        return;
      }

      const mappedChunk = mapper(readResult.value);
      controller.enqueue(mappedChunk);
    },

    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
