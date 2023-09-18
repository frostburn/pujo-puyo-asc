// The entry file of your WebAssembly module.

import { maxDropletStrategy1, maxDropletStrategy2 } from "./ai";
import { emptyPuyos, flood, logPuyos, puyoAt, puyoCount, resolveGravity } from "./bitboard";
import { SimpleGame } from "./game";
import { PURPLE, SimplePuyoScreen, YELLOW } from "./screen";

export function add(a: i32, b: i32): i32 {
  return a + b;
}

export function hello(): void {
  console.log("Greetings!");
  const puyos = emptyPuyos();
  puyos[0] = 1233456;
  puyos[1] = 12398789;
  logPuyos(puyos);

  const source = emptyPuyos();
  source[1] = 1;
  flood(source, puyos);
  logPuyos(source);

  resolveGravity([puyos]);
  logPuyos(puyos);

  console.log(puyoCount(puyos).toString());

  const screen = SimplePuyoScreen.fromLines([
    "RGB"
  ]);
  screen.log();
  screen.tick();
  screen.log();

  const game = new SimpleGame(screen, 10, 6, 4.1, [0, 1, 2, 3], [0, 1, 2, 3, 0, 1]);

  console.log(game.bag.toString());
  game.playAndTick(0);
  console.log(game.bag.toString());
  game.playAndTick(0);
  console.log(game.bag.toString());
  game.playAndTick(0);
  console.log(game.bag.toString());

  game.screen.log();

  console.log("Max droplet 2");

  game.screen = new SimplePuyoScreen();
  game.pendingGarbage = 0;
  game.lateGarbage = 0;
  game.bag = [0, 1, 2, 3, 0, 1];
  const start = Date.now();
  const numMoves = 50;
  for (let i = 0; i < numMoves; ++i) {
    const strategy = maxDropletStrategy2(game);
    game.playAndTick(strategy.move);
    game.bag.push(game.colorSelection[<i32>(Math.random() * game.colorSelection.length)]);
    game.bag.push(game.colorSelection[<i32>(Math.random() * game.colorSelection.length)]);
    game.screen.log();
    console.log(strategy.score.toString());
  }
  const end = Date.now();
  console.log(`Playing ${numMoves} moves took ${end - start} ms`);
}

export function testSimpleScreen(): void {
  console.log('Simple screen chain resolution');
  const lines = [
    '  RR P',
    ' YYGRR',
    'BGYGGR',
    'GRRBBG',
    'GGRYRB',
    'BRGYRB',
    'BBRGYR',
    'RRGGYR',
  ];
  const screen = SimplePuyoScreen.fromLines(lines);
  const zero = screen.tick().score;
  assert(zero === 0);
  
  screen.insertPuyo(0, 0, YELLOW);
  const score = screen.tick().score;
  assert(score ===
    40 * (1 + 8 + 16 + 32 + 64 + 96 + 128 + 160 + 192 + 224 + 256)
  );
  assert(puyoAt(screen.grid[PURPLE], 5, 19));
}
