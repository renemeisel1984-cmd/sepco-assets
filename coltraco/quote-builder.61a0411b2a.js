/* Storage guard (30 Oct 2026). Edge Tracking Prevention, private modes and file:// can make localStorage / sessionStorage throw or silently drop writes.
   Then this page gets an in-memory store under the same names, so the quote list, the quick-quote dialog and the tool finder (which all read the
   cart through localStorage) still share the basket for the life of the page; only persistence across reloads is lost. Normal browsers: no change. */
(function () {
  function memStore() {
    var d = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[k] = String(v); },
      removeItem: function (k) { delete d[k]; },
      clear: function () { d = {}; },
      key: function (i) { return Object.keys(d)[i] || null; },
      get length() { return Object.keys(d).length; }
    };
  }
  ['localStorage', 'sessionStorage'].forEach(function (name) {
    var works = false;
    try { var s = window[name]; s.setItem('__tr_probe', '1'); works = s.getItem('__tr_probe') === '1'; s.removeItem('__tr_probe'); } catch (e) { works = false; }
    if (works) { return; }
    var m = memStore();
    try { Object.defineProperty(window, name, { value: m, configurable: true, writable: false }); }
    catch (e2) { window.TR_MEM_STORAGE = window.TR_MEM_STORAGE || {}; window.TR_MEM_STORAGE[name] = m; }
  });
})();
/* ============================================================
   SEPCOTECH × COLTRACO  -  QUOTE BUILDER ENGINE (external, 12 Nov 2026 pilot)
   ------------------------------------------------------------
   Cross-page cart that lets a customer add tools + consumables
   across any category page and submit them as ONE quote request.

   HOW TO TRIGGER AN ADD (no inline JS needed):
   Add the class "tr-add" (or "tr-add-mini" for consumables) to a
   button and supply data attributes:

     <button class="tr-add"
             data-id="VL203"
             data-name="VL203 Low-Vibration Needle Scaler"
             data-type="tool"
             data-cat="Needle Scalers"
             data-impa="">Add to Quote</button>

   data-type = "tool" | "consumable"   (controls the icon only)
   data-cat  = category label shown in the quote (optional)
   data-impa = IMPA code if known (optional, included in the email)

   The cart persists in localStorage under one key, so items added
   on the Needle Scalers page are still there on the Dust Control
   page and in the final quote form.
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'sepcotech_coltraco_quote_v1';
  var mem = null;     /* last list, used only when the storage object itself throws */

  /* contact fallback shown if a submit fails (G3) */
  var CONTACT_EMAIL = 'tech@sepcotech.com';   /* email only: no phone numbers on the site */

  /* ---------- inline SVG icon set (replaces emoji UI chrome, G4) ---------- */
  var ICONS = {
    /* toolbox - quote list / FAB */
    box: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm-10-2h4v2h-4V5Zm10 14H4v-5h3v2h2v-2h6v2h2v-2h3v5Zm0-7h-4v-2H8v2H4V9h16v3Z"/></svg>',
    /* wrench - tool line item */
    tool: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.7 19.6 13.4 10.3a5.5 5.5 0 0 0-7.1-7L9.8 6.8 6.8 9.8 3.3 6.3a5.5 5.5 0 0 0 7 7.1l9.3 9.3a1 1 0 0 0 1.4 0l1.7-1.7a1 1 0 0 0 0-1.4Z"/></svg>',
    /* hex nut - consumable line item */
    nut: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 1.6 9.1 5.2v10.4L12 22.4l-9.1-5.2V6.8L12 1.6Zm0 6.4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>'
  };
  function ico(name, px) {
    return ICONS[name].replace('<svg ', '<svg class="qb-ico" width="' + px + '" height="' + px + '" ');
  }

  /* ---------- storage ---------- */
  function store() { return (window.TR_MEM_STORAGE && window.TR_MEM_STORAGE.localStorage) || window.localStorage; }
  function load() {
    try { return JSON.parse(store().getItem(KEY)) || []; }
    catch (e) { return mem || []; }
  }
  function save(items) {
    try { store().setItem(KEY, JSON.stringify(items)); mem = null; } catch (e) { mem = items; }
    render();
  }

  /* ---------- mutations ---------- */
  function add(item) {
    var items = load();
    var ex = items.filter(function (i) { return i.id === item.id; })[0];
    if (ex) { ex.qty += 1; }
    else { items.push({ id: item.id, pn: item.pn || '', name: item.name, type: item.type || 'tool', cat: item.cat || '', impa: item.impa || '', qty: 1 }); }
    save(items);
    toast(item.name + ' added to your quote');
  }
  function remove(id) {
    save(load().filter(function (i) { return i.id !== id; }));
  }
  function setQty(id, delta) {
    var items = load();
    items.forEach(function (i) { if (i.id === id) { i.qty = Math.max(1, i.qty + delta); } });
    save(items);
  }
  function clear() { save([]); }

  /* ---------- DOM refs (built on init) ---------- */
  var fab, drawer, overlay, body, foot, formItemsBox, hiddenField, toastEl, navBadge;

  function totalCount() {
    return load().reduce(function (s, i) { return s + i.qty; }, 0);
  }

  /* ---------- rendering ---------- */
  function render() {
    var items = load();
    var count = totalCount();

    /* FAB badge */
    if (fab) {
      fab.classList.toggle('empty', count === 0);
      var c = fab.querySelector('.qb-fab-count');
      if (c) c.textContent = count;
    }

    /* Rail "Request a Quote" badge (synced count) */
    if (navBadge) {
      navBadge.textContent = count;
      navBadge.classList.toggle('empty', count === 0);
    }

    /* Drawer list */
    if (body) {
      if (!items.length) {
        body.innerHTML =
          '<div class="qb-empty"><div class="qb-empty-icon">' + ico('box', 46) + '</div>' +
          '<p>Your quote list is empty.<br>Browse the tool ranges and press <strong>"Add to quote"</strong> on any tool or consumable.</p></div>';
      } else {
        body.innerHTML = items.map(function (i) {
          var icon = i.type === 'consumable' ? ico('nut', 22) : ico('tool', 22);
          var meta = [i.cat, i.impa ? 'IMPA ' + i.impa : ''].filter(Boolean).join(' · ');
          return '<div class="qb-item">' +
            '<div class="qb-item-icon ' + (i.type === 'consumable' ? 'consumable' : '') + '">' + icon + '</div>' +
            '<div class="qb-item-info"><b>' + esc(i.name) + '</b>' +
            (meta ? '<div class="qb-item-meta">' + esc(meta) + '</div>' : '') +
            '<div class="qb-qty">' +
            '<button data-dec="' + esc(i.id) + '" aria-label="Decrease">−</button>' +
            '<span>' + i.qty + '</span>' +
            '<button data-inc="' + esc(i.id) + '" aria-label="Increase">+</button>' +
            '</div>' +
            '<button class="qb-item-remove" data-rm="' + esc(i.id) + '">Remove</button>' +
            '</div></div>';
        }).join('');
      }
    }

    /* Drawer footer summary */
    if (foot) {
      foot.querySelector('.qb-line-count').textContent = items.length + (items.length === 1 ? ' line' : ' lines');
      foot.querySelector('.qb-unit-count').textContent = count + (count === 1 ? ' item' : ' items');
    }

    /* Quote form item preview (only present on pages with the form) */
    if (formItemsBox) {
      if (!items.length) {
        formItemsBox.innerHTML = '<div class="qb-form-empty">No items added yet - add instruments from any range above, or just tell us the vessel and what you need to test in the box below ↓</div>';
      } else {
        formItemsBox.innerHTML =
          '<div class="qb-form-items-head"><span>Selected items</span><span>' + count + ' total</span></div>' +
          items.map(function (i) {
            return '<div class="qb-form-item">' +
              '<span class="qb-fi-name"><strong>' + esc(i.name) + '</strong>' +
              (i.cat ? ' <span style="color:#83838d">- ' + esc(i.cat) + '</span>' : '') + '</span>' +
              '<span class="qb-fi-ctrl">' +
                '<span class="qb-fi-qty">' +
                  '<button type="button" data-dec="' + esc(i.id) + '" aria-label="Decrease quantity">−</button>' +
                  '<span>' + i.qty + '</span>' +
                  '<button type="button" data-inc="' + esc(i.id) + '" aria-label="Increase quantity">+</button>' +
                '</span>' +
                '<button type="button" class="qb-fi-rm" data-rm="' + esc(i.id) + '" aria-label="Remove ' + esc(i.name) + '">×</button>' +
              '</span></div>';
          }).join('');
      }
    }

    /* Hidden Web3Forms field - structured plain-text list */
    if (hiddenField) hiddenField.value = buildList(items);
  }

  /* E-mail / hidden-field line only (the visitor's quote list is unchanged): the Coltraco part number travels with every line.
     pn = data-pn, else data-id; only a real part number counts (7 digits, a dash, a suffix), internal ids such as PORTAGAUGE-6 never do.
     Not added when the name already has "(PN " or already shows the number. Same behaviour as the Trelawny engine. */
  function mailName(i) {
    var p = String(i.pn || i.id || '');
    if (!/^\d{7}-[0-9A-Za-z][0-9A-Za-z\-]*$/.test(p)) return i.name;
    if (i.name.indexOf('(PN ') !== -1 || i.name.indexOf(p) !== -1) return i.name;
    return i.name + ' (PN ' + p + ')';
  }

  function buildList(items) {
    if (!items.length) return 'No items selected.';
    var lines = items.map(function (i, n) {
      return (n + 1) + '. ' + mailName(i) +
        (i.cat ? '  [' + i.cat + ']' : '') +
        (i.impa ? '  (IMPA ' + i.impa + ')' : '') +
        '  - Qty: ' + i.qty;
    });
    return 'REQUESTED ITEMS (' + totalCount() + ' total):\n' + lines.join('\n');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- drawer open/close ---------- */
  function openDrawer() { if (drawer) { drawer.classList.add('open'); overlay.classList.add('open'); } }
  function closeDrawer() { if (drawer) { drawer.classList.remove('open'); overlay.classList.remove('open'); } }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = '✓ ' + msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }

  /* ---------- build the floating UI once ---------- */
  function buildUI() {
    /* FAB */
    fab = document.createElement('button');
    fab.className = 'qb-fab empty';
    fab.setAttribute('aria-label', 'Open quote list');
    fab.innerHTML = ico('box', 20) + ' <span>My quote</span> <span class="qb-fab-count">0</span>';
    fab.addEventListener('click', openDrawer);

    /* Overlay */
    overlay = document.createElement('div');
    overlay.className = 'qb-overlay';
    overlay.addEventListener('click', closeDrawer);

    /* Drawer */
    drawer = document.createElement('aside');
    drawer.className = 'qb-drawer';
    drawer.setAttribute('aria-label', 'Quote list');
    drawer.innerHTML =
      '<div class="qb-drawer-head" style="justify-content:space-between"><h3>' + ico('box', 20) + ' Your quote list</h3>' +
      '<button class="qb-close" aria-label="Close">×</button></div>' +
      '<div class="qb-drawer-body"></div>' +
      '<div class="qb-drawer-foot">' +
      '<div class="qb-summary"><span class="qb-line-count">0 lines</span><span class="qb-unit-count">0 items</span></div>' +
      '<a href="#quote" class="btn btn-primary btn-block qb-go">Request quote for these items →</a>' +
      '<button class="qb-clear">Clear list</button>' +
      '</div>';

    /* Toast */
    toastEl = document.createElement('div');
    toastEl.className = 'qb-toast';

    var cta = document.querySelector('.sd-side .nav-cta');
    if (cta) {
      navBadge = document.createElement('span');
      navBadge.className = 'qb-nav-badge empty';
      navBadge.setAttribute('aria-hidden', 'true');
      cta.appendChild(navBadge);
    }

    document.body.appendChild(fab);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.body.appendChild(toastEl);

    body = drawer.querySelector('.qb-drawer-body');
    foot = drawer.querySelector('.qb-drawer-foot');

    drawer.querySelector('.qb-close').addEventListener('click', closeDrawer);
    drawer.querySelector('.qb-clear').addEventListener('click', function () {
      if (confirm('Remove all items from your quote list?')) clear();
    });
    drawer.querySelector('.qb-go').addEventListener('click', function (e) {
      var target = document.getElementById('quote');
      closeDrawer();
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
      /* pages without an on-page form (e.g. the guide) - send to the homepage
         quote form; the cart persists in localStorage so it follows the user (GU1) */
      else { e.preventDefault(); window.location.href = 'index.html#quote'; }
    });

    /* delegated qty / remove inside drawer */
    body.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.inc) setQty(t.dataset.inc, +1);
      else if (t.dataset.dec) setQty(t.dataset.dec, -1);
      else if (t.dataset.rm) remove(t.dataset.rm);
    });
  }

  /* ---------- delegated "Add to Quote" buttons ---------- */
  function bindAddButtons() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.tr-add, .tr-add-mini');
      if (!btn) return;
      e.preventDefault();
      add({
        id: btn.dataset.id,
        pn: btn.dataset.pn || '',
        name: btn.dataset.name,
        type: btn.dataset.type || 'tool',
        cat: btn.dataset.cat || '',
        impa: btn.dataset.impa || ''
      });
      /* brief visual confirm on the button itself */
      var original = btn.textContent;
      btn.classList.add('added');
      btn.textContent = '✓ Added';
      setTimeout(function () { btn.classList.remove('added'); btn.textContent = original; }, 1400);
    });
  }

  /* ---------- inline submit-error message (replaces alert, names the email) ---------- */
  function showFormError(form) {
    var btn = form.querySelector('[type="submit"]');
    var box = form.querySelector('.qb-form-error');
    if (!box) {
      box = document.createElement('p');
      box.className = 'qb-form-error';
      box.setAttribute('role', 'alert');
      if (btn) btn.insertAdjacentElement('afterend', box);
      else form.appendChild(box);
    }
    box.innerHTML = 'Something went wrong sending your request. Please email ' +
      '<a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> ' +
      'and we’ll pick it up right away.';
  }

  /* ---------- quote form wiring ---------- */
  function bindForm() {
    var form = document.getElementById('qb-quote-form');
    if (!form) return;
    formItemsBox = document.getElementById('qb-form-items');
    hiddenField = form.querySelector('input[name="selected_products"]');

    /* let buyers edit quantities / remove items straight from the form preview
       (buttons are type="button" so they never submit the form) */
    if (formItemsBox) {
      formItemsBox.addEventListener('click', function (e) {
        var t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.inc) setQty(t.dataset.inc, +1);
        else if (t.dataset.dec) setQty(t.dataset.dec, -1);
        else if (t.dataset.rm) remove(t.dataset.rm);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      /* fold the item list into the message body too, so it is unmissable in the email */
      var msgField = form.querySelector('textarea[name="message"]');
      var list = buildList(load());
      var fd = new FormData(form);
      if (msgField) {
        fd.set('message', (msgField.value ? msgField.value + '\n\n' : '') + '----------\n' + list);
      }
      var btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (json.success) {
            var wrap = form.closest('.tr-form-wrap') || form.parentElement;
            var ok = document.getElementById('qb-success');
            form.style.display = 'none';
            if (ok) ok.style.display = 'block';
            clear();
          } else {
            if (btn) { btn.disabled = false; btn.textContent = 'Send quote request →'; }
            showFormError(form);
          }
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'Send quote request →'; }
          showFormError(form);
        });
    });
  }

  /* ---------- init ---------- */
  function init() {
    buildUI();
    bindAddButtons();
    bindForm();
    render();
    /* keep in sync if the user has two tabs open */
    window.addEventListener('storage', function (e) { if (e.key === KEY) render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
