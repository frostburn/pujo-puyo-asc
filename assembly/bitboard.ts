// Puyos of a single color are represented as a bitboard consisting of two unsigned integers
// The width of the playing grid is fixed to 6
export type Puyos = Uint64Array;

// Bitboard constants
export const WIDTH:i32 = 6;
const SLICE_HEIGHT:i32 = 10;
const H_SHIFT:u64 = 1;
const V_SHIFT:u64 = 6;
const TOP_TO_BOTTOM:u64 = V_SHIFT * (SLICE_HEIGHT - 1);
// Bitboard patterns
const TOP:u64 = (1 << WIDTH) - 1;
const BOTTOM:u64 = TOP << ((SLICE_HEIGHT - 1) * V_SHIFT);
const FULL:u64 =
  TOP |
  (TOP << V_SHIFT) |
  (TOP << (V_SHIFT * 2)) |
  (TOP << (V_SHIFT * 3)) |
  (TOP << (V_SHIFT * 4)) |
  (TOP << (V_SHIFT * 5)) |
  (TOP << (V_SHIFT * 6)) |
  (TOP << (V_SHIFT * 7)) |
  (TOP << (V_SHIFT * 8)) |
  BOTTOM;
const LEFT_WALL:u64 =
  1 |
  (1 << V_SHIFT) |
  (1 << (V_SHIFT * 2)) |
  (1 << (V_SHIFT * 3)) |
  (1 << (V_SHIFT * 4)) |
  (1 << (V_SHIFT * 5)) |
  (1 << (V_SHIFT * 6)) |
  (1 << (V_SHIFT * 7)) |
  (1 << (V_SHIFT * 8)) |
  (1 << (V_SHIFT * 9));
const RIGHT_BLOCK:u64 = FULL ^ LEFT_WALL;
const INVALID:u64 = ~FULL;
const LIFE_BLOCK:u64 = BOTTOM | (BOTTOM >> V_SHIFT);
const SEMI_LIFE_BLOCK:u64 = LIFE_BLOCK | (BOTTOM >> (2 * V_SHIFT));
// Large scale structure
export const NUM_SLICES:i32 = 2;
export const HEIGHT:i32 = SLICE_HEIGHT * NUM_SLICES;
export const LIFE_HEIGHT:i32 = 12;
export const GHOST_Y:i32 = 7;

// Rules
const CLEAR_THRESHOLD:i32 = 4;
// Scoring
const GROUP_BONUS:Array<i32> = [0, 2, 3, 4, 5, 6, 7, 10];

/**
 * Obtain an empty bitboard stack of puyos.
 * @returns A screenful of air.
 */
export function emptyPuyos(): Puyos {
  return new Uint64Array(NUM_SLICES);
}

/**
 * Clone a collection of puyos.
 * @param puyos A collection of puyos to copy.
 * @returns A copy of the puyos.
 */
export function clone(puyos: Puyos): Puyos {
  const result = emptyPuyos();
  result[0] = puyos[0];
  result[1] = puyos[1];
  return result;
}

/**
 * Convert a boolean array to a collection of puyos
 * @param array An array indicating the presence of puyos.
 * @returns A collection of puyos.
 */
export function fromArray(array: boolean[]): Puyos {
  const puyos = emptyPuyos();
  for (let j = 0; j < NUM_SLICES; ++j) {
    for (let i = 0; i < WIDTH * SLICE_HEIGHT; ++i) {
      const index = i + j * WIDTH * SLICE_HEIGHT;
      if (index < array.length && array[index]) {
        puyos[j] |= 1 << i;
      }
    }
  }
  return puyos;
}

/**
 * Create a collection consisting of only a single puyo at the given coordinates.
 * @param x Horizontal coordinate. 0-indexed, left to right.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @returns A collection of a single puyo.
 */
export function singlePuyo(x: i32, y: i32): Puyos {
  const slice_y = y % SLICE_HEIGHT;
  y -= slice_y;
  const result = emptyPuyos();
  result[y / SLICE_HEIGHT] |= 1 << (x + slice_y * V_SHIFT);
  return result;
}

/**
 * Create a collection consisting of a single vertical line of puyos at the given coordinate.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @returns A vertical line of puyos.
 */
export function verticalLine(y: i32): Puyos {
  const slice_y = y % SLICE_HEIGHT;
  y -= slice_y;
  const result = emptyPuyos();
  result[y / SLICE_HEIGHT] |= TOP << (slice_y * V_SHIFT);
  return result;
}

