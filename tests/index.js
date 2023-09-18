import assert from "assert";
import { add, testSimpleScreen } from "../build/debug.js";
assert.strictEqual(add(1, 2), 3);
console.log("add ok");

testSimpleScreen();
console.log("all tests pass");
