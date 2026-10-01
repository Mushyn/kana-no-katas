// Menu : réglage des colonnes connues (commun à tous les jeux, mémorisé par shared.js)
(function () {
  const $ = id => document.getElementById(id);
  const COLS_OK = COLS.filter(c => c.label !== 'SEP' && c.label !== 'SEP2');
  const BASE = COLS_OK.filter(c => !c.diacritic), DAK = COLS_OK.filter(c => c.diacritic);
  let picked = new Set(KanaStore.columns());

  function save() { KanaStore.setColumns([...picked]); render(); }

  function chip(col) {
    const key = KanaStore.colKey(col);
    const b = document.createElement('button');
    b.className = 'mn-chip' + (picked.has(key) ? ' on' : '');
    b.setAttribute('aria-pressed', picked.has(key) ? 'true' : 'false');
    b.innerHTML = H[key] + '<small>' + key + '</small>';
    b.onclick = () => { if (picked.has(key)) picked.delete(key); else picked.add(key); save(); };
    return b;
  }

  function render() {
    const base = $('mn-cols-base'), dak = $('mn-cols-dak');
    base.innerHTML = ''; dak.innerHTML = '';
    BASE.forEach(c => base.appendChild(chip(c)));
    DAK.forEach(c => dak.appendChild(chip(c)));
    const n = COLS_OK.filter(c => picked.has(KanaStore.colKey(c))).length;
    $('mn-cols-count').textContent = n + ' / ' + COLS_OK.length;
  }

  $('mn-cols-toggle').onclick = () => {
    const panel = $('mn-cols-panel'), open = panel.hidden;
    panel.hidden = !open;
    $('mn-cols-toggle').setAttribute('aria-expanded', String(open));
  };
  $('mn-all').onclick = () => { picked = new Set(COLS_OK.map(KanaStore.colKey)); save(); };
  $('mn-base').onclick = () => { picked = new Set(BASE.map(KanaStore.colKey)); save(); };
  $('mn-none').onclick = () => { picked = new Set(); save(); };

  render();
})();
