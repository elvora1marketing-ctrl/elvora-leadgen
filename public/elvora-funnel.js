/**
 * Elvora Funnel Engine — config-driven multi-step lead funnel.
 *
 * Usage:
 *   <script src="https://DOMAIN/elvora-funnel.js"
 *     data-url="https://DOMAIN"
 *     data-slug="mein-funnel"
 *     data-mode="inline|popup|standalone">
 *   </script>
 *   <div id="elvora-funnel"></div>
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;
  var BASE = (script.getAttribute('data-url') || '').replace(/\/$/, '');
  var SLUG = script.getAttribute('data-slug');
  var MODE = script.getAttribute('data-mode') || 'inline';
  var TARGET = script.getAttribute('data-target') || '#elvora-funnel';
  if (!SLUG) { console.error('[Elvora Funnel] data-slug fehlt'); return; }

  var SID = 'ef_' + Math.random().toString(36).substr(2, 12);
  var config = null;
  var step = 0;
  var answers = {};
  var startTime = Date.now();
  var submitting = false;
  var root = null;

  // ---- Helpers ----
  function h(tag, cls, attrs) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k === 'onclick') el.addEventListener('click', attrs[k]);
      else if (k === 'oninput') el.addEventListener('input', attrs[k]);
      else if (k === 'onkeydown') el.addEventListener('keydown', attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    return el;
  }
  function append(parent) {
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i]) parent.appendChild(arguments[i]);
    }
    return parent;
  }
  function tmpl(s, data) {
    return (s || '').replace(/\{\{(\w+)\}\}/g, function (_, k) {
      var v = data[k];
      return Array.isArray(v) ? v.join(', ') : (v != null ? v : '');
    });
  }

  // ---- API ----
  function api(method, path, body, cb) {
    var url = BASE + '/api/funnel/' + SLUG + path;
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    fetch(url, opts).then(function (r) { return r.json(); }).then(function (d) { cb(null, d); }).catch(function (e) { cb(e); });
  }
  function track(stepId, type) {
    api('POST', '/events', { sessionId: SID, step: stepId, eventType: type }, function () {});
  }

  // ---- CSS ----
  function injectCSS(b) {
    var p = b.primaryColor || '#8B5CF6';
    var a = b.accentColor || p;
    var bg = b.backgroundColor || '#ffffff';
    var tx = b.textColor || '#1a1a2e';
    var r = (b.borderRadius != null ? b.borderRadius : 12) + 'px';
    var f = b.fontFamily || "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
    var dim = tx === '#1a1a2e' ? '#64748b' : 'rgba(255,255,255,.55)';

    var css = '\
.ef{--p:' + p + ';--a:' + a + ';--bg:' + bg + ';--tx:' + tx + ';--dim:' + dim + ';--r:' + r + ';--f:' + f + ';\
  font-family:var(--f);color:var(--tx);background:var(--bg);max-width:540px;margin:0 auto;position:relative;overflow:hidden;border-radius:var(--r);}\
.ef *,.ef *::before,.ef *::after{box-sizing:border-box}\
.ef-over{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .25s}\
.ef-over.ef-show{opacity:1}\
.ef-pop{width:100%;max-width:560px;max-height:92vh;overflow-y:auto;border-radius:var(--r);position:relative}\
.ef-pop .ef-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:none;background:rgba(0,0,0,.08);border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;z-index:2;color:var(--tx)}\
.ef-trigger{position:fixed;bottom:24px;right:24px;z-index:99998;background:var(--p);color:#fff;border:none;padding:14px 24px;border-radius:999px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.18);font-family:var(--f);transition:transform .15s}\
.ef-trigger:hover{transform:scale(1.04)}\
.ef-inner{padding:28px 24px 24px}\
.ef-bar-wrap{height:4px;background:rgba(0,0,0,.06);border-radius:2px;margin-bottom:6px;overflow:hidden}\
.ef-bar{height:100%;background:var(--p);border-radius:2px;transition:width .4s ease}\
.ef-step-label{font-size:12px;color:var(--dim);margin-bottom:20px}\
.ef-q{font-size:20px;font-weight:700;line-height:1.3;margin:0 0 6px}\
.ef-desc{font-size:14px;color:var(--dim);margin:0 0 20px}\
.ef-view{min-height:200px;position:relative}\
.ef-slide{animation:efIn .35s ease both}\
@keyframes efIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}\
.ef-slide-back{animation:efInB .35s ease both}\
@keyframes efInB{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}\
.ef-cards{display:grid;gap:10px}\
.ef-card{border:2px solid rgba(0,0,0,.08);border-radius:var(--r);padding:14px 16px;cursor:pointer;transition:border-color .15s,background .15s;display:flex;align-items:center;gap:12px;text-align:left;background:none;width:100%;font-family:var(--f);font-size:14px;color:var(--tx)}\
.ef-card:hover{border-color:var(--p);background:color-mix(in srgb,var(--p) 5%,transparent)}\
.ef-card:focus-visible{outline:2px solid var(--p);outline-offset:2px}\
.ef-card.ef-sel{border-color:var(--p);background:color-mix(in srgb,var(--p) 8%,transparent)}\
.ef-card-icon{font-size:22px;flex-shrink:0;width:32px;text-align:center}\
.ef-card-body{flex:1;min-width:0}\
.ef-card-label{font-weight:600;font-size:15px}\
.ef-card-desc{font-size:12px;color:var(--dim);margin-top:2px}\
.ef-check{width:22px;height:22px;border:2px solid rgba(0,0,0,.15);border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s;font-size:13px;color:#fff}\
.ef-sel .ef-check{background:var(--p);border-color:var(--p)}\
.ef-input{width:100%;padding:14px 16px;border:2px solid rgba(0,0,0,.1);border-radius:var(--r);font-size:15px;font-family:var(--f);color:var(--tx);background:transparent;transition:border-color .15s}\
.ef-input:focus{outline:none;border-color:var(--p)}\
.ef-input.ef-err{border-color:#ef4444}\
.ef-err-msg{color:#ef4444;font-size:12px;margin-top:6px}\
.ef-contact-grid{display:grid;gap:12px}\
.ef-field label{display:block;font-size:13px;font-weight:600;margin-bottom:4px}\
.ef-field .ef-opt{font-weight:400;color:var(--dim)}\
.ef-nav{display:flex;gap:10px;margin-top:24px;align-items:center}\
.ef-back{background:none;border:none;color:var(--dim);cursor:pointer;font-size:14px;font-family:var(--f);padding:10px 16px;border-radius:var(--r);transition:color .15s}\
.ef-back:hover{color:var(--tx)}\
.ef-next,.ef-submit{background:var(--p);color:#fff;border:none;padding:14px 28px;border-radius:var(--r);font-size:15px;font-weight:600;cursor:pointer;font-family:var(--f);transition:opacity .15s,transform .15s;margin-left:auto}\
.ef-next:hover,.ef-submit:hover{opacity:.9;transform:translateY(-1px)}\
.ef-next:disabled,.ef-submit:disabled{opacity:.5;cursor:default;transform:none}\
.ef-micro{font-size:12px;color:var(--dim);text-align:center;margin-top:10px;line-height:1.4}\
.ef-privacy{font-size:12px;color:var(--dim);margin-top:14px}\
.ef-privacy a{color:var(--p);text-decoration:underline}\
.ef-trust{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px;justify-content:center}\
.ef-badge{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim);background:rgba(0,0,0,.03);padding:6px 12px;border-radius:999px}\
.ef-badge-icon{font-size:16px}\
.ef-stars{color:#f59e0b;font-size:13px;letter-spacing:1px}\
.ef-review{text-align:center;max-width:280px}\
.ef-review-text{font-size:13px;font-style:italic;color:var(--dim);margin-top:4px}\
.ef-review-name{font-size:12px;font-weight:600;margin-top:4px}\
.ef-stat{text-align:center}\
.ef-stat-val{font-size:22px;font-weight:800;color:var(--p)}\
.ef-stat-label{font-size:11px;color:var(--dim)}\
.ef-logo-img{height:28px;opacity:.5;filter:grayscale(1);transition:opacity .15s}\
.ef-logo-img:hover{opacity:1;filter:none}\
.ef-labor{text-align:center;padding:40px 0}\
.ef-labor-dots{display:inline-flex;gap:6px;margin-bottom:16px}\
.ef-labor-dots span{width:10px;height:10px;border-radius:50%;background:var(--p);animation:efPulse 1.2s ease infinite}\
.ef-labor-dots span:nth-child(2){animation-delay:.2s}\
.ef-labor-dots span:nth-child(3){animation-delay:.4s}\
@keyframes efPulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}\
.ef-labor-text{font-size:14px;color:var(--dim)}\
.ef-labor-bar{width:200px;height:4px;background:rgba(0,0,0,.06);border-radius:2px;margin:12px auto 0;overflow:hidden}\
.ef-labor-fill{height:100%;background:var(--p);border-radius:2px;width:0;transition:width .1s linear}\
.ef-result-box{background:color-mix(in srgb,var(--p) 6%,transparent);border:1px solid color-mix(in srgb,var(--p) 20%,transparent);border-radius:var(--r);padding:20px;margin-bottom:20px;font-size:15px;line-height:1.6}\
.ef-done{text-align:center;padding:24px 0}\
.ef-done-icon{width:56px;height:56px;border-radius:50%;background:color-mix(in srgb,var(--p) 12%,transparent);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px}\
.ef-done h2{font-size:22px;font-weight:700;margin:0 0 8px}\
.ef-done p{font-size:14px;color:var(--dim);margin:0 0 8px;line-height:1.5}\
.ef-done-time{display:inline-block;background:color-mix(in srgb,var(--p) 8%,transparent);color:var(--p);font-size:13px;font-weight:600;padding:6px 14px;border-radius:999px;margin-top:8px}\
.ef-done-extra{display:inline-block;margin-top:16px;color:var(--p);font-size:14px;font-weight:600;text-decoration:none}\
.ef-done-extra:hover{text-decoration:underline}\
.ef-scarcity{text-align:center;font-size:13px;color:var(--a);font-weight:500;margin-top:12px}\
.ef-honey{position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden}\
@media(max-width:480px){.ef-inner{padding:20px 16px 16px}.ef-q{font-size:18px}.ef-cards{grid-template-columns:1fr!important}}\
';
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ---- Progress ----
  function renderBar(current, total) {
    var pct = Math.round(((current) / total) * 100);
    var wrap = h('div', 'ef-bar-wrap');
    var bar = h('div', 'ef-bar');
    bar.style.width = pct + '%';
    append(wrap, bar);
    var label = h('div', 'ef-step-label', { text: 'Schritt ' + (current + 1) + ' von ' + total });
    var frag = document.createDocumentFragment();
    append(frag, wrap, label);
    return frag;
  }

  // ---- Trust ----
  function renderTrust(elements) {
    if (!elements || !elements.length) return null;
    var wrap = h('div', 'ef-trust');
    elements.forEach(function (t) {
      if (t.type === 'badge') {
        var b = h('div', 'ef-badge');
        if (t.icon) append(b, h('span', 'ef-badge-icon', { text: t.icon }));
        if (t.text) append(b, h('span', null, { text: t.text }));
        append(wrap, b);
      } else if (t.type === 'review') {
        var rv = h('div', 'ef-review');
        if (t.stars) append(rv, h('div', 'ef-stars', { text: '★'.repeat(t.stars) + '☆'.repeat(5 - (t.stars || 0)) }));
        if (t.reviewText) append(rv, h('div', 'ef-review-text', { text: '„' + t.reviewText + '"' }));
        if (t.name) append(rv, h('div', 'ef-review-name', { text: '— ' + t.name }));
        append(wrap, rv);
      } else if (t.type === 'logo' && t.src) {
        append(wrap, h('img', 'ef-logo-img', { src: t.src, alt: t.alt || '', loading: 'lazy' }));
      } else if (t.type === 'stat') {
        var st = h('div', 'ef-stat');
        if (t.value) append(st, h('div', 'ef-stat-val', { text: t.value }));
        if (t.label) append(st, h('div', 'ef-stat-label', { text: t.label }));
        append(wrap, st);
      }
    });
    return wrap;
  }

  // ---- Step renderers ----
  function renderSingleChoice(s, dir) {
    var frag = h('div', 'ef-view ' + (dir === 'back' ? 'ef-slide-back' : 'ef-slide'));
    append(frag, h('h2', 'ef-q', { text: s.question }));
    if (s.description) append(frag, h('p', 'ef-desc', { text: s.description }));
    var grid = h('div', 'ef-cards');
    grid.style.gridTemplateColumns = 'repeat(' + (s.columns || 2) + ',1fr)';
    s.options.forEach(function (opt) {
      var card = h('button', 'ef-card' + (answers[s.id] === opt.value ? ' ef-sel' : ''), {
        type: 'button',
        role: 'radio',
        'aria-checked': answers[s.id] === opt.value ? 'true' : 'false',
        'aria-label': opt.label,
        onclick: function () {
          answers[s.id] = opt.value;
          track(s.id, 'complete');
          nextStep();
        }
      });
      if (opt.icon) append(card, h('span', 'ef-card-icon', { text: opt.icon }));
      var body = h('div', 'ef-card-body');
      append(body, h('div', 'ef-card-label', { text: opt.label }));
      if (opt.description) append(body, h('div', 'ef-card-desc', { text: opt.description }));
      append(card, body);
      append(grid, card);
    });
    append(frag, grid);
    if (step > 0) {
      var nav = h('div', 'ef-nav');
      append(nav, h('button', 'ef-back', { text: '← Zurück', type: 'button', onclick: prevStep }));
      append(frag, nav);
    }
    return frag;
  }

  function renderMultiChoice(s, dir) {
    var sel = answers[s.id] || [];
    var frag = h('div', 'ef-view ' + (dir === 'back' ? 'ef-slide-back' : 'ef-slide'));
    append(frag, h('h2', 'ef-q', { text: s.question }));
    if (s.description) append(frag, h('p', 'ef-desc', { text: s.description }));
    var grid = h('div', 'ef-cards');
    grid.style.gridTemplateColumns = 'repeat(' + (s.columns || 2) + ',1fr)';
    var nextBtn;
    s.options.forEach(function (opt) {
      var isSel = sel.indexOf(opt.value) >= 0;
      var card = h('button', 'ef-card' + (isSel ? ' ef-sel' : ''), {
        type: 'button', role: 'checkbox', 'aria-checked': isSel ? 'true' : 'false', 'aria-label': opt.label,
        onclick: function () {
          var cur = answers[s.id] || [];
          var idx = cur.indexOf(opt.value);
          if (idx >= 0) cur.splice(idx, 1); else cur.push(opt.value);
          if (s.maxSelect && cur.length > s.maxSelect) cur.shift();
          answers[s.id] = cur;
          showCurrent();
        }
      });
      if (opt.icon) append(card, h('span', 'ef-card-icon', { text: opt.icon }));
      var body = h('div', 'ef-card-body');
      append(body, h('div', 'ef-card-label', { text: opt.label }));
      if (opt.description) append(body, h('div', 'ef-card-desc', { text: opt.description }));
      append(card, body);
      var chk = h('span', 'ef-check');
      if (isSel) chk.textContent = '✓';
      append(card, chk);
      append(grid, card);
    });
    append(frag, grid);
    var nav = h('div', 'ef-nav');
    if (step > 0) append(nav, h('button', 'ef-back', { text: '← Zurück', type: 'button', onclick: prevStep }));
    var minSel = s.minSelect || 1;
    nextBtn = h('button', 'ef-next', { text: 'Weiter →', type: 'button', disabled: sel.length < minSel ? 'true' : null, onclick: function () { track(s.id, 'complete'); nextStep(); } });
    append(nav, nextBtn);
    append(frag, nav);
    return frag;
  }

  function renderText(s, dir) {
    var frag = h('div', 'ef-view ' + (dir === 'back' ? 'ef-slide-back' : 'ef-slide'));
    append(frag, h('h2', 'ef-q', { text: s.question }));
    if (s.description) append(frag, h('p', 'ef-desc', { text: s.description }));
    var inp = h('input', 'ef-input', {
      type: s.inputType || 'text',
      placeholder: s.placeholder || '',
      value: answers[s.id] || '',
      'aria-label': s.question,
      oninput: function (e) { answers[s.id] = e.target.value; errEl.textContent = ''; inp.classList.remove('ef-err'); },
      onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); doNext(); } }
    });
    var errEl = h('div', 'ef-err-msg');
    append(frag, inp, errEl);
    var nav = h('div', 'ef-nav');
    if (step > 0) append(nav, h('button', 'ef-back', { text: '← Zurück', type: 'button', onclick: prevStep }));
    function doNext() {
      var val = (answers[s.id] || '').trim();
      if (s.required !== false && !val) { errEl.textContent = 'Bitte ausfüllen'; inp.classList.add('ef-err'); inp.focus(); return; }
      if (s.validation) {
        if (s.validation.minLength && val.length < s.validation.minLength) { errEl.textContent = s.validation.errorMessage || 'Zu kurz'; inp.classList.add('ef-err'); return; }
        if (s.validation.maxLength && val.length > s.validation.maxLength) { errEl.textContent = s.validation.errorMessage || 'Zu lang'; inp.classList.add('ef-err'); return; }
        if (s.validation.pattern && !new RegExp(s.validation.pattern).test(val)) { errEl.textContent = s.validation.errorMessage || 'Ungültiges Format'; inp.classList.add('ef-err'); return; }
      }
      track(s.id, 'complete'); nextStep();
    }
    append(nav, h('button', 'ef-next', { text: 'Weiter →', type: 'button', onclick: doNext }));
    append(frag, nav);
    setTimeout(function () { inp.focus(); }, 100);
    return frag;
  }

  function renderTextarea(s, dir) {
    var frag = h('div', 'ef-view ' + (dir === 'back' ? 'ef-slide-back' : 'ef-slide'));
    append(frag, h('h2', 'ef-q', { text: s.question }));
    if (s.description) append(frag, h('p', 'ef-desc', { text: s.description }));
    var ta = h('textarea', 'ef-input', {
      placeholder: s.placeholder || '', rows: String(s.rows || 3), 'aria-label': s.question,
      oninput: function (e) { answers[s.id] = e.target.value; }
    });
    ta.value = answers[s.id] || '';
    var errEl = h('div', 'ef-err-msg');
    append(frag, ta, errEl);
    var nav = h('div', 'ef-nav');
    if (step > 0) append(nav, h('button', 'ef-back', { text: '← Zurück', type: 'button', onclick: prevStep }));
    append(nav, h('button', 'ef-next', { text: 'Weiter →', type: 'button', onclick: function () {
      var val = (answers[s.id] || '').trim();
      if (s.required !== false && !val) { errEl.textContent = 'Bitte ausfüllen'; ta.classList.add('ef-err'); ta.focus(); return; }
      track(s.id, 'complete'); nextStep();
    }}));
    append(frag, nav);
    setTimeout(function () { ta.focus(); }, 100);
    return frag;
  }

  function renderContact(s, dir) {
    var data = answers[s.id] || {};
    var frag = h('div', 'ef-view ' + (dir === 'back' ? 'ef-slide-back' : 'ef-slide'));
    append(frag, h('h2', 'ef-q', { text: s.question }));
    if (s.description) append(frag, h('p', 'ef-desc', { text: s.description }));
    var grid = h('div', 'ef-contact-grid');
    var fields = s.fields || { name: true, email: { required: true }, phone: false };
    var errEl = h('div', 'ef-err-msg');
    var inputs = {};

    function addField(key, label, type, req, ph) {
      var field = h('div', 'ef-field');
      var lbl = h('label', null, { html: label + (req ? '' : ' <span class="ef-opt">(optional)</span>'), for: 'ef-c-' + key });
      var inp = h('input', 'ef-input', { type: type, id: 'ef-c-' + key, placeholder: ph || '', value: data[key] || '', 'aria-label': label, oninput: function (e) { data[key] = e.target.value; answers[s.id] = data; } });
      inputs[key] = { el: inp, required: req };
      append(field, lbl, inp);
      append(grid, field);
    }

    var fconf = fields;
    if (fconf.name) addField('name', 'Name', 'text', fconf.name === true || (fconf.name && fconf.name.required !== false), fconf.name && fconf.name.placeholder || 'Ihr Name');
    if (fconf.email || fconf.email === undefined) addField('email', 'E-Mail', 'email', true, fconf.email && fconf.email.placeholder || 'ihre@email.de');
    if (fconf.phone) addField('phone', 'Telefon', 'tel', fconf.phone !== true && fconf.phone && fconf.phone.required, fconf.phone && fconf.phone.placeholder || '+49 123 456 789');
    if (fconf.preferredTime) addField('preferredTime', 'Wunschtermin', 'datetime-local', fconf.preferredTime !== true && fconf.preferredTime && fconf.preferredTime.required, '');

    append(frag, grid, errEl);

    // Honeypot
    if (config.spam && config.spam.honeypot) {
      var honey = h('input', 'ef-honey', { type: 'text', name: 'ef_honey', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
      append(frag, honey);
    }

    // Privacy notice
    append(frag, h('div', 'ef-privacy', { html: 'Mit dem Absenden akzeptieren Sie unsere <a href="' + config.meta.privacyUrl + '" target="_blank" rel="noopener">Datenschutzerklärung</a>.' }));

    // Scarcity
    if (config.scarcity && config.scarcity.enabled) {
      append(frag, h('div', 'ef-scarcity', { text: config.scarcity.text }));
    }

    // Trust at submit point
    if (config.trust && (config.trust.position === 'submit' || config.trust.position === 'both')) {
      append(frag, renderTrust(config.trust.elements));
    }

    var nav = h('div', 'ef-nav');
    if (step > 0) append(nav, h('button', 'ef-back', { text: '← Zurück', type: 'button', onclick: prevStep }));
    var submitBtn = h('button', 'ef-submit', { text: config.submitButton.label || 'Absenden', type: 'button', onclick: doSubmit });
    append(nav, submitBtn);
    append(frag, nav);

    if (config.submitButton.microcopy) {
      append(frag, h('div', 'ef-micro', { text: config.submitButton.microcopy }));
    }

    function doSubmit() {
      errEl.textContent = '';
      Object.keys(inputs).forEach(function (k) { inputs[k].el.classList.remove('ef-err'); });
      // Validate
      for (var k in inputs) {
        var v = (data[k] || '').trim();
        if (inputs[k].required && !v) { errEl.textContent = 'Bitte alle Pflichtfelder ausfüllen'; inputs[k].el.classList.add('ef-err'); inputs[k].el.focus(); return; }
      }
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { errEl.textContent = 'E-Mail ungültig'; inputs.email.el.classList.add('ef-err'); inputs.email.el.focus(); return; }
      if (submitting) return;
      submitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Wird gesendet…';

      var honeyEl = frag.querySelector('.ef-honey');
      var payload = {
        answers: answers,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        preferredTime: data.preferredTime || '',
        _start: startTime,
        _honey: honeyEl ? honeyEl.value : ''
      };

      track(s.id, 'complete');
      api('POST', '/lead', payload, function (err, res) {
        submitting = false;
        if (err || (res && res.error)) {
          submitBtn.disabled = false;
          submitBtn.textContent = config.submitButton.label || 'Absenden';
          errEl.textContent = (res && res.error) || 'Verbindungsfehler — bitte erneut versuchen';
          return;
        }
        showThankYou();
      });
    }

    setTimeout(function () {
      var first = grid.querySelector('input');
      if (first) first.focus();
    }, 100);
    return frag;
  }

  function renderResult(s, dir) {
    var frag = h('div', 'ef-view ' + (dir === 'back' ? 'ef-slide-back' : 'ef-slide'));

    if (s.laborIllusion && s.laborIllusion.enabled) {
      var labor = h('div', 'ef-labor');
      var dots = h('div', 'ef-labor-dots');
      append(dots, h('span'), h('span'), h('span'));
      append(labor, dots);
      append(labor, h('div', 'ef-labor-text', { text: s.laborIllusion.text || 'Wir prüfen deine Angaben…' }));
      var barWrap = h('div', 'ef-labor-bar');
      var barFill = h('div', 'ef-labor-fill');
      append(barWrap, barFill);
      append(labor, barWrap);
      append(frag, labor);

      var dur = s.laborIllusion.durationMs || 1800;
      var start = Date.now();
      var frame = function () {
        var pct = Math.min(100, ((Date.now() - start) / dur) * 100);
        barFill.style.width = pct + '%';
        if (pct < 100) requestAnimationFrame(frame);
        else setTimeout(function () { showResultContent(frag, s); }, 200);
      };
      requestAnimationFrame(frame);
      track(s.id, 'view');
    } else {
      showResultContent(frag, s);
      track(s.id, 'view');
    }
    return frag;
  }

  function showResultContent(frag, s) {
    frag.innerHTML = '';
    var inner = h('div', 'ef-view ef-slide');
    append(inner, h('h2', 'ef-q', { text: s.question }));
    if (s.description) append(inner, h('p', 'ef-desc', { text: s.description }));
    var txt = tmpl(s.resultTemplate, flatAnswers());
    append(inner, h('div', 'ef-result-box', { html: txt.replace(/\n/g, '<br>') }));
    var nav = h('div', 'ef-nav');
    if (step > 0) append(nav, h('button', 'ef-back', { text: '← Zurück', type: 'button', onclick: prevStep }));
    append(nav, h('button', 'ef-next', { text: 'Weiter →', type: 'button', onclick: function () { track(s.id, 'complete'); nextStep(); } }));
    append(inner, nav);
    append(frag, inner);
  }

  function flatAnswers() {
    var flat = {};
    for (var k in answers) {
      var v = answers[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (var sub in v) flat[sub] = v[sub];
      } else {
        flat[k] = v;
      }
    }
    return flat;
  }

  // ---- Thank you (Peak-End Rule) ----
  function showThankYou() {
    var ty = config.thankYou;
    var inner = root.querySelector('.ef-inner');
    inner.innerHTML = '';
    var done = h('div', 'ef-done ef-slide');
    append(done, h('div', 'ef-done-icon', { text: '✓' }));
    append(done, h('h2', null, { text: ty.headline }));

    // Summary of answers
    var flat = flatAnswers();
    var summary = tmpl(ty.body, flat);
    append(done, h('p', null, { html: summary.replace(/\n/g, '<br>') }));

    if (ty.responseTime) {
      append(done, h('div', 'ef-done-time', { text: tmpl(ty.responseTime, { company: config.branding.companyName }) }));
    }
    if (ty.extra) {
      append(done, h('br'));
      append(done, h('a', 'ef-done-extra', { href: ty.extra.url, target: '_blank', rel: 'noopener', text: ty.extra.label }));
    }
    append(inner, done);
  }

  // ---- Navigation ----
  function visibleSteps() {
    return config.steps;
  }
  function showCurrent(dir) {
    var inner = root.querySelector('.ef-inner');
    inner.innerHTML = '';
    var steps = visibleSteps();
    var total = steps.length;
    var s = steps[step];

    append(inner, renderBar(step, total));

    // Trust at start
    if (step === 0 && config.trust && (config.trust.position === 'start' || config.trust.position === 'both')) {
      append(inner, renderTrust(config.trust.elements));
    }

    track(s.id, 'view');

    var rendered;
    if (s.type === 'single-choice') rendered = renderSingleChoice(s, dir);
    else if (s.type === 'multi-choice') rendered = renderMultiChoice(s, dir);
    else if (s.type === 'text') rendered = renderText(s, dir);
    else if (s.type === 'textarea') rendered = renderTextarea(s, dir);
    else if (s.type === 'contact') rendered = renderContact(s, dir);
    else if (s.type === 'result') rendered = renderResult(s, dir);
    else rendered = h('div', null, { text: 'Unbekannter Schritt-Typ: ' + s.type });

    append(inner, rendered);
  }
  function nextStep() {
    var steps = visibleSteps();
    if (step < steps.length - 1) { step++; showCurrent('forward'); }
  }
  function prevStep() {
    if (step > 0) { step--; showCurrent('back'); }
  }

  // ---- Render shell ----
  function renderFunnel(target) {
    root = h('div', 'ef');
    var inner = h('div', 'ef-inner');
    append(root, inner);

    if (config.branding.logo) {
      var logo = h('img', null, { src: config.branding.logo, alt: config.branding.companyName, style: 'height:32px;margin-bottom:16px;display:block' });
      append(inner, logo);
    }

    target.innerHTML = '';
    target.appendChild(root);
    showCurrent('forward');
  }

  function renderPopup() {
    injectCSS(config.branding);
    var trigger = h('button', 'ef-trigger', { text: config.submitButton.label || 'Jetzt anfragen', type: 'button' });
    trigger.style.setProperty('--p', config.branding.primaryColor || '#8B5CF6');
    trigger.style.setProperty('--f', config.branding.fontFamily || 'inherit');
    document.body.appendChild(trigger);

    var overlay;
    trigger.addEventListener('click', function () {
      if (overlay) { overlay.classList.add('ef-show'); return; }
      overlay = h('div', 'ef-over');
      var pop = h('div', 'ef-pop ef');
      var close = h('button', 'ef-close', { text: '×', type: 'button', 'aria-label': 'Schließen', onclick: function () { overlay.classList.remove('ef-show'); } });
      append(pop, close);
      root = pop;
      var inner = h('div', 'ef-inner');
      append(pop, inner);
      append(overlay, pop);
      document.body.appendChild(overlay);
      requestAnimationFrame(function () { overlay.classList.add('ef-show'); });
      showCurrent('forward');
    });

    overlay && overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('ef-show');
    });
  }

  function renderInline(target) {
    injectCSS(config.branding);
    renderFunnel(target);
  }

  // ---- Init ----
  function init() {
    api('GET', '', null, function (err, data) {
      if (err || !data || !data.config) { console.error('[Elvora Funnel] Config-Fehler', err); return; }
      config = data.config;

      if (MODE === 'popup') {
        renderPopup();
      } else {
        var target = document.querySelector(TARGET);
        if (!target) { console.error('[Elvora Funnel] Ziel-Element nicht gefunden:', TARGET); return; }
        renderInline(target);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
