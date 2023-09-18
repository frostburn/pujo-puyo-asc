import {WIDTH, puyoCount} from './bitboard';
import {SimpleGame} from './game';
import { shuffle } from './util';

const HEURISTIC_FAIL:f64 = -2000000;
const PREFER_LONGER:f64 = 1.1;

export class StrategyResult {
  move: i32 = 0;
  score: f64 = 0;
};

/**
 * Heuristic score to discourage wasting of material.
 * @param game Game state to evaluate.
 * @returns The amount of material in the playing grid.
 */
function materialCount(game: SimpleGame): f64 {
  return puyoCount(game.screen.mask);
}

/**
 * Heuristic score from dropping a single puyo onto the playing field.
 * @param game Game state to evaluate.
 * @returns The highest score achievable by dropping a single puyo.
 */
function maxDroplet(game: SimpleGame): f64 {
  let maximum = HEURISTIC_FAIL;
  for (let i = 0; i < game.colorSelection.length; ++i) {
    for (let x = 0; x < WIDTH; ++x) {
      const clone = game.clone();
      clone.screen.insertPuyo(x, 1, game.colorSelection[i]);
      maximum = max(maximum, clone.resolve().score);
    }
  }
  return maximum;
}

export function maxDropletStrategy1(game: SimpleGame): StrategyResult {
  const moves = game.availableMoves;
  // Shuffle to break ties.
  shuffle(moves);

  let maximum: f64 = HEURISTIC_FAIL;
  let move: i32 = moves.length ? moves[0] : 0;
  for (let i = 0; i < moves.length; ++i) {
    const clone = game.clone();
    const tickResult = clone.playAndTick(moves[i]);
    const score = tickResult.score + PREFER_LONGER * maxDroplet(clone) + materialCount(clone);
    if (score > maximum) {
      maximum = score;
      move = moves[i];
    }
  }
  return {
    move,
    score: maximum,
  };
}

export function maxDropletStrategy2(game: SimpleGame): StrategyResult {
  const moves = game.availableMoves;
  // Shuffle to break ties.
  shuffle(moves);

  let maximum: f64 = HEURISTIC_FAIL;
  let move: i32 = moves.length ? moves[0] : 0;
  for (let i = 0; i < moves.length; ++i) {
    const clone = game.clone();
    const tickResult = clone.playAndTick(moves[i]);
    const score = tickResult.score + PREFER_LONGER * maxDropletStrategy1(clone).score;
    if (score > maximum) {
      maximum = score;
      move = moves[i];
    }
  }
  return {
    move,
    score: maximum,
  };
}
