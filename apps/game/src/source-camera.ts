/** Source FOV values describe a horizontal lens at 4:3. Three uses a vertical
 * lens; keeping that vertical lens fixed supplies Source's wider horizontal
 * view on widescreen, including stretched display modes and scoped lenses. */
export function sourceVerticalFov(horizontalAt4By3: number) {
  return (Math.atan(Math.tan((horizontalAt4By3 * Math.PI) / 360) * 0.75) * 360) / Math.PI;
}

export function sourceZoomRatio(verticalFov: number, unscopedHorizontal: number) {
  return (
    Math.tan((verticalFov * Math.PI) / 360) /
    Math.tan((sourceVerticalFov(unscopedHorizontal) * Math.PI) / 360)
  );
}
