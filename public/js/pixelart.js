// classes.js のドット絵データを SVG 文字列に変換する

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * @param {object} cls classes.js の1クラス
 * @param {object} [opts]
 * @param {number} [opts.size] 表示サイズ(px)。省略時は CSS で指定
 * @param {boolean} [opts.decorative] true なら代替テキストを付けず aria-hidden にする
 */
export function spriteSvg(cls, opts = {}) {
  const { size, decorative = false } = opts;
  const gid = `bg-${cls.id}-${Math.random().toString(36).slice(2, 8)}`;
  const rects = [];
  cls.pixels.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${cls.palette[ch]}"/>`);
      }
      x = end;
    }
  });
  const [bg1, bg2] = cls.bg;
  const sizeAttr = size ? ` width="${size}" height="${size}"` : '';
  const a11y = decorative
    ? ' aria-hidden="true" focusable="false"'
    : ` role="img" aria-label="${escapeAttr(cls.alt)}"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 36 36"${sizeAttr}${a11y} class="sprite" shape-rendering="crispEdges">` +
    (decorative ? '' : `<title>${escapeAttr(cls.alt)}</title>`) +
    `<defs><radialGradient id="${gid}" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></radialGradient></defs>` +
    `<rect x="-2" y="-2" width="36" height="36" rx="5" fill="url(#${gid})" shape-rendering="geometricPrecision"/>` +
    rects.join('') +
    `</svg>`
  );
}
