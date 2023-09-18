// The entry file of your WebAssembly module.

import { emptyPuyos, flood, logPuyos, puyoAt, puyoCount, resolveGravity } from "./bitboard";
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
