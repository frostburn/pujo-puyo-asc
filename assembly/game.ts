import { GHOST_Y, WIDTH, puyoAt } from "./bitboard";
import { SimplePuyoScreen, TickResult } from "./screen";

const ONE_STONE = WIDTH * 5;

export class Move {
  x1: i32 = 0;
  y1: i32 = 1;
  x2: i32 = 0;
  y2: i32 = 0;
  orientation: i32 = 0;

  /*
  constructor(x1: i32, y1: i32, x2: i32, y2: i32, orientation: i32) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.orientation = orientation;
  }
  */
}

// All possible locations and orientations right below the garbage buffer line.
export const MOVES: Move[] = [
  // Orientation = 0
  {x1: 0, y1: 6, x2: 0, y2: 5, orientation: 0},
  {x1: 1, y1: 6, x2: 1, y2: 5, orientation: 0},
  {x1: 2, y1: 6, x2: 2, y2: 5, orientation: 0},
  {x1: 3, y1: 6, x2: 3, y2: 5, orientation: 0},
  {x1: 4, y1: 6, x2: 4, y2: 5, orientation: 0},
  {x1: 5, y1: 6, x2: 5, y2: 5, orientation: 0},
  // Orientation = 1
  {x1: 1, y1: 5, x2: 0, y2: 5, orientation: 1},
  {x1: 2, y1: 5, x2: 1, y2: 5, orientation: 1},
  {x1: 3, y1: 5, x2: 2, y2: 5, orientation: 1},
  {x1: 4, y1: 5, x2: 3, y2: 5, orientation: 1},
  {x1: 5, y1: 5, x2: 4, y2: 5, orientation: 1},
  // Orientation = 2
  {x1: 0, y1: 5, x2: 0, y2: 6, orientation: 2},
  {x1: 1, y1: 5, x2: 1, y2: 6, orientation: 2},
  {x1: 2, y1: 5, x2: 2, y2: 6, orientation: 2},
  {x1: 3, y1: 5, x2: 3, y2: 6, orientation: 2},
  {x1: 4, y1: 5, x2: 4, y2: 6, orientation: 2},
  {x1: 5, y1: 5, x2: 5, y2: 6, orientation: 2},
  // Orientation = 3
  {x1: 0, y1: 5, x2: 1, y2: 5, orientation: 3},
  {x1: 1, y1: 5, x2: 2, y2: 5, orientation: 3},
  {x1: 2, y1: 5, x2: 3, y2: 5, orientation: 3},
  {x1: 3, y1: 5, x2: 4, y2: 5, orientation: 3},
  {x1: 4, y1: 5, x2: 5, y2: 5, orientation: 3},
];

// How long a single move takes compared to one link in a chain.
// TODO: Tweak timings and where bots insert puyos.
const MOVE_TIME = 3.9;

// Value all-clears based on the amount of garbage they send.
const SIMPLE_ALL_CLEAR_BONUS = 2100;
// Not even a 19-chain can compensate a Game Over.
const SIMPLE_GAME_OVER = -1000000;

/**
 * Simplified view of one player in a multiplayer game suitable for naïve AI planning.
 */
export class SimpleGame {
  screen: SimplePuyoScreen;
  // Garbage to be received as soon as possible, one stone at a time.
  pendingGarbage: i32;
  // Garbage to be received later.
  lateGarbage: i32;
  lateTimeRemaining: f64;

  colorSelection: i32[];
  // The next four or six puyos to be played.
  bag: i32[];

  constructor(
    screen: SimplePuyoScreen,
    pendingGarbage: i32,
    lateGarbage: i32,
    lateTimeRemaining: f64,
    colorSelection: i32[],
    bag: i32[]
  ) {
    this.screen = screen;
    this.pendingGarbage = pendingGarbage;
    this.lateGarbage = lateGarbage;
    this.lateTimeRemaining = lateTimeRemaining;
    this.colorSelection = colorSelection;
    this.bag = bag;

    this.resolve();
  }

  get availableMoves(): Array<i32> {
    const mask = this.screen.mask;
    const result = new Array<i32>();
    const symmetric = this.bag.length >= 2 && this.bag[0] === this.bag[1];
    for (let i = 0; i < MOVES.length; ++i) {
      if (symmetric && i >= 11) {
        break;
      }
      if (!puyoAt(mask, MOVES[i].x1, GHOST_Y) || !puyoAt(mask, MOVES[i].x2, GHOST_Y)) {
        result.push(i);
      }
    }
    return result;
  }

  playAndTick(move: i32): TickResult {
    const color1 = this.bag.shift();
    const color2 = this.bag.shift();
    const moveInfo = MOVES[move];
    this.screen.insertPuyo(moveInfo.x1, moveInfo.y1, color1);
    this.screen.insertPuyo(moveInfo.x2, moveInfo.y2, color2);
    const releasedGarbage = min(ONE_STONE, this.pendingGarbage);
    this.pendingGarbage -= releasedGarbage;
    this.screen.bufferGarbage(releasedGarbage);
    const tickResult = this.resolve();
    return tickResult;
  }

  resolve(): TickResult {
    const tickResult = this.screen.tick();
    this.lateTimeRemaining -= tickResult.chainNumber + MOVE_TIME;
    if (this.lateTimeRemaining <= 0) {
      this.pendingGarbage += this.lateGarbage;
      this.lateGarbage = 0;
    }
    if (tickResult.allClear) {
      tickResult.score += SIMPLE_ALL_CLEAR_BONUS;
    }
    if (!this.availableMoves.length) {
      tickResult.score += SIMPLE_GAME_OVER;
    }
    return tickResult;
  }

  clone(): SimpleGame {
    const bagClone = new Array<i32>(this.bag.length);
    for (let i = 0; i < this.bag.length; ++i) {
      bagClone[i] = this.bag[i];
    }
    return new SimpleGame(
      this.screen.toSimpleScreen(),
      this.pendingGarbage,
      this.lateGarbage,
      this.lateTimeRemaining,
      this.colorSelection,
      bagClone
    );
  }
}
