"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { escapeRegex, buildContainsRegex } = require("../src/utils/regex.utils");

test("escapeRegex escapes regex metacharacters safely", () => {
  const input = "a+b?(test)[x]{2}|^$\\.";
  const escaped = escapeRegex(input);
  const re = new RegExp(escaped);

  assert.equal(re.test(input), true);
  assert.equal(re.test("different"), false);
});

test("buildContainsRegex returns null for empty input", () => {
  assert.equal(buildContainsRegex("   "), null);
  assert.equal(buildContainsRegex(""), null);
});

test("buildContainsRegex builds case-insensitive contains regex", () => {
  const re = buildContainsRegex("c-001");

  assert.ok(re instanceof RegExp);
  assert.equal(re.test("User C-001 matched"), true);
  assert.equal(re.test("No match"), false);
});
