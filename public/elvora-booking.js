(function() {
  var script = document.currentScript;
  if (!script) return;

  var url = script.getAttribute('data-url') || '';
  var type = script.getAttribute('data-type') || 'inline';
  var color = script.getAttribute('data-color') || '#8B5CF6';
  var text = script.getAttribute('data-text') || 'Termin buchen';
  var target = script.getAttribute('data-target') || '#elvora-booking';
  var slug = script.getAttribute('data-slug') || '';

  if (!url) return;

  var src = url + (slug ? '/' + slug : '') + '?embed=1';

  // ---------------------------------------------------------------------------
  // GDPR / DSGVO consent handling
  // ---------------------------------------------------------------------------
  var CONSENT_MODE = script.getAttribute('data-consent') || '';

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

  function elvoraConsentPlaceholder(targetEl) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'text-align:center;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;';
    var msg = document.createElement('p');
    msg.style.cssText = 'font-size:15px;color:#374151;margin:0 0 16px;';
    msg.textContent = 'Bitte akzeptieren Sie die Cookies, um dieses Element zu laden.';
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:10px 24px;font-size:14px;font-weight:600;color:#fff;background:' + color + ';border:none;border-radius:8px;cursor:pointer;font-family:inherit;';
    btn.textContent = 'Cookies akzeptieren';
    btn.addEventListener('click', function() {
      elvoraSetConsentCookie();
      window.dispatchEvent(new CustomEvent('elvora:consent-granted'));
      // Replace placeholder with actual widget
      wrap.parentNode.removeChild(wrap);
      bootWidget();
    });
    wrap.appendChild(msg);
    wrap.appendChild(btn);
    targetEl.appendChild(wrap);
  }

  var consentBlocked = (CONSENT_MODE === 'required' && !elvoraHasConsent());

  function bootWidget() {

  var STYLES = {
    overlay: 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:99998;opacity:0;transition:opacity .3s ease;display:none;',
    modal: 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.95);width:min(95vw,560px);height:min(90vh,750px);border-radius:16px;overflow:hidden;z-index:99999;opacity:0;transition:all .3s ease;display:none;box-shadow:0 25px 60px rgba(0,0,0,0.5);',
    iframe: 'width:100%;height:100%;border:none;background:#0a0a0f;',
    inlineFrame: 'width:100%;border:none;background:#0a0a0f;border-radius:12px;min-height:500px;',
    badge: 'position:fixed;bottom:24px;right:24px;z-index:99997;border:none;cursor:pointer;padding:0 20px;height:48px;border-radius:24px;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:transform .2s ease,box-shadow .2s ease;',
    button: 'border:none;cursor:pointer;padding:0 24px;height:44px;border-radius:10px;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;transition:transform .15s ease,box-shadow .15s ease;',
    closeBtn: 'position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:100000;transition:background .2s ease;',
  };

  var calendarSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  function createOverlay() {
    var overlay = document.createElement('div');
    overlay.style.cssText = STYLES.overlay;
    overlay.addEventListener('click', closeModal);

    var modal = document.createElement('div');
    modal.style.cssText = STYLES.modal;

    var close = document.createElement('button');
    close.style.cssText = STYLES.closeBtn;
    close.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    close.addEventListener('click', closeModal);
    close.addEventListener('mouseenter', function() { close.style.background = 'rgba(255,255,255,0.2)'; });
    close.addEventListener('mouseleave', function() { close.style.background = 'rgba(255,255,255,0.1)'; });

    var iframe = document.createElement('iframe');
    iframe.style.cssText = STYLES.iframe;
    iframe.src = src;
    iframe.allow = 'clipboard-write';

    modal.appendChild(close);
    modal.appendChild(iframe);
    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    return { overlay: overlay, modal: modal };
  }

  var els = null;

  function openModal() {
    if (!els) els = createOverlay();
    els.overlay.style.display = 'block';
    els.modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        els.overlay.style.opacity = '1';
        els.modal.style.opacity = '1';
        els.modal.style.transform = 'translate(-50%,-50%) scale(1)';
      });
    });
  }

  function closeModal() {
    if (!els) return;
    els.overlay.style.opacity = '0';
    els.modal.style.opacity = '0';
    els.modal.style.transform = 'translate(-50%,-50%) scale(0.95)';
    document.body.style.overflow = '';
    setTimeout(function() {
      els.overlay.style.display = 'none';
      els.modal.style.display = 'none';
    }, 300);
  }

  if (type === 'inline') {
    var container = document.querySelector(target);
    if (!container) return;
    var iframe = document.createElement('iframe');
    iframe.style.cssText = STYLES.inlineFrame;
    iframe.src = src;
    iframe.allow = 'clipboard-write';
    container.appendChild(iframe);

    window.addEventListener('message', function(e) {
      try {
        var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data.type === 'elvora-booking-height') {
          iframe.style.height = data.height + 'px';
        }
      } catch(err) {}
    });
  }

  if (type === 'popup') {
    var btn = document.createElement('button');
    btn.style.cssText = STYLES.button;
    btn.style.background = color;
    btn.innerHTML = calendarSvg + text;
    btn.addEventListener('click', openModal);
    btn.addEventListener('mouseenter', function() { btn.style.transform = 'translateY(-1px)'; btn.style.boxShadow = '0 4px 16px ' + color + '40'; });
    btn.addEventListener('mouseleave', function() { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = 'none'; });
    script.parentNode.insertBefore(btn, script.nextSibling);
  }

  if (type === 'badge') {
    var badge = document.createElement('button');
    badge.style.cssText = STYLES.badge;
    badge.style.background = color;
    badge.innerHTML = calendarSvg + text;
    badge.addEventListener('click', openModal);
    badge.addEventListener('mouseenter', function() { badge.style.transform = 'scale(1.05)'; badge.style.boxShadow = '0 6px 30px ' + color + '50'; });
    badge.addEventListener('mouseleave', function() { badge.style.transform = 'scale(1)'; badge.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; });
    document.body.appendChild(badge);
  }

  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data.type === 'elvora-booking-success') {
        if (type !== 'inline') {
          setTimeout(closeModal, 3000);
        }
      }
    } catch(err) {}
  });

  } // end bootWidget

  // ---------------------------------------------------------------------------
  // Consent gate: show placeholder or boot widget
  // ---------------------------------------------------------------------------
  if (consentBlocked) {
    // For inline type, show placeholder in the target container
    if (type === 'inline') {
      var container = document.querySelector(target);
      if (container) {
        elvoraConsentPlaceholder(container);
      }
    }
    // For popup/badge types, just don't render the trigger — listen for consent event
    window.addEventListener('elvora:consent-granted', function onConsent() {
      window.removeEventListener('elvora:consent-granted', onConsent);
      consentBlocked = false;
      bootWidget();
    });
  } else {
    bootWidget();
  }
})();
