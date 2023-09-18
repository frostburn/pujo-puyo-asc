/**
 * Perform a poor man's shuffle by abusing sorting.
 * @param array Array to shuffle.
 */
export function shuffle<T>(array: Array<T>): void {
  array.sort(() => 2*<i32>(2*Math.random()) - 1);
}
