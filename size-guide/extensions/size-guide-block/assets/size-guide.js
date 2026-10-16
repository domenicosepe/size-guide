(function () {
  'use strict';

  var DEFAULT_CONFIG = {
    theme: { accent: '#111111', accentText: '#ffffff', bg: '#ffffff', text: '#1a1a1a', head: '#f3f3f3', radius: 10, font: 'inherit' },
    features: { calculator: true, units: true, photo: true, addToCart: true, showRecommendation: true, highlight: true },
    tables: [{
      id: 'default', name: 'Uomo – Magliette', rules: { all: true },
      columns: [
        { key: 'height', label: 'Altezza', unit: 'cm', calc: true },
        { key: 'weight', label: 'Peso', unit: 'kg', calc: true },
        { key: 'waist', label: 'Vita', unit: 'cm' },
        { key: 'chest', label: 'Torace', unit: 'cm' }
      ],
      rows: [
        { size: 'S', height: '165-172', weight: '60-70', waist: '78-84', chest: '88-92' },
        { size: 'M', height: '171-176', weight: '70-76', waist: '84-88', chest: '92-98' },
        { size: 'L', height: '176-182', weight: '76-82', waist: '88-94', chest: '98-104' },
        { size: 'XL', height: '181-186', weight: '82-88', waist: '94-100', chest: '104-110' }
      ]
    }]
  };

  function parseRange(v) {
    var m = String(v).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  }
  function fmt(n) { return Math.round(n * 10) / 10; }
  function h(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (html != null) el.innerHTML = html;
    return el;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function pickTable(cfg, p) {
    var t = cfg.tables || [];
    for (var i = 0; i < t.length; i++) {
      var r = t[i].rules || {};
      if ((r.productIds || []).indexOf(p.id) > -1) return t[i];
    }
    for (var j = 0; j < t.length; j++) {
      var r2 = t[j].rules || {};
      if ((r2.collections || []).some(function (c) { return p.collections.indexOf(c) > -1; })) return t[j];
      if ((r2.tags || []).some(function (g) { return p.tags.indexOf(g) > -1; })) return t[j];
    }
    for (var k = 0; k < t.length; k++) if ((t[k].rules || {}).all) return t[k];
    return t[0];
  }

  function SizeGuide(root) {
    var data = JSON.parse(root.querySelector('[data-sg-data]').textContent);
    this.root = root;
    this.p = data.product;
    this.i18n = data.i18n;
    var cfg = data.config || DEFAULT_CONFIG;
    if (typeof cfg === 'string') {
      try { cfg = JSON.parse(cfg); } catch (e) { cfg = DEFAULT_CONFIG; }
    }
    this.cfg = {
      theme: Object.assign({}, DEFAULT_CONFIG.theme, cfg.theme),
      features: Object.assign({}, DEFAULT_CONFIG.features, cfg.features),
      tables: cfg.tables && cfg.tables.length ? cfg.tables : DEFAULT_CONFIG.tables
    };
    this.table = pickTable(this.cfg, this.p);
    if (!this.table) { root.hidden = true; return; }
    this.unit = 'cm';
    this.tab = this.cfg.features.calculator ? 'calc' : 'table';
    this.rec = null;
    this.sel = null;
    this.state = { height: '', weight: '', fit: 'regular' };
    root.querySelector('[data-sg-open]').addEventListener('click', this.open.bind(this));
  }

  SizeGuide.prototype.sizeOptionIndex = function () {
    var opts = this.p.options || [];
    for (var i = 0; i < opts.length; i++) if (/tagli|size|misura/i.test(opts[i])) return i;
    return opts.length === 1 ? 0 : -1;
  };

  SizeGuide.prototype.availableSizes = function () {
    var self = this, idx = this.sizeOptionIndex(), sizes = this.table.rows.map(function (r) { return r.size; });
    if (idx < 0) return sizes.map(function (s) { return { size: s, ok: true }; });
    return sizes.map(function (s) {
      var v = self.p.variants.filter(function (x) { return String(x.options[idx]).toLowerCase() === String(s).toLowerCase(); });
      return { size: s, ok: v.some(function (x) { return x.available; }), exists: v.length > 0 };
    }).filter(function (x) { return x.exists !== false; });
  };

  SizeGuide.prototype.open = function () {
    if (this.overlay) { this.overlay.hidden = false; this.render(); return; }
    var t = this.cfg.theme;
    this.overlay = h('div', { class: 'sg-overlay', role: 'dialog', 'aria-modal': 'true' });
    this.overlay.style.cssText = '--sg-accent:' + t.accent + ';--sg-accent-text:' + t.accentText + ';--sg-bg:' + t.bg +
      ';--sg-text:' + t.text + ';--sg-head:' + t.head + ';--sg-radius:' + t.radius + 'px;--sg-font:' + t.font;
    this.modal = h('div', { class: 'sg-modal' });
    this.overlay.appendChild(this.modal);
    var self = this;
    this.overlay.addEventListener('click', function (e) { if (e.target === self.overlay) self.close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !self.overlay.hidden) self.close(); });
    document.body.appendChild(this.overlay);
    document.documentElement.classList.add('sg-lock');
    this.render();
  };

  SizeGuide.prototype.close = function () {
    this.overlay.hidden = true;
    document.documentElement.classList.remove('sg-lock');
  };

  SizeGuide.prototype.render = function () {
    var f = this.cfg.features, tb = this.table, self = this;
    document.documentElement.classList.add('sg-lock');
    var photo = f.photo && this.p.image;
    var html = '<div class="sg-head"><div><h3>' + esc(this.p.title) + '</h3><small>' + esc(this.i18n.title) +
      '</small></div><button class="sg-x" data-x aria-label="Chiudi">×</button></div>';
    html += '<div class="sg-wrap' + (photo ? '' : ' sg-nophoto') + '">';
    if (photo) {
      html += '<div class="sg-photo"><img src="' + this.p.image + '" alt="">';
      if (this.p.images.length > 1) html += '<div class="sg-thumbs">' + this.p.images.map(function (i) { return '<img src="' + i + '" alt="">'; }).join('') + '</div>';
      html += '</div>';
    }
    html += '<div class="sg-col">';
    if (f.calculator) html += '<div class="sg-tabs"><button data-tab="calc" class="' + (this.tab === 'calc' ? 'on' : '') + '">Calcola la mia taglia</button><button data-tab="table" class="' + (this.tab === 'table' ? 'on' : '') + '">Tabella taglie</button></div>';
    html += '<div class="sg-body">';
    if (f.units) html += '<div class="sg-seg"><button data-unit="cm" class="' + (this.unit === 'cm' ? 'on' : '') + '">cm / kg</button><button data-unit="in" class="' + (this.unit === 'in' ? 'on' : '') + '">pollici / lb</button></div>';

    if (this.tab === 'calc' && f.calculator) {
      var hu = this.unit === 'cm' ? 'cm' : 'in', wu = this.unit === 'cm' ? 'kg' : 'lb';
      html += '<div class="sg-row"><div class="sg-f"><label>Altezza (' + hu + ')</label><input type="number" inputmode="decimal" data-in="height" value="' + esc(this.state.height) + '"></div>' +
        '<div class="sg-f"><label>Peso (' + wu + ')</label><input type="number" inputmode="decimal" data-in="weight" value="' + esc(this.state.weight) + '"></div></div>' +
        '<div class="sg-f"><label>Vestibilità preferita</label><select data-in="fit">' +
        [['tight', 'Aderente'], ['regular', 'Regolare'], ['loose', 'Comoda']].map(function (o) { return '<option value="' + o[0] + '"' + (self.state.fit === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select></div><button class="sg-cta" data-calc>Calcola la mia taglia</button>';
      if (this.rec) html += '<div class="sg-res">Ti consigliamo la taglia<b>' + esc(this.rec) + '</b><small>Già selezionata qui sotto</small></div>';
      if (this.err) html += '<div class="sg-err">' + esc(this.err) + '</div>';
    } else {
      html += '<table class="sg-table"><thead><tr><th>Taglia</th>' + tb.columns.map(function (c) { return '<th>' + esc(c.label) + ' (' + esc(self.unitLabel(c)) + ')</th>'; }).join('') + '</tr></thead><tbody>';
      tb.rows.forEach(function (r) {
        html += '<tr class="' + (f.highlight && r.size === self.rec ? 'hl' : '') + '"><td>' + esc(r.size) + '</td>' +
          tb.columns.map(function (c) { return '<td>' + esc(self.convert(r[c.key], c)) + '</td>'; }).join('') + '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div></div></div>';

    if (f.addToCart) {
      var sizes = this.availableSizes();
      html += '<div class="sg-foot"><div class="sg-lbl"><span>Taglia</span><span>' + (this.rec ? '★ consigliata: ' + esc(this.rec) : '') + '</span></div><div class="sg-pills">' +
        sizes.map(function (s) {
          return '<button data-size="' + esc(s.size) + '" class="' + (s.size === self.sel ? 'on ' : '') + (s.size === self.rec ? 'rc ' : '') + (s.ok ? '' : 'na') + '"' + (s.ok ? '' : ' disabled') + '>' + esc(s.size) + '</button>';
        }).join('') + '</div><button class="sg-cta" data-atc' + (this.sel ? '' : ' disabled') + '>' +
        (this.sel ? 'Aggiungi al carrello · Taglia ' + esc(this.sel) : 'Seleziona una taglia') + '</button></div>';
    }
    this.modal.innerHTML = html;
    this.bind();
  };

  SizeGuide.prototype.unitLabel = function (c) {
    if (this.unit === 'cm') return c.unit;
    return c.unit === 'cm' ? 'in' : c.unit === 'kg' ? 'lb' : c.unit;
  };

  SizeGuide.prototype.convert = function (val, c) {
    if (this.unit === 'cm') return val;
    var r = parseRange(val);
    if (!r) return val;
    var k = c.unit === 'cm' ? 1 / 2.54 : c.unit === 'kg' ? 2.2046 : 1;
    return fmt(r[0] * k) + '–' + fmt(r[1] * k);
  };

  SizeGuide.prototype.calculate = function () {
    var tb = this.table, s = this.state, k = this.unit === 'in';
    var hv = parseFloat(s.height), wv = parseFloat(s.weight);
    if (!hv && !wv) { this.err = 'Inserisci almeno altezza o peso.'; this.rec = null; return; }
    this.err = null;
    if (k) { hv = hv * 2.54; wv = wv / 2.2046; }
    var rows = tb.rows, best = -1, bestScore = Infinity;
    rows.forEach(function (r, i) {
      var score = 0;
      [['height', hv], ['weight', wv]].forEach(function (p) {
        if (!p[1]) return;
        var rg = parseRange(r[p[0]]);
        if (!rg) return;
        var mid = (rg[0] + rg[1]) / 2, span = (rg[1] - rg[0]) || 1;
        score += Math.abs(p[1] - mid) / span;
      });
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (s.fit === 'loose' && best < rows.length - 1) best++;
    if (s.fit === 'tight' && best > 0) best--;
    this.rec = rows[best].size;
    var ok = this.availableSizes().some(function (x) { return x.size === rows[best].size && x.ok; });
    this.sel = ok ? this.rec : null;
    var reco = this.root.querySelector('[data-sg-reco]');
    if (reco && this.cfg.features.showRecommendation) { reco.hidden = false; reco.textContent = '✨ Ti consigliamo la taglia: ' + this.rec; }
  };

  SizeGuide.prototype.bind = function () {
    var self = this, m = this.modal;
    m.querySelector('[data-x]').onclick = function () { self.close(); };
    m.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { self.tab = b.dataset.tab; self.render(); }; });
    m.querySelectorAll('[data-unit]').forEach(function (b) { b.onclick = function () { self.unit = b.dataset.unit; self.render(); }; });
    m.querySelectorAll('[data-in]').forEach(function (i) { i.oninput = function () { self.state[i.dataset.in] = i.value; }; });
    var calc = m.querySelector('[data-calc]');
    if (calc) calc.onclick = function () { self.calculate(); self.render(); };
    m.querySelectorAll('[data-size]').forEach(function (b) { b.onclick = function () { self.sel = b.dataset.size; self.render(); }; });
    var atc = m.querySelector('[data-atc]');
    if (atc) atc.onclick = function () { self.addToCart(atc); };
    m.querySelectorAll('.sg-thumbs img').forEach(function (t) { t.onclick = function () { var big = m.querySelector('.sg-photo > img'); if (big) big.src = t.src.replace('width=160', 'width=700'); }; });
  };

  SizeGuide.prototype.findVariant = function () {
    var idx = this.sizeOptionIndex(), self = this;
    var cands = this.p.variants.filter(function (v) { return idx < 0 || String(v.options[idx]).toLowerCase() === String(self.sel).toLowerCase(); });
    var live = this.pageVariantId();
    var same = cands.filter(function (v) { return v.available && live && String(v.id) === String(live); })[0];
    return same || cands.filter(function (v) { return v.available; })[0] || null;
  };

  SizeGuide.prototype.pageVariantId = function () {
    var i = document.querySelector('form[action*="/cart/add"] [name="id"]');
    return i ? i.value : null;
  };

  SizeGuide.prototype.syncThemeSelection = function () {
    var self = this, idx = this.sizeOptionIndex();
    if (idx < 0) return;
    var want = String(this.sel).toLowerCase();
    document.querySelectorAll('form[action*="/cart/add"] input[type="radio"], form[action*="/cart/add"] select option').forEach(function (el) {
      var val = String(el.value || el.textContent).trim().toLowerCase();
      if (val !== want) return;
      if (el.tagName === 'OPTION') { el.parentNode.value = el.value; el.parentNode.dispatchEvent(new Event('change', { bubbles: true })); }
      else { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.click(); }
    });
  };

  SizeGuide.prototype.addToCart = function (btn) {
    var self = this, v = this.findVariant();
    if (!v) { btn.textContent = 'Taglia non disponibile'; return; }
    btn.disabled = true; btn.textContent = 'Aggiungo…';
    this.syncThemeSelection();
    fetch((window.Shopify && Shopify.routes ? Shopify.routes.root : '/') + 'cart/add.js', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: v.id, quantity: 1 }] })
    }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function () {
      document.dispatchEvent(new CustomEvent('sg:added', { detail: { variantId: v.id, size: self.sel } }));
      document.dispatchEvent(new CustomEvent('cart:refresh'));
      btn.textContent = '✓ Aggiunto al carrello';
      setTimeout(function () { self.close(); window.location.href = (window.Shopify && Shopify.routes ? Shopify.routes.root : '/') + 'cart'; }, 700);
    }).catch(function () { btn.disabled = false; btn.textContent = 'Errore, riprova'; });
  };

  function init() { document.querySelectorAll('[data-sg-root]').forEach(function (r) { if (!r.__sg) r.__sg = new SizeGuide(r); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
