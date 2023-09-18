import {
  HEIGHT,
  LIFE_HEIGHT,
  Puyos,
  WIDTH,
  clearGarbage,
  clearGroups,
  clone,
  emptyPuyos,
  fromArray,
  isEmpty,
  merge,
  puyoAt,
  resolveGravity,
  singlePuyo,
  verticalLine,
  verticalShift,
  vanishTop,
} from './bitboard';
import { shuffle } from './util';

/**
 * Result of advancing the screen one step.
 */
export class TickResult {
  score: i32;
  chainNumber: i32;
  didClear: boolean;
  allClear: boolean;
  busy: boolean;

  constructor(score: i32, chainNumber: i32, didClear: boolean, allClear: boolean, busy: boolean) {
    this.score = score;
    this.chainNumber = chainNumber;
    this.didClear = didClear;
    this.allClear = allClear;
    this.busy = busy;
  }
};

// Indices of types of puyos in the grid
export const RED = 0;
export const GREEN = 1;
export const YELLOW = 2;
export const BLUE = 3;
export const PURPLE = 4;
export const GARBAGE = 5;

export const NUM_PUYO_COLORS = 5;
export const NUM_PUYO_TYPES = 6;

export const ASCII_PUYO = 'RGYBPN';

// Scoring
const MAX_CLEAR_BONUS = 999;
const COLOR_BONUS = [0, 0, 3, 6, 12, 24];
const CHAIN_POWERS = [
  0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448,
  480, 512, 544, 576, 608, 640, 672,
];

/**
 * Convert puyo grid index to an ANSI color code.
 * @param n Grid index to convert.
 * @param dark Return a darkened version of the color.
 * @returns A string with the ANSI color switch instruction.
 */
export function colorOf(n: i32, dark:boolean = false): string {
  if (dark) {
    return `\x1b[3${n + 1}m`;
  }
  return `\x1b[3${n + 1};1m`;
}

function gridFromLines(lines: string[]): Puyos[] {
  const grid: Puyos[] = [];
  for (let j = 0; j < NUM_PUYO_TYPES; ++j) {
    const array = new Array<boolean>();
    for (let k = 0; k < lines.length; ++k) {
      for (let i = 0; i < WIDTH; ++i) {
        array.push(lines[k].charAt(i) === ASCII_PUYO.charAt(j));
      }
    }
    grid.push(fromArray(array));
  }
  return grid;
}

/**
 * A 6x20 screen of puyos, optimized for AI planning.
 * Gravity and chains resolve instantly and there are no sparks.
 * Only the bottom 6x12 area is chainable.
 * The 13th row acts as a ghost line which holds puyos that do not yet participate in chains.
 * Everything above that is vanished once everything has landed.
 * There are 5 different colors of puyos and 1 type of garbage/nuisance puyo.
 */
export class SimplePuyoScreen {
  grid: Puyos[];
  chainNumber: i32;
  garbageSlots: Array<i32> = []; // Ensure a perfectly even distribution. (Not part of Tsu, but I like it.)
  // No need to buffer garbage numerically, we have the space to drop a stone of garbage at once.
  // No deterministic RNG, knowing the correct seed would be cheating.

