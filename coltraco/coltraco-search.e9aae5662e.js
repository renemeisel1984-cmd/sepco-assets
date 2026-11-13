/* ============================================================
   SEPCOTECH × COLTRACO  -  PRODUCT SEARCH
   ------------------------------------------------------------
   Lightweight, dependency-free instrument finder. Wires up the
   .tr-search-* styles already defined in coltraco.css (no new CSS).

   - A search button is injected into the category bar on every page.
   - Open with the button, with "/", or with Ctrl/Cmd-K.
   - Filters a static index (the §1 catalog) over name + category +
     IMPA code + common aliases (CO2, FM-200, watertight, ATEX…).
   - Arrow keys move the selection, Enter opens it, Esc closes.

   The index is static so the same file works on every page and
   needs no build step. Keep entries in sync with the catalog.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- static index (mirrors the §1 product catalog) ---------- */
  var INDEX = [
    { name: 'Portalevel® MAX Marine Plus', cat: 'Liquid level indicators', impa: '652776', url: '/tools/coltraco/level-indicators',
      kw: 'co2 fm-200 fm200 novec 1230 fire cylinder agent liquid level fire suppression fixed gas charge fss code solas non-invasive ultrasonic' },
    { name: 'Portalevel® IS (ATEX)', cat: 'Liquid level indicators', impa: '', url: '/tools/coltraco/level-indicators',
      kw: 'atex intrinsically safe tanker gas carrier hazardous zone explosive liquid level fire cylinder co2' },
    { name: 'Portasteele® calculator', cat: 'Liquid level indicators', impa: '', url: '/tools/coltraco/level-indicators',
      kw: 'agent weight calculator kg converter liquid level portalevel charge tablet' },
    { name: 'Portascanner® WATERTIGHT PLUS', cat: 'Hatch cover & watertight testing', impa: '652778', url: '/tools/coltraco/hatch-cover-testing',
      kw: 'watertight weathertight hatch cover integrity seal door cable transit solas leak aperture ultrasonic test' },
    { name: 'Portascanner® WATERTIGHT PRO', cat: 'Hatch cover & watertight testing', impa: '652778', url: '/tools/coltraco/hatch-cover-testing',
      kw: 'watertight weathertight hatch cover integrity multiple leaks mapping rate seal door ultrasonic' },
    { name: 'Portagauge® 6 ultrasonic thickness gauge', cat: 'Ultrasonic thickness gauges', impa: '', url: '/tools/coltraco/thickness-gauges',
      kw: 'thickness corrosion hull plate bulkhead multi-echo multiecho wastage coating paint steel survey gauge' },
    { name: 'Portasonic® PLUS flow meter', cat: 'Ultrasonic flow meters', impa: '', url: '/tools/coltraco/flow-meters',
      kw: 'flow clamp-on clampon transit-time pipe portable liquid flow rate meter' },
    { name: 'Portasonic® PRO flow meter', cat: 'Ultrasonic flow meters', impa: '', url: '/tools/coltraco/flow-meters',
      kw: 'flow clamp-on clampon transit-time pipe flow rate meter advanced' },
    { name: 'Permaflow® fixed flow & heat meter', cat: 'Ultrasonic flow meters', impa: '', url: '/tools/coltraco/flow-meters',
      kw: 'flow heat meter fixed permanent clamp-on energy monitoring pipe' },
    { name: 'Portasonic® CALCULATOR', cat: 'Ultrasonic flow meters', impa: '', url: '/tools/coltraco/flow-meters',
      kw: 'pipe pressure tablet calculator flow rate conversion portasonic 2618949-calc' },
    { name: 'Portagas® gas pressure monitor', cat: 'Non-invasive pressure indicators', impa: '', url: '/tools/coltraco/gas-pressure',
      kw: 'gas pressure inert gas non-invasive novec fm-200 fm200 compressed nitrogen fire system pressure monitor'},
    { name: 'Coltraco kit by vessel type', cat: 'Coltraco', impa: '', url: '/tools/coltraco/commercial-shipping',
      kw: 'bulk carrier tanker gas carrier container ship vessel type kit esp code hatch cover co2 ship type' }
  ];

  var SVG_MAG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>';

  var overlay, input, results, btn;
  var sel = -1, view = [];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- matching ---------- */
  function search(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return INDEX.slice();
    var terms = q.split(/\s+/);
    return INDEX.filter(function (e) {
      var hay = (e.name + ' ' + e.cat + ' ' + e.impa + ' ' + e.kw).toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    }).sort(function (a, b) {
      var an = a.name.toLowerCase().indexOf(q), bn = b.name.toLowerCase().indexOf(q);
      var aHit = an === -1 ? 999 : an, bHit = bn === -1 ? 999 : bn;
      return aHit - bHit;
    });
  }

  /* ---------- render ---------- */
  function render() {
    view = search(input.value);
    if (!view.length) {
      results.innerHTML = '<div class="tr-search-empty">No instruments match “' + esc(input.value) + '”.<br>Try “watertight”, “thickness”, “flow”, or an IMPA code.</div>';
      sel = -1;
      return;
    }
    results.innerHTML = view.map(function (e, i) {
      return '<a class="tr-search-result' + (i === sel ? ' sel' : '') + '" href="' + e.url + '" data-i="' + i + '">' +
        '<div class="tr-search-result-main">' +
          '<div class="tr-search-result-name">' + e.name + '</div>' +
          '<div class="tr-search-result-meta">' + esc(e.cat) + '</div>' +
        '</div>' +
        (e.impa ? '<span class="tr-search-result-impa">IMPA ' + e.impa + '</span>' : '') +
        '</a>';
    }).join('');
  }

  function move(d) {
    if (!view.length) return;
    sel = (sel + d + view.length) % view.length;
    render();
    var el = results.querySelector('.tr-search-result.sel');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function go() {
    if (sel >= 0 && view[sel]) window.location.href = view[sel].url;
    else if (view.length) window.location.href = view[0].url;
  }

  /* ---------- open / close ---------- */
  function open() {
    overlay.classList.add('open');
    input.value = '';
    sel = -1;
    render();
    setTimeout(function () { input.focus(); }, 30);
  }
  function close() { overlay.classList.remove('open'); }
  function isOpen() { return overlay.classList.contains('open'); }

  /* ---------- build ---------- */
  function build() {
    /* trigger button - sits in the dark nav bar, always visible */
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tr-search-btn';
    btn.setAttribute('aria-label', 'Search instruments');
    btn.innerHTML = '<span class="tr-search-ico">' + SVG_MAG + '</span>' +
      '<span class="tr-search-label">Search</span>' +
      '<span class="tr-search-hint">/</span>';
    btn.addEventListener('click', open);

    var inner = document.querySelector('.sd-side-in');
    var cats = document.querySelector('.tr-nav-cats');
    if (inner && cats) inner.insertBefore(btn, cats.nextSibling); /* right after the category bar */
    else if (inner) inner.appendChild(btn);
    else return; /* no nav on this page - nothing to attach to */

    /* overlay + panel */
    overlay = document.createElement('div');
    overlay.className = 'tr-search-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Search instruments');
    overlay.innerHTML =
      '<div class="tr-search-panel">' +
        '<div class="tr-search-inputwrap">' +
          '<span class="tr-search-ico">' + SVG_MAG + '</span>' +
          '<input class="tr-search-input" type="text" autocomplete="off" spellcheck="false" placeholder="Search instruments, IMPA codes or applications…" aria-label="Search instruments">' +
          '<button class="tr-search-esc" type="button" aria-label="Close search">Esc</button>' +
        '</div>' +
        '<div class="tr-search-results"></div>' +
        '<div class="tr-search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>' +
      '</div>';
    document.body.appendChild(overlay);

    input = overlay.querySelector('.tr-search-input');
    results = overlay.querySelector('.tr-search-results');

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.tr-search-esc').addEventListener('click', close);
    input.addEventListener('input', function () { sel = -1; render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    /* global shortcuts: "/" and Ctrl/Cmd-K */
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); isOpen() ? close() : open(); return; }
      if (e.key === 'Escape' && isOpen()) { close(); return; }
      if (e.key === '/' && !isOpen()) {
        var t = e.target, tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
        e.preventDefault(); open();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
