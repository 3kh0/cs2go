let frameTime: number | undefined;

/** All synchronous render passes of one frame use the same sky animation time
 * and cache bucket. Standalone renders retain the existing wall-clock policy. */
export function sourceSkyFrameTime() {
  return frameTime ?? performance.now() / 1000;
}

export function withSourceSkyFrame<Result>(draw: () => Result): Result {
  const previous = frameTime;
  frameTime ??= performance.now() / 1000;
  try {
    return draw();
  } finally {
    frameTime = previous;
  }
}
