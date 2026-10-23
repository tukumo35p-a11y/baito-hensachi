// クラス図鑑：全クラスを一覧し、自分のクラスを強調する

import { CLASSES } from './classes.js';
import { classRangeLabel, evaluateScope } from './calc.js';
import { spriteSvg } from './pixelart.js';
import { loadLast, loadWeights, $, esc } from './common.js';

function myClassId() {
  const fromUrl = new URLSearchParams(location.search).get('me');
  if (CLASSES.some((c) => c.id === fromUrl)) return fromUrl;
  // URL に無ければ、このタブでの直近の診断から計算する
  const last = loadLast();
  if (!last?.input || !last?.stats) return null;
  const r = evaluateScope(last.input, last.stats.national, loadWeights());
  return r.klass?.cls.id ?? null;
}

const me = myClassId();

$('#dex').innerHTML = CLASSES.map((c, i) => {
  const isMe = c.id === me;
  return `<li class="dex-item${isMe ? ' me' : ''}"${isMe ? ' aria-current="true"' : ''}>
    ${isMe ? '<span class="dex-me-badge">あなた</span>' : ''}
    ${spriteSvg(c)}
    <div>
      <div class="dex-range">偏差値 ${esc(classRangeLabel(CLASSES, i))}</div>
      <h2>${esc(c.name)}</h2>
      <p>${esc(c.comment)}</p>
    </div>
  </li>`;
}).join('');

if (me) {
  const cls = CLASSES.find((c) => c.id === me);
  const note = $('#me-note');
  note.textContent = `あなたのクラスは「${cls.name}」です。`;
  note.classList.remove('hidden');
}
