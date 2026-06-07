(function() {
  var script = document.currentScript;
  if (!script) return;

  var baseUrl = script.getAttribute('data-url') || '';
  var slug = script.getAttribute('data-slug') || '';
  var target = script.getAttribute('data-target') || '#elvora-form';

  if (!baseUrl || !slug) return;

  // ---------------------------------------------------------------------------
  // GDPR / DSGVO consent handling
  // ---------------------------------------------------------------------------
  var CONSENT_MODE = script.getAttribute('data-consent') || '';
  var PRIVACY_URL  = script.getAttribute('data-privacy-url') || '';

  function elvoraHasConsent() {
    if (document.cookie.split(';').some(function(c) { return c.trim().indexOf('elvora_consent=accepted') === 0; })) return true;
    if (window.elvora_consent === true) return true;
    if (typeof window.elvoraConsentGranted === 'function' && window.elvoraConsentGranted()) return true;
    return false;
  }

  function elvoraSetConsentCookie() {
    var d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    document.cookie = 'elvora_consent=accepted;expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  var consentBlocked = (CONSENT_MODE === 'required' && !elvoraHasConsent());

  // ── Styles ───────────────────────────────────────────────────────
  var fontStack = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';

  function injectStyles(accentColor) {
    var style = document.createElement('style');
    style.textContent = [
      '.ef-wrap{font-family:' + fontStack + ';max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px;box-sizing:border-box;opacity:0;transform:translateY(12px);transition:opacity .4s ease,transform .4s ease;}',
      '.ef-wrap.ef-visible{opacity:1;transform:translateY(0);}',
      '.ef-group{margin-bottom:20px;}',
      '.ef-label{display:block;font-size:14px;font-weight:600;color:#1f2937;margin-bottom:6px;}',
      '.ef-required{color:' + accentColor + ';margin-left:2px;}',
      '.ef-input,.ef-select,.ef-textarea{width:100%;box-sizing:border-box;padding:10px 14px;font-size:15px;font-family:' + fontStack + ';color:#1f2937;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:8px;outline:none;transition:border-color .2s ease,box-shadow .2s ease;}',
      '.ef-input:focus,.ef-select:focus,.ef-textarea:focus{border-color:' + accentColor + ';box-shadow:0 0 0 3px ' + accentColor + '26;background:#fff;}',
      '.ef-textarea{min-height:110px;resize:vertical;}',
      '.ef-select{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width=\'12\' height=\'8\' viewBox=\'0 0 12 8\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1.5L6 6.5L11 1.5\' stroke=\'%236b7280\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;}',
      '.ef-error{font-size:12px;color:#ef4444;margin-top:4px;display:none;}',
      '.ef-error.ef-show{display:block;}',
      '.ef-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 24px;font-size:16px;font-weight:600;font-family:' + fontStack + ';color:#fff;background:' + accentColor + ';border:none;border-radius:8px;cursor:pointer;transition:opacity .2s ease,transform .1s ease;}',
      '.ef-btn:hover{opacity:0.9;}',
      '.ef-btn:active{transform:scale(0.985);}',
      '.ef-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none;}',
      '.ef-spinner{display:inline-block;width:18px;height:18px;border:2.5px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:ef-spin .6s linear infinite;}',
      '@keyframes ef-spin{to{transform:rotate(360deg)}}',
      '.ef-success{text-align:center;padding:40px 20px;opacity:0;transform:translateY(8px);transition:opacity .4s ease,transform .4s ease;}',
      '.ef-success.ef-visible{opacity:1;transform:translateY(0);}',
      '.ef-success-icon{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:' + accentColor + '1a;display:flex;align-items:center;justify-content:center;}',
      '.ef-success-icon svg{width:28px;height:28px;}',
      '.ef-success-title{font-size:20px;font-weight:700;color:#1f2937;margin-bottom:8px;}',
      '.ef-success-msg{font-size:15px;color:#6b7280;line-height:1.5;}',
      '.ef-alert{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px;display:none;}',
      '.ef-alert.ef-show{display:block;}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Fetch form config ────────────────────────────────────────────
  var apiUrl = baseUrl.replace(/\/+$/, '') + '/api/contact-form';

  function fetchForm(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl + '?action=form&slug=' + encodeURIComponent(slug));
    xhr.onload = function() {
      if (xhr.status === 200) {
        try { cb(null, JSON.parse(xhr.responseText)); } catch(e) { cb(e); }
      } else {
        cb(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function() { cb(new Error('Network error')); };
    xhr.send();
  }

  function submitForm(payload, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      try { var res = JSON.parse(xhr.responseText); cb(null, res, xhr.status); } catch(e) { cb(e); }
    };
    xhr.onerror = function() { cb(new Error('Network error')); };
    xhr.send(JSON.stringify(payload));
  }

  // ── Render ───────────────────────────────────────────────────────
  function render(formConfig) {
    var form = formConfig.form;
    var color = form.color || '#8B5CF6';
    injectStyles(color);

    var container = document.querySelector(target);
    if (!container) return;

    var wrap = document.createElement('div');
    wrap.className = 'ef-wrap';

    // Alert for server errors
    var alert = document.createElement('div');
    alert.className = 'ef-alert';
    wrap.appendChild(alert);

    // Build form element
    var formEl = document.createElement('form');
    formEl.setAttribute('novalidate', '');

    var fields = form.fields || [];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var group = document.createElement('div');
      group.className = 'ef-group';

      var label = document.createElement('label');
      label.className = 'ef-label';
      label.textContent = f.label;
      if (f.required) {
        var star = document.createElement('span');
        star.className = 'ef-required';
        star.textContent = '*';
        label.appendChild(star);
      }
      group.appendChild(label);

      var input;
      if (f.type === 'textarea') {
        input = document.createElement('textarea');
        input.className = 'ef-textarea';
      } else if (f.type === 'select') {
        input = document.createElement('select');
        input.className = 'ef-select';
        var defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = 'Bitte waehlen...';
        defOpt.disabled = true;
        defOpt.selected = true;
        input.appendChild(defOpt);
        var opts = f.options || [];
        for (var j = 0; j < opts.length; j++) {
          var opt = document.createElement('option');
          opt.value = opts[j];
          opt.textContent = opts[j];
          input.appendChild(opt);
        }
      } else {
        input = document.createElement('input');
        input.className = 'ef-input';
        input.type = f.type || 'text';
      }

      input.setAttribute('data-field', f.name);
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.required = true;
      if (f.type !== 'select') input.className = input.className || 'ef-input';
      group.appendChild(input);

      var errEl = document.createElement('div');
      errEl.className = 'ef-error';
      errEl.setAttribute('data-error-for', f.name);
      group.appendChild(errEl);

      formEl.appendChild(group);
    }

    // DSGVO privacy checkbox
    var privacyGroup = document.createElement('div');
    privacyGroup.className = 'ef-group';
    var privacyLabel = document.createElement('label');
    privacyLabel.style.cssText = 'display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#374151;cursor:pointer;font-family:' + fontStack + ';line-height:1.5;';
    var privacyCheck = document.createElement('input');
    privacyCheck.type = 'checkbox';
    privacyCheck.required = true;
    privacyCheck.setAttribute('data-field', '_privacy_consent');
    privacyCheck.style.cssText = 'margin-top:3px;flex-shrink:0;accent-color:' + color + ';';
    var privacyText = document.createElement('span');
    if (PRIVACY_URL) {
      privacyText.innerHTML = 'Ich stimme der Verarbeitung meiner Daten gemäß der <a href="' + escapeHtml(PRIVACY_URL) + '" target="_blank" rel="noopener" style="color:' + color + ';text-decoration:underline;">Datenschutzerklärung</a> zu.';
    } else {
      privacyText.textContent = 'Ich stimme der Verarbeitung meiner Daten gemäß der Datenschutzerklärung zu.';
    }
    privacyLabel.appendChild(privacyCheck);
    privacyLabel.appendChild(privacyText);
    privacyGroup.appendChild(privacyLabel);
    var privacyErr = document.createElement('div');
    privacyErr.className = 'ef-error';
    privacyErr.setAttribute('data-error-for', '_privacy_consent');
    privacyGroup.appendChild(privacyErr);
    formEl.appendChild(privacyGroup);

    // Submit button
    var btnGroup = document.createElement('div');
    btnGroup.className = 'ef-group';
    btnGroup.style.marginBottom = '0';
    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'ef-btn';
    btn.textContent = form.submit_label || 'Absenden';
    btnGroup.appendChild(btn);
    formEl.appendChild(btnGroup);

    wrap.appendChild(formEl);
    container.appendChild(wrap);

    // Entrance animation
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        wrap.classList.add('ef-visible');
      });
    });

    // ── Validation & Submit ────────────────────────────────────────
    formEl.addEventListener('submit', function(e) {
      e.preventDefault();

      // Clear previous errors
      var errEls = wrap.querySelectorAll('.ef-error');
      for (var k = 0; k < errEls.length; k++) errEls[k].classList.remove('ef-show');
      alert.classList.remove('ef-show');

      // Collect & validate
      var data = {};
      var hasError = false;

      for (var k = 0; k < fields.length; k++) {
        var fd = fields[k];
        var inp = wrap.querySelector('[data-field="' + fd.name + '"]');
        var val = inp ? inp.value.trim() : '';
        data[fd.name] = val;

        var errBox = wrap.querySelector('[data-error-for="' + fd.name + '"]');

        if (fd.required && !val) {
          if (errBox) {
            errBox.textContent = fd.label + ' ist erforderlich.';
            errBox.classList.add('ef-show');
          }
          hasError = true;
        } else if (fd.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          if (errBox) {
            errBox.textContent = 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.';
            errBox.classList.add('ef-show');
          }
          hasError = true;
        }
      }

      // Validate privacy consent checkbox
      if (!privacyCheck.checked) {
        var privErrBox = wrap.querySelector('[data-error-for="_privacy_consent"]');
        if (privErrBox) {
          privErrBox.textContent = 'Bitte stimmen Sie der Datenschutzerklärung zu.';
          privErrBox.classList.add('ef-show');
        }
        hasError = true;
      }

      if (hasError) return;

      // Loading state
      btn.disabled = true;
      var origText = btn.textContent;
      btn.innerHTML = '<span class="ef-spinner"></span> Wird gesendet...';

      var consentText = (PRIVACY_URL
        ? 'Ich stimme der Verarbeitung meiner Daten gemäß der Datenschutzerklärung (' + PRIVACY_URL + ') zu.'
        : 'Ich stimme der Verarbeitung meiner Daten gemäß der Datenschutzerklärung zu.');

      submitForm({
        action: 'submit',
        slug: slug,
        data: data,
        page_url: window.location.href,
        consent_given: true,
        consent_text: consentText
      }, function(err, res, status) {
        btn.disabled = false;
        btn.textContent = origText;

        if (err || status >= 400) {
          alert.textContent = (res && res.error) ? res.error : 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.';
          alert.classList.add('ef-show');
          return;
        }

        // Success
        var successMsg = (res && res.success_message) || form.success_message || 'Vielen Dank!';

        // Check for redirect
        if (res && res.redirect_url) {
          window.location.href = res.redirect_url;
          return;
        }

        // Show success view
        wrap.innerHTML = '';
        var suc = document.createElement('div');
        suc.className = 'ef-success';
        suc.innerHTML =
          '<div class="ef-success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>' +
          '<div class="ef-success-title">Erfolgreich gesendet!</div>' +
          '<div class="ef-success-msg">' + escapeHtml(successMsg) + '</div>';
        wrap.appendChild(suc);

        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            suc.classList.add('ef-visible');
          });
        });
      });
    });
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Consent placeholder ──────────────────────────────────────────
  function showConsentPlaceholder() {
    var container = document.querySelector(target);
    if (!container) return;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'text-align:center;padding:40px 20px;font-family:' + fontStack + ';background:#fff;border:1px solid #e5e7eb;border-radius:12px;max-width:560px;margin:0 auto;';
    var msg = document.createElement('p');
    msg.style.cssText = 'font-size:15px;color:#374151;margin:0 0 16px;';
    msg.textContent = 'Bitte akzeptieren Sie die Cookies, um dieses Element zu laden.';
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:10px 24px;font-size:14px;font-weight:600;color:#fff;background:#8B5CF6;border:none;border-radius:8px;cursor:pointer;font-family:inherit;';
    btn.textContent = 'Cookies akzeptieren';
    btn.addEventListener('click', function() {
      elvoraSetConsentCookie();
      window.dispatchEvent(new CustomEvent('elvora:consent-granted'));
      container.removeChild(wrap);
      bootForm();
    });
    wrap.appendChild(msg);
    wrap.appendChild(btn);
    container.appendChild(wrap);
  }

  // ── Init ─────────────────────────────────────────────────────────
  function bootForm() {
    fetchForm(function(err, data) {
      if (err) {
        console.error('[Elvora Form] Failed to load form:', err);
        return;
      }
      render(data);
    });
  }

  if (consentBlocked) {
    showConsentPlaceholder();
    window.addEventListener('elvora:consent-granted', function onConsent() {
      window.removeEventListener('elvora:consent-granted', onConsent);
      consentBlocked = false;
      // Remove placeholder if still present and boot
      var container = document.querySelector(target);
      if (container) container.innerHTML = '';
      bootForm();
    });
  } else {
    bootForm();
  }
})();