  /**
   * Construct a new 6x20 screen of puyos.
   */
  constructor() {
    this.grid = [];
    for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
      this.grid.push(emptyPuyos());
    }
    this.chainNumber = 0;
    // this.garbageSlots = new Array<i32>();
  }

  /**
   * Construct a new screen from ASCII representation of the grid.
   * @param lines Array of strings consisting of characters "RGYBPN", "N" stands for nuisance i.e. garbage.
   * @returns A 6x15 screen of puyos filled from top to bottom.
   */
  static fromLines(lines: string[]): SimplePuyoScreen {
    const result = new SimplePuyoScreen();
    result.grid = gridFromLines(lines);
    return result;
  }

  /**
   * Convert screen to lines of ASCII.
   * @returns Array of strings consisting of characters "RGYBPN", "N" stands for nuisance i.e. garbage.
   */
  toLines(): string[] {
    const result = [];
    for (let y = 0; y < HEIGHT; ++y) {
      let line = '';
      for (let x = 0; x < WIDTH; ++x) {
        let char = ' ';
        for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
          if (puyoAt(this.grid[i], x, y)) {
            char = ASCII_PUYO.charAt(i);
          }
        }
        line += char;
      }
      result.push(line);
    }
    return result;
  }

  /**
   * Replace the screen with random material.
   */
  randomize(): void {
    const array = [];
    for (let i = 0; i < WIDTH * HEIGHT; ++i) {
      if (Math.random() < 0.5) {
        array.push(-1);
      } else {
        array.push(Math.floor(Math.random() * NUM_PUYO_TYPES));
      }
    }
    this.grid = [];
    for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
      this.grid.push(fromArray(array.map(a => a === i)));
    }
  }

  /**
   * An array of strings suitable for rendering the screen in the console.
   */
  displayLines(): string[] {
    const result = ['╔════════════╗'];
    for (let y = 0; y < HEIGHT; ++y) {
      let line = '║';
      for (let x = 0; x < WIDTH; ++x) {
        if (x > 0) {
          line += ' ';
        }
        let any = false;
        let many = false;
        for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
          if (puyoAt(this.grid[i], x, y)) {
            if (any) {
              many = true;
            } else {
              line += colorOf(i, y < HEIGHT - LIFE_HEIGHT);
              if (i === GARBAGE) {
                line += '◎';
              } else {
                line += '●';
              }
            }
            any = true;
          }
        }
        if (many) {
          line = line.slice(0, -1) + '?';
        }
        if (!any) {
          line += ' ';
        }
      }
      line += '\x1b[0m ║';
      result.push(line);
    }
    result.push('╚════════════╝');
    result.push(`Chain: ${this.chainNumber}`);
    return result;
  }

  /**
   * Render the screen in the console.
   */
  log(): void {
    console.log(this.displayLines().join("\n"));
  }

  /**
   * Commit garbage to the top of the screen.
   */
  bufferGarbage(amount: i32): void {
    let y = 4;
    while (amount) {
      // Create (up to) one line of garbage.
      if (amount >= WIDTH) {
        merge(this.grid[GARBAGE], verticalLine(y));
        amount -= WIDTH;
        y--;
      } else if (amount) {
        const line = new Array<boolean>(WIDTH).fill(false);
        while (amount) {
          if (!this.garbageSlots.length) {
            this.garbageSlots = [0, 1, 2, 3, 4, 5];
            shuffle(this.garbageSlots);
          }
          line[this.garbageSlots.pop()] = true;
          amount--;
        }
        const puyos = fromArray(line);
        verticalShift(puyos, y);
        merge(this.grid[GARBAGE], puyos);
        y--;
      }
    }
  }

  /**
   * Resolve the screen of all spontaneous activity.
   * @returns The score accumulated.
   */
  tick(): TickResult {
    const result = new TickResult(0, 0, false, false, false);

    let active = true;
    while (active) {
      // Make everything fall down.
      active = resolveGravity(this.grid);

      // Make everything above the ghost line disappear.
      this.grid.forEach((puyos, _, __) => vanishTop(puyos));

      // Clear groups and give score accordingly.
      let numColors: i32 = 0;
      let didClear = false;
      let totalNumCleared: i32 = 0;
      let totalGroupBonus: i32 = 0;
      const totalCleared = emptyPuyos();

      for (let i = 0; i < NUM_PUYO_COLORS; ++i) {
        const clearResult = clearGroups(this.grid[i]);
        if (clearResult.numCleared) {
          totalNumCleared += clearResult.numCleared;
          totalGroupBonus += clearResult.groupBonus;
          merge(totalCleared, clearResult.cleared);
          numColors++;
          didClear = true;
        }
      }

      clearGarbage(this.grid[GARBAGE], totalCleared);

      const colorBonus = COLOR_BONUS[numColors];
      const chainPower = CHAIN_POWERS[this.chainNumber];
      const clearBonus = max(
        1,
        min(MAX_CLEAR_BONUS, chainPower + colorBonus + totalGroupBonus)
      );
      result.score += 10 * totalNumCleared * clearBonus;

      if (didClear) {
        result.didClear = true;
        active = true;
        this.chainNumber++;
        result.chainNumber = this.chainNumber;
      } else {
        this.chainNumber = 0;
      }
    }
    if (this.grid.every((puyos, _, __) => isEmpty(puyos))) {
      result.allClear = true;
    }

    return result;
  }

  /**
   * Insert a single puyo into the screen.
   * @param x Horizontal coordinate, 0-indexed, left to right.
   * @param y Vertical coordinate, 0-indexed, top to bottom.
   * @param color Color of the puyo to insert.
   * @returns `true` if the space was already occupied.
   */
  insertPuyo(x: i32, y: i32, color: i32): boolean {
    for (let i = 0; i < this.grid.length; ++i) {
      if (puyoAt(this.grid[i], x, y)) {
        return true;
      }
    }
    const puyo = singlePuyo(x, y);
    merge(this.grid[color], puyo);
    return false;
  }

  /**
   * Mask of all the occupied space in the grid.
   */
  get mask(): Puyos {
    const result = emptyPuyos();
    for (let i = 0; i < this.grid.length; ++i) {
      merge(result, this.grid[i]);
    }
    return result;
  }

  /**
   * Clone this screen as a SimplePuyoScreen.
   * @returns Copy of the screen with simplified mechanics.
   */
  toSimpleScreen(): SimplePuyoScreen {
    const result = new SimplePuyoScreen();
    result.grid = this.grid.map<Puyos>((puyos, _, __) => clone(puyos));
    result.chainNumber = this.chainNumber;
    result.garbageSlots = new Array<i32>(this.garbageSlots.length);
    for (let i = 0; i < this.garbageSlots.length; ++i) {
      result.garbageSlots[i] = this.garbageSlots[i];
    }
    return result;
  }
}