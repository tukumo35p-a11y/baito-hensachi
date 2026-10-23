import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../public/js/classes.js';
import { spriteSvg } from '../public/js/pixelart.js';

test('9クラスあり、上位から順に min が下がる', () => {
  assert.equal(CLASSES.length, 9);
  const mins = CLASSES.map((c) => c.min);
  assert.equal(mins.at(-1), null);
  for (let i = 1; i < mins.length - 1; i++) assert.ok(mins[i] < mins[i - 1]);
  assert.deepEqual(mins.slice(0, -1), [70, 65, 60, 55, 50, 45, 40, 35]);
});

test('名前・ひとこと・代替テキスト・id がそろっている', () => {
  const ids = new Set();
  for (const c of CLASSES) {
    assert.ok(c.name && c.comment && c.alt, c.id);
    assert.ok(!ids.has(c.id), `id 重複: ${c.id}`);
    ids.add(c.id);
  }
});

test('ドット絵は 32x32 で、使っている色はすべてパレットにある', () => {
  for (const c of CLASSES) {
    assert.equal(c.pixels.length, 32, c.id);
    for (const row of c.pixels) {
      assert.equal(row.length, 32, c.id);
      for (const ch of row) {
        if (ch !== '.') assert.ok(c.palette[ch], `${c.id}: 色 ${ch} がパレットにない`);
      }
    }
  }
});

test('SVG に代替テキストが入る', () => {
  const svg = spriteSvg(CLASSES[0]);
  assert.match(svg, /^<svg /);
  assert.match(svg, /role="img"/);
  assert.ok(svg.includes(`aria-label="${CLASSES[0].alt}"`));
  assert.match(spriteSvg(CLASSES[0], { decorative: true }), /aria-hidden="true"/);
});