export function verticalShift(puyos: Puyos, deltaY: i32): void {
  if (deltaY > 0) {
    puyos[1] = ((puyos[1] << (deltaY * V_SHIFT)) & FULL) | puyos[0] >> ((SLICE_HEIGHT - deltaY) * V_SHIFT);
    puyos[0] = (puyos[0] << (deltaY * V_SHIFT)) & FULL;
  } else if (deltaY < 0) {
    deltaY = -deltaY;
    puyos[0] = (puyos[0] >> (deltaY * V_SHIFT)) | ((puyos[1] << ((SLICE_HEIGHT - deltaY) * V_SHIFT)) & FULL);
    puyos[1] >>= deltaY * V_SHIFT;
  }
}

/**
 * Test if there is a puyo in the collection at the given coordinates.
 * @param puyos A collection of puyos.
 * @param x Horizontal coordinate. 0-indexed, left to right.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @returns `true` if there is a puyo at the given coordinates.
 */
export function puyoAt(puyos: Puyos, x: i32, y: i32): boolean {
  const slice_y = y % SLICE_HEIGHT;
  y -= slice_y;
  return !!(puyos[y / SLICE_HEIGHT] & (1 << (x + slice_y * V_SHIFT)));
}

/**
 * Test if a collection of puyos is all air.
 * @param puyos A collection of puyos.
 * @returns `true` if there aren't any puyos present.
 */
export function isEmpty(puyos: Puyos): boolean {
  return !(puyos[0] | puyos[1]);
}

/**
 * Test if there is one or more puyos in the collection.
 * @param puyos A collection of puyos.
 * @returns `true` if there are puyos present.
 */
export function isNonEmpty(puyos: Puyos): boolean {
  return !!(puyos[0] | puyos[1]);
}

/**
 * Render puyos of a single color in ASCII using @ for puyos and . for empty space.
 */
export function logPuyos(puyos: Puyos): void {
  const lines = ['┌─────────────┐'];
  for (let i = 0; i < NUM_SLICES; ++i) {
    for (let y = 0; y < SLICE_HEIGHT; ++y) {
      let line = '│';
      for (let x = 0; x < WIDTH; ++x) {
        if (puyos[i] & (1 << (x * H_SHIFT + y * V_SHIFT))) {
          line += ' @';
        } else {
          line += ' .';
        }
      }
      line += ' │';
      if (y === SLICE_HEIGHT - 1 && puyos[i] & INVALID) {
        line += '!';
      }
      lines.push(line);
    }
  }
  lines.push('└─────────────┘');
  console.log(lines.join('\n'));
}

/**
 * Perform a flood-fill of the source bitboard into the target. Modifies source in-place.
 * @param source Small bitboard pattern to expand.
 * @param target Bitboard pattern to constrain the expansion.
 */
export function flood(source: Puyos, target: Puyos): void {
  source[0] &= target[0];
  source[1] &= target[1];

  if (!(source[0] | source[1])) {
    return;
  }
  const temp = emptyPuyos();
  do {
    temp[0] = source[0];
    temp[1] = source[1];

    // Top slice
    source[0] |=
      (((source[0] & RIGHT_BLOCK) >> H_SHIFT) |
        ((source[0] << H_SHIFT) & RIGHT_BLOCK) |
        (source[0] << V_SHIFT) |
        (source[0] >> V_SHIFT) |
        ((source[1] & TOP) << TOP_TO_BOTTOM)) &
      target[0];

    // Bottom slice
    source[1] |=
      (((source[1] & RIGHT_BLOCK) >> H_SHIFT) |
        ((source[1] << H_SHIFT) & RIGHT_BLOCK) |
        (source[1] << V_SHIFT) |
        (source[1] >> V_SHIFT) |
        ((source[0] & BOTTOM) >> TOP_TO_BOTTOM)) &
      target[1];
  } while (
    temp[0] !== source[0] ||
    temp[1] !== source[1]
  );
}

/**
 * Add puyos from b to a, modifying a in place.
 * @param a Puyos to merge into.
 * @param b Puyos to merge.
 */
export function merge(a: Puyos, b: Puyos): void {
  a[0] |= b[0];
  a[1] |= b[1];
}

/**
 * Make puyos fall as far as they go.
 * @param grid An array of puyos to apply gravity to.
 * @returns `true` if anything happened.
 */
