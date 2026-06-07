(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Read embed attributes
  // ---------------------------------------------------------------------------
  var script = document.currentScript;
  if (!script) return;

  var WIDGET_ID = script.getAttribute('data-widget-id') || '';
  var BASE_URL  = (script.getAttribute('data-url') || '').replace(/\/+$/, '');
  if (!BASE_URL || !WIDGET_ID) return;

  // ---------------------------------------------------------------------------
  // GDPR / DSGVO consent handling
  // ---------------------------------------------------------------------------
  var CONSENT_MODE = script.getAttribute('data-consent') || '';
  var PRIVACY_URL  = script.getAttribute('data-privacy-url') || '';

  function elvoraHasConsent() {
    // Check cookie
    if (document.cookie.split(';').some(function(c) { return c.trim().indexOf('elvora_consent=accepted') === 0; })) return true;
    // Check global flag
    if (window.elvora_consent === true) return true;
    // Check global function
    if (typeof window.elvoraConsentGranted === 'function' && window.elvoraConsentGranted()) return true;
    return false;
  }

  function elvoraSetConsentCookie() {
    var d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    document.cookie = 'elvora_consent=accepted;expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  var consentBlocked = (CONSENT_MODE === 'required' && !elvoraHasConsent());

  // ---------------------------------------------------------------------------
  // 2. Defaults & state
  // ---------------------------------------------------------------------------
  var CONFIG = {
    name: 'Chat',
    greeting_message: 'Hallo! Wie kann ich Ihnen helfen?',
    placeholder_text: 'Nachricht schreiben...',
    color: '#8B5CF6',
    position: 'bottom-right'
  };

  var state = {
    open: false,
    conversationId: localStorage.getItem('elvora_chat_' + WIDGET_ID) || null,
    visitorName: '',
    visitorEmail: '',
    messages: [],
    started: false,
    polling: null,
    unread: 0,
    lastSeenCount: 0
  };

  // ---------------------------------------------------------------------------
  // 3. Design tokens (Elvora dark theme)
  // ---------------------------------------------------------------------------
  var T = {
    bg:       '#0b0e14',
    bgAlt:    '#0f1219',
    card:     '#1a1d27',
    border:   '#232a38',
    borderL:  '#2c3546',
    text:     '#e2e8f0',
    textMut:  '#94a3b8',
    white:    '#ffffff',
    danger:   '#ef4444',
    radius:   '16px',
    radiusSm: '12px',
    font:     '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'
  };

  // ---------------------------------------------------------------------------
  // 4. Helpers
  // ---------------------------------------------------------------------------
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function relativeTime(iso) {
    if (!iso) return '';
    var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 10)  return 'gerade';
    if (diff < 60)  return 'vor ' + diff + ' Sek.';
    var m = Math.floor(diff / 60);
    if (m < 60)     return 'vor ' + m + ' Min.';
    var h = Math.floor(m / 60);
    if (h < 24)     return 'vor ' + h + ' Std.';
    var d = Math.floor(h / 24);
    return 'vor ' + d + (d === 1 ? ' Tag' : ' Tagen');
  }

  function ajax(method, url, body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        try {
          var data = JSON.parse(xhr.responseText);
          cb(null, data);
        } catch(e) {
          cb(e, null);
        }
      }
    };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  // ---------------------------------------------------------------------------
  // 5. Inject styles
  // ---------------------------------------------------------------------------
  var STYLE_ID = 'elvora-chat-styles-' + WIDGET_ID;
  if (!document.getElementById(STYLE_ID)) {
    var styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = [
      '#elvora-chat-bubble-' + WIDGET_ID + '{',
      '  position:fixed;z-index:99990;width:56px;height:56px;border-radius:50%;border:none;',
      '  cursor:pointer;display:flex;align-items:center;justify-content:center;',
      '  box-shadow:0 4px 20px rgba(0,0,0,0.35);transition:transform .25s ease,box-shadow .25s ease;',
      '}',
      '#elvora-chat-bubble-' + WIDGET_ID + ':hover{',
      '  transform:scale(1.08);box-shadow:0 6px 32px rgba(0,0,0,0.45);',
      '}',
      '#elvora-chat-bubble-' + WIDGET_ID + ' .elvora-unread{',
      '  position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;',
      '  background:#ef4444;border:2px solid #fff;display:none;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + '{',
      '  position:fixed;z-index:99991;width:380px;height:520px;',
      '  border-radius:' + T.radius + ';overflow:hidden;display:flex;flex-direction:column;',
      '  background:' + T.bg + ';border:1px solid ' + T.border + ';',
      '  box-shadow:0 25px 60px rgba(0,0,0,0.55);',
      '  opacity:0;transform:translateY(16px) scale(0.97);pointer-events:none;',
      '  transition:opacity .3s ease,transform .3s ease;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + '.elvora-open{',
      '  opacity:1;transform:translateY(0) scale(1);pointer-events:auto;',
      '}',
      '@media(max-width:639px){',
      '  #elvora-chat-window-' + WIDGET_ID + '{',
      '    width:100%!important;height:100%!important;top:0!important;left:0!important;',
      '    right:auto!important;bottom:auto!important;border-radius:0;',
      '  }',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-header{',
      '  display:flex;align-items:center;justify-content:space-between;padding:14px 16px;',
      '  background:' + T.bgAlt + ';border-bottom:1px solid ' + T.border + ';flex-shrink:0;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-header-title{',
      '  font-weight:600;font-size:15px;color:' + T.white + ';',
      '  font-family:' + T.font + ';display:flex;align-items:center;gap:8px;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-header-dot{',
      '  width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-close{',
      '  width:30px;height:30px;border-radius:8px;background:transparent;border:none;',
      '  cursor:pointer;display:flex;align-items:center;justify-content:center;',
      '  transition:background .15s ease;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-close:hover{background:rgba(255,255,255,0.08);}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-body{',
      '  flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:6px;',
      '  scrollbar-width:thin;scrollbar-color:' + T.border + ' transparent;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-body::-webkit-scrollbar{width:5px;}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-body::-webkit-scrollbar-track{background:transparent;}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-body::-webkit-scrollbar-thumb{background:' + T.border + ';border-radius:3px;}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-msg{',
      '  max-width:80%;padding:10px 14px;border-radius:' + T.radiusSm + ';',
      '  font-size:14px;line-height:1.5;word-break:break-word;',
      '  font-family:' + T.font + ';color:' + T.text + ';',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-msg-visitor{',
      '  align-self:flex-end;border-bottom-right-radius:4px;color:' + T.white + ';',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-msg-agent{',
      '  align-self:flex-start;background:' + T.card + ';border:1px solid ' + T.border + ';',
      '  border-bottom-left-radius:4px;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-msg-time{',
      '  font-size:11px;color:' + T.textMut + ';margin-top:3px;font-family:' + T.font + ';',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-msg-time.elvora-right{text-align:right;}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-footer{',
      '  padding:12px;border-top:1px solid ' + T.border + ';background:' + T.bgAlt + ';',
      '  display:flex;gap:8px;align-items:center;flex-shrink:0;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-input{',
      '  flex:1;height:40px;border-radius:10px;border:1px solid ' + T.border + ';',
      '  background:' + T.bg + ';color:' + T.text + ';padding:0 14px;font-size:14px;',
      '  font-family:' + T.font + ';outline:none;transition:border-color .15s ease;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-input:focus{border-color:' + T.borderL + ';}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-input::placeholder{color:' + T.textMut + ';}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-send{',
      '  width:40px;height:40px;border-radius:10px;border:none;cursor:pointer;',
      '  display:flex;align-items:center;justify-content:center;flex-shrink:0;',
      '  transition:opacity .15s ease;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-send:hover{opacity:0.85;}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-welcome{',
      '  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;',
      '  padding:32px 24px;text-align:center;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-welcome h3{',
      '  font-size:18px;font-weight:600;color:' + T.white + ';margin:0 0 6px;font-family:' + T.font + ';',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-welcome p{',
      '  font-size:14px;color:' + T.textMut + ';margin:0 0 24px;font-family:' + T.font + ';line-height:1.5;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-welcome input{',
      '  width:100%;height:42px;border-radius:10px;border:1px solid ' + T.border + ';',
      '  background:' + T.card + ';color:' + T.text + ';padding:0 14px;font-size:14px;',
      '  font-family:' + T.font + ';outline:none;margin-bottom:10px;transition:border-color .15s ease;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-welcome input:focus{border-color:' + T.borderL + ';}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-welcome input::placeholder{color:' + T.textMut + ';}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-welcome button.elvora-start{',
      '  width:100%;height:42px;border-radius:10px;border:none;cursor:pointer;',
      '  color:' + T.white + ';font-size:14px;font-weight:600;font-family:' + T.font + ';',
      '  margin-top:4px;transition:opacity .15s ease;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-welcome button.elvora-start:hover{opacity:0.85;}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-powered{',
      '  text-align:center;padding:6px 0;font-size:11px;color:' + T.textMut + ';',
      '  font-family:' + T.font + ';flex-shrink:0;background:' + T.bgAlt + ';',
      '  border-top:1px solid ' + T.border + ';',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-powered a{',
      '  color:' + T.textMut + ';text-decoration:none;',
      '}',
      '#elvora-chat-window-' + WIDGET_ID + ' .elvora-powered a:hover{color:' + T.text + ';}'
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  // ---------------------------------------------------------------------------
  // 6. SVG icons
  // ---------------------------------------------------------------------------
  var ICON_CHAT = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_CLOSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var ICON_SEND = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  // ---------------------------------------------------------------------------
  // 7. Build DOM
  // ---------------------------------------------------------------------------
  var bubble, unreadDot, chatWindow, headerTitle, body, footer, input;

  function positionStyle(pos) {
    switch (pos) {
      case 'bottom-left':  return 'bottom:24px;left:24px;';
      case 'top-right':    return 'top:24px;right:24px;';
      case 'top-left':     return 'top:24px;left:24px;';
      default:             return 'bottom:24px;right:24px;';
    }
  }

  function windowPositionStyle(pos) {
    switch (pos) {
      case 'bottom-left':  return 'bottom:90px;left:24px;';
      case 'top-right':    return 'top:90px;right:24px;';
      case 'top-left':     return 'top:90px;left:24px;';
      default:             return 'bottom:90px;right:24px;';
    }
  }

  function buildWidget() {
    var color = CONFIG.color;

    // --- Bubble ---
    bubble = document.createElement('button');
    bubble.id = 'elvora-chat-bubble-' + WIDGET_ID;
    bubble.style.cssText = positionStyle(CONFIG.position) + 'background:' + color + ';color:#fff;';
    bubble.innerHTML = ICON_CHAT + '<span class="elvora-unread"></span>';
    bubble.setAttribute('aria-label', 'Chat öffnen');
    unreadDot = bubble.querySelector('.elvora-unread');
    bubble.addEventListener('click', toggleChat);

    // --- Window ---
    chatWindow = document.createElement('div');
    chatWindow.id = 'elvora-chat-window-' + WIDGET_ID;
    chatWindow.style.cssText = windowPositionStyle(CONFIG.position);

    // Header
    var header = document.createElement('div');
    header.className = 'elvora-header';
    headerTitle = document.createElement('div');
    headerTitle.className = 'elvora-header-title';
    headerTitle.innerHTML = '<span class="elvora-header-dot"></span>' + esc(CONFIG.name);
    var closeBtn = document.createElement('button');
    closeBtn.className = 'elvora-close';
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.style.color = T.textMut;
    closeBtn.setAttribute('aria-label', 'Chat schließen');
    closeBtn.addEventListener('click', toggleChat);
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    // Body
    body = document.createElement('div');
    body.className = 'elvora-body';

    // Footer (input bar) — hidden initially on welcome screen
    footer = document.createElement('div');
    footer.className = 'elvora-footer';
    footer.style.display = 'none';
    input = document.createElement('input');
    input.className = 'elvora-input';
    input.placeholder = CONFIG.placeholder_text;
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendMessage(); });
    var sendBtn = document.createElement('button');
    sendBtn.className = 'elvora-send';
    sendBtn.style.background = color;
    sendBtn.style.color = '#fff';
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.addEventListener('click', sendMessage);
    footer.appendChild(input);
    footer.appendChild(sendBtn);

    // Powered by
    var powered = document.createElement('div');
    powered.className = 'elvora-powered';
    powered.innerHTML = 'Powered by <a href="https://elvora.de" target="_blank" rel="noopener">Elvora</a>';

    chatWindow.appendChild(header);
    chatWindow.appendChild(body);
    chatWindow.appendChild(footer);
    chatWindow.appendChild(powered);

    document.body.appendChild(bubble);
    document.body.appendChild(chatWindow);

    // Show welcome or restore conversation
    if (state.conversationId) {
      showConversationView();
      loadMessages();
    } else {
      showWelcomeScreen();
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Welcome screen
  // ---------------------------------------------------------------------------
  function showWelcomeScreen() {
    state.started = false;
    footer.style.display = 'none';
    body.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'elvora-welcome';

    var icon = document.createElement('div');
    icon.style.cssText = 'width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:16px;color:#fff;background:' + CONFIG.color + ';';
    icon.innerHTML = ICON_CHAT;

    var h3 = document.createElement('h3');
    h3.textContent = CONFIG.name;

    var p = document.createElement('p');
    p.textContent = CONFIG.greeting_message;

    var nameInput = document.createElement('input');
    nameInput.placeholder = 'Ihr Name';
    nameInput.type = 'text';

    var emailInput = document.createElement('input');
    emailInput.placeholder = 'E-Mail (optional)';
    emailInput.type = 'email';

    var startBtn = document.createElement('button');
    startBtn.className = 'elvora-start';
    startBtn.style.background = CONFIG.color;
    startBtn.textContent = 'Chat starten';
    startBtn.addEventListener('click', function() {
      var name = nameInput.value.trim();
      if (!name) { nameInput.style.borderColor = T.danger; nameInput.focus(); return; }
      nameInput.style.borderColor = '';
      state.visitorName = name;
      state.visitorEmail = emailInput.value.trim();
      startConversation();
    });

    emailInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') startBtn.click(); });
    nameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') emailInput.focus(); });

    wrap.appendChild(icon);
    wrap.appendChild(h3);
    wrap.appendChild(p);
    wrap.appendChild(nameInput);
    wrap.appendChild(emailInput);
    wrap.appendChild(startBtn);

    // Datenschutz link
    if (PRIVACY_URL) {
      var privacyLink = document.createElement('a');
      privacyLink.href = PRIVACY_URL;
      privacyLink.target = '_blank';
      privacyLink.rel = 'noopener';
      privacyLink.textContent = 'Datenschutz';
      privacyLink.style.cssText = 'display:block;margin-top:12px;font-size:12px;color:' + T.textMut + ';text-decoration:none;font-family:' + T.font + ';';
      privacyLink.addEventListener('mouseenter', function() { privacyLink.style.color = T.text; });
      privacyLink.addEventListener('mouseleave', function() { privacyLink.style.color = T.textMut; });
      wrap.appendChild(privacyLink);
    }

    body.appendChild(wrap);
  }

  // ---------------------------------------------------------------------------
  // 9. Conversation view
  // ---------------------------------------------------------------------------
  function showConversationView() {
    state.started = true;
    footer.style.display = 'flex';
    body.innerHTML = '';
    body.style.justifyContent = '';
    renderMessages();
  }

  function renderMessages() {
    body.innerHTML = '';
    state.messages.forEach(function(msg) {
      appendMessageBubble(msg);
    });
    scrollToBottom();
  }

  function appendMessageBubble(msg) {
    var isVisitor = msg.sender === 'visitor';

    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;' + (isVisitor ? 'align-items:flex-end;' : 'align-items:flex-start;');

    var bubble = document.createElement('div');
    bubble.className = 'elvora-msg ' + (isVisitor ? 'elvora-msg-visitor' : 'elvora-msg-agent');
    if (isVisitor) {
      bubble.style.background = CONFIG.color;
    }
    bubble.innerHTML = esc(msg.text);

    var time = document.createElement('div');
    time.className = 'elvora-msg-time' + (isVisitor ? ' elvora-right' : '');
    time.textContent = relativeTime(msg.created_at);

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    body.appendChild(wrap);
  }

  function scrollToBottom() {
    requestAnimationFrame(function() {
      body.scrollTop = body.scrollHeight;
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Toggle open / close
  // ---------------------------------------------------------------------------
  function toggleChat() {
    state.open = !state.open;
    if (state.open) {
      chatWindow.classList.add('elvora-open');
      // Reset unread
      state.unread = 0;
      state.lastSeenCount = state.messages.length;
      unreadDot.style.display = 'none';
      if (state.started) {
        input.focus();
        scrollToBottom();
      }
      // Start polling when open if conversation exists
      if (state.conversationId) startPolling();
    } else {
      chatWindow.classList.remove('elvora-open');
      // Keep polling even when closed to detect unread
    }
  }

  // ---------------------------------------------------------------------------
  // 11. API calls
  // ---------------------------------------------------------------------------
  function startConversation() {
    ajax('POST', BASE_URL + '/api/chat', {
      action: 'new_conversation',
      widget_id: WIDGET_ID,
      visitor_name: state.visitorName,
      visitor_email: state.visitorEmail,
      page_url: window.location.href,
      consent_given: true,
      consent_note: 'User has consented to data processing (DSGVO/GDPR)'
    }, function(err, data) {
      if (err || !data || !data.conversation_id) return;
      state.conversationId = data.conversation_id;
      localStorage.setItem('elvora_chat_' + WIDGET_ID, state.conversationId);

      // Pre-populate with greeting if server returned messages
      if (data.messages && data.messages.length) {
        state.messages = data.messages;
      } else if (CONFIG.greeting_message) {
        // Show greeting as the first bot message
        state.messages = [{
          sender: 'agent',
          text: CONFIG.greeting_message,
          created_at: new Date().toISOString()
        }];
      }

      showConversationView();
      startPolling();
    });
  }

  function sendMessage() {
    var text = input.value.trim();
    if (!text || !state.conversationId) return;

    var msg = {
      sender: 'visitor',
      text: text,
      created_at: new Date().toISOString()
    };
    state.messages.push(msg);
    appendMessageBubble(msg);
    scrollToBottom();
    input.value = '';

    ajax('POST', BASE_URL + '/api/chat', {
      action: 'send_message',
      conversation_id: state.conversationId,
      widget_id: WIDGET_ID,
      text: text
    }, function(err, data) {
      // If the server returns an immediate bot reply, show it
      if (!err && data && data.message) {
        state.messages.push(data.message);
        appendMessageBubble(data.message);
        scrollToBottom();
      }
    });
  }

  function loadMessages() {
    if (!state.conversationId) return;
    ajax('GET', BASE_URL + '/api/chat?action=messages&conversation_id=' + encodeURIComponent(state.conversationId), null, function(err, data) {
      if (err || !data || !data.messages) return;
      state.messages = data.messages;
      if (state.started) renderMessages();
      startPolling();
    });
  }

  // ---------------------------------------------------------------------------
  // 12. Polling
  // ---------------------------------------------------------------------------
  function startPolling() {
    if (state.polling) return;
    state.polling = setInterval(pollMessages, 3000);
  }

  function stopPolling() {
    if (state.polling) {
      clearInterval(state.polling);
      state.polling = null;
    }
  }

  function pollMessages() {
    if (!state.conversationId) return;
    ajax('GET', BASE_URL + '/api/chat?action=messages&conversation_id=' + encodeURIComponent(state.conversationId), null, function(err, data) {
      if (err || !data || !data.messages) return;

      var oldLen = state.messages.length;
      state.messages = data.messages;

      if (data.messages.length > oldLen) {
        // Count new non-visitor messages
        var newMsgs = data.messages.slice(oldLen);
        var newAgentCount = 0;
        newMsgs.forEach(function(m) {
          if (m.sender !== 'visitor') newAgentCount++;
        });

        if (state.open && state.started) {
          // Re-render and scroll
          renderMessages();
          state.lastSeenCount = state.messages.length;
        } else if (newAgentCount > 0) {
          // Not open — show unread dot
          state.unread += newAgentCount;
          unreadDot.style.display = 'block';
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 13. Fetch widget config & boot
  // ---------------------------------------------------------------------------
  function init() {
    ajax('GET', BASE_URL + '/api/chat?action=widget&id=' + encodeURIComponent(WIDGET_ID), null, function(err, data) {
      if (!err && data) {
        if (data.name)              CONFIG.name = data.name;
        if (data.greeting_message)  CONFIG.greeting_message = data.greeting_message;
        if (data.placeholder_text)  CONFIG.placeholder_text = data.placeholder_text;
        if (data.color)             CONFIG.color = data.color;
        if (data.position)          CONFIG.position = data.position;
      }
      buildWidget();
    });
  }

  // Boot when DOM is ready (only if consent is not blocked)
  if (consentBlocked) {
    // Don't show the bubble at all — listen for consent event to activate later
    window.addEventListener('elvora:consent-granted', function onConsent() {
      window.removeEventListener('elvora:consent-granted', onConsent);
      consentBlocked = false;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    });
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