export function resolveGravity(grid: Puyos[]): boolean {
  const all = emptyPuyos();
  for (let i = 0; i < grid.length; ++i) {
    merge(all, grid[i]);
  }

  let didSomething = false;
  let didFall = true;
  while (didFall) {
    let unsupported: u64;

    unsupported = all[1] & ~((all[1] >> V_SHIFT) | BOTTOM);
    didFall = !!unsupported;
    all[1] ^= unsupported ^ (unsupported << V_SHIFT);
    for (let i = 0; i < grid.length; ++i) {
      const falling = grid[i][1] & unsupported;
      grid[i][1] ^= falling ^ (falling << V_SHIFT);
    }

    unsupported =
      all[0] & ~((all[0] >> V_SHIFT) | ((all[1] & TOP) << TOP_TO_BOTTOM));
    didFall = didFall || !!unsupported;
    all[1] |= (unsupported & BOTTOM) >> TOP_TO_BOTTOM;
    all[0] ^= unsupported ^ ((unsupported << V_SHIFT) & FULL);
    for (let i = 0; i < grid.length; ++i) {
      const falling = grid[i][0] & unsupported;
      grid[i][1] |= (falling & BOTTOM) >> TOP_TO_BOTTOM;
      grid[i][0] ^= falling ^ ((falling << V_SHIFT) & FULL);
    }

    didSomething = didSomething || didFall;
  }
  return didSomething;
}

/**
 * Count the number of puyos in the collection.
 * @param puyos Collection of puyos to count.
 * @returns The number of puyos present.
 */
export function puyoCount(puyos: Puyos): i32 {
  return <i32>(popcnt(puyos[0]) + popcnt(puyos[1]));
}

function getGroupBonus(group_size: i32): i32 {
  group_size -= CLEAR_THRESHOLD;
  if (group_size >= GROUP_BONUS.length) {
    group_size = GROUP_BONUS.length - 1;
  }
  return GROUP_BONUS[group_size];
}

export class ClearResult {
  numCleared: i32;
  groupBonus: i32;
  cleared: Puyos;

  constructor(numCleared: i32, groupBonus: i32, cleared: Puyos) {
    this.numCleared = numCleared;
    this.groupBonus = groupBonus;
    this.cleared = cleared;
  }
};

export function clearGroups(puyos: Puyos): ClearResult {
  let numCleared = 0;
  let groupBonus = 0;
  const cleared = emptyPuyos();
  const group = emptyPuyos();
  const temp = clone(puyos);
  temp[0] &= LIFE_BLOCK;
  // Clear from the bottom up hoping for an early exit.
  for (let i = NUM_SLICES - 1; i >= 0; i--) {
    // TODO: Don't iterate outside of life block
    for (let j = WIDTH * SLICE_HEIGHT - 2; j >= 0; j -= 2) {
      group[i] = 3 << j;
      flood(group, temp);
      temp[0] ^= group[0];
      temp[1] ^= group[1];
      const groupSize: i32 = puyoCount(group);
      if (groupSize >= CLEAR_THRESHOLD) {
        merge(cleared, group);
        groupBonus += getGroupBonus(groupSize);
        numCleared += groupSize;
      }
      if (isEmpty(temp)) {
        // TODO: full break
        break;
      }
    }
  }

  puyos[0] ^= cleared[0];
  puyos[1] ^= cleared[1];

  return new ClearResult(numCleared, groupBonus, cleared);
}

export function clearGarbage(garbage: Puyos, cleared: Puyos): Puyos {
  const eliminated = clone(garbage);

  eliminated[0] &=
    (((cleared[0] & RIGHT_BLOCK) >> H_SHIFT) |
      ((cleared[0] << H_SHIFT) & RIGHT_BLOCK) |
      (cleared[0] << V_SHIFT) |
      (cleared[0] >> V_SHIFT)) &
    SEMI_LIFE_BLOCK;

  eliminated[1] &=
    ((cleared[1] & RIGHT_BLOCK) >> H_SHIFT) |
    ((cleared[1] << H_SHIFT) & RIGHT_BLOCK) |
    (cleared[1] << V_SHIFT) |
    (cleared[1] >> V_SHIFT);

  garbage[0] ^= eliminated[0];
  garbage[1] ^= eliminated[1];

  return eliminated;
}

export function vanishTop(puyos: Puyos): void {
  puyos[0] &= SEMI_LIFE_BLOCK;
}
