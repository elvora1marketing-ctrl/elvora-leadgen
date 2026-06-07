(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Read embed attributes
  // ---------------------------------------------------------------------------
  var script = document.currentScript;
  if (!script) return;

  var SLUG     = script.getAttribute('data-slug') || 'default';
  var BASE_URL = (script.getAttribute('data-url') || '').replace(/\/+$/, '');
  var POSITION = script.getAttribute('data-position') || 'bottom-left';
  if (!BASE_URL) return;

  // ---------------------------------------------------------------------------
  // 2. Helpers
  // ---------------------------------------------------------------------------
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function starSVG(filled) {
    var fill = filled ? '#FBBF24' : '#D1D5DB';
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + fill + '" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">' +
      '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
    '</svg>';
  }

  function starsHTML(rating, size) {
    var sz = size || 16;
    var html = '';
    for (var i = 1; i <= 5; i++) {
      var fill = i <= rating ? '#FBBF24' : '#D1D5DB';
      html += '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="' + fill + '" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">' +
        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
      '</svg>';
    }
    return html;
  }

  function googleBadge() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;margin-right:3px;">' +
      '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>' +
      '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
      '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>' +
      '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>' +
    '</svg>';
  }

  // ---------------------------------------------------------------------------
  // 3. Fetch data & render
  // ---------------------------------------------------------------------------
  var xhr = new XMLHttpRequest();
  xhr.open('GET', BASE_URL + '/api/reviews?action=widget&slug=' + encodeURIComponent(SLUG));
  xhr.onload = function() {
    if (xhr.status !== 200) return;
    try {
      var data = JSON.parse(xhr.responseText);
      render(data.widget, data.reviews || []);
    } catch(e) { console.error('[ElvoraReviews] Parse error', e); }
  };
  xhr.send();

  function render(widget, reviews) {
    if (!widget || reviews.length === 0) return;

    var mode       = widget.display_mode || 'carousel';
    var theme      = widget.theme || 'light';
    var accentColor= widget.color || '#8B5CF6';
    var showSummary= widget.show_rating_summary;

    // Compute stats
    var totalRating = 0;
    var dist = {5:0, 4:0, 3:0, 2:0, 1:0};
    for (var i = 0; i < reviews.length; i++) {
      totalRating += reviews[i].rating;
      dist[reviews[i].rating] = (dist[reviews[i].rating] || 0) + 1;
    }
    var avgRating = (totalRating / reviews.length).toFixed(1);

    // Theme colors
    var bg, cardBg, textColor, textMuted, borderColor, shadowColor;
    if (theme === 'dark') {
      bg = '#1a1d27'; cardBg = '#232a38'; textColor = '#e2e8f0';
      textMuted = '#94a3b8'; borderColor = '#2c3546'; shadowColor = 'rgba(0,0,0,0.3)';
    } else {
      bg = '#ffffff'; cardBg = '#f8fafc'; textColor = '#1e293b';
      textMuted = '#64748b'; borderColor = '#e2e8f0'; shadowColor = 'rgba(0,0,0,0.08)';
    }

    // ---------------------------------------------------------------------------
    // Inject styles
    // ---------------------------------------------------------------------------
    var styleId = 'elvora-reviews-styles';
    if (!document.getElementById(styleId)) {
      var style = document.createElement('style');
      style.id = styleId;
      style.textContent = '\n' +
        '.elvora-rw * { box-sizing: border-box; margin: 0; padding: 0; }\n' +
        '.elvora-rw { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; line-height: 1.5; }\n' +
        '.elvora-rw-summary { display: flex; align-items: center; gap: 24px; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px; }\n' +
        '.elvora-rw-summary-left { text-align: center; min-width: 80px; }\n' +
        '.elvora-rw-summary-num { font-size: 42px; font-weight: 700; line-height: 1; }\n' +
        '.elvora-rw-summary-label { font-size: 13px; margin-top: 4px; }\n' +
        '.elvora-rw-summary-bars { flex: 1; }\n' +
        '.elvora-rw-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 12px; }\n' +
        '.elvora-rw-bar-label { width: 24px; text-align: right; flex-shrink: 0; }\n' +
        '.elvora-rw-bar-track { flex: 1; height: 8px; border-radius: 4px; overflow: hidden; }\n' +
        '.elvora-rw-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }\n' +
        '.elvora-rw-bar-count { width: 20px; text-align: left; flex-shrink: 0; }\n' +
        '.elvora-rw-card { padding: 20px; border-radius: 12px; border: 1px solid; transition: transform 0.2s, box-shadow 0.2s; }\n' +
        '.elvora-rw-card:hover { transform: translateY(-2px); }\n' +
        '.elvora-rw-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }\n' +
        '.elvora-rw-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 16px; flex-shrink: 0; }\n' +
        '.elvora-rw-author { font-weight: 600; font-size: 14px; }\n' +
        '.elvora-rw-date { font-size: 12px; }\n' +
        '.elvora-rw-text { font-size: 14px; line-height: 1.6; }\n' +
        '.elvora-rw-source { display: inline-flex; align-items: center; font-size: 11px; margin-top: 10px; padding: 2px 8px; border-radius: 12px; }\n' +
        /* Carousel */
        '.elvora-rw-carousel { position: relative; overflow: hidden; }\n' +
        '.elvora-rw-track { display: flex; gap: 16px; transition: transform 0.4s ease; }\n' +
        '.elvora-rw-track .elvora-rw-card { min-width: 320px; max-width: 360px; flex-shrink: 0; }\n' +
        '.elvora-rw-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 2; transition: opacity 0.2s; font-size: 18px; }\n' +
        '.elvora-rw-arrow:hover { opacity: 0.9; }\n' +
        '.elvora-rw-arrow-left { left: 4px; }\n' +
        '.elvora-rw-arrow-right { right: 4px; }\n' +
        /* Grid */
        '.elvora-rw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }\n' +
        /* Wall (masonry via columns) */
        '.elvora-rw-wall { column-count: 3; column-gap: 16px; }\n' +
        '.elvora-rw-wall .elvora-rw-card { break-inside: avoid; margin-bottom: 16px; display: inline-block; width: 100%; }\n' +
        /* Badge */
        '.elvora-rw-badge-btn { position: fixed; z-index: 9999; display: flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 24px; border: none; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s, box-shadow 0.2s; }\n' +
        '.elvora-rw-badge-btn:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }\n' +
        '.elvora-rw-badge-popover { position: fixed; z-index: 10000; width: 360px; max-height: 480px; overflow-y: auto; border-radius: 16px; border: 1px solid; padding: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); display: none; }\n' +
        '.elvora-rw-badge-popover.open { display: block; }\n' +
        /* Responsive */
        '@media (max-width: 768px) {\n' +
        '  .elvora-rw-track .elvora-rw-card { min-width: 280px; }\n' +
        '  .elvora-rw-grid { grid-template-columns: 1fr; }\n' +
        '  .elvora-rw-wall { column-count: 1; }\n' +
        '  .elvora-rw-summary { flex-direction: column; gap: 12px; }\n' +
        '  .elvora-rw-badge-popover { width: calc(100vw - 32px); left: 16px !important; right: 16px !important; }\n' +
        '}\n' +
        '@media (min-width: 769px) and (max-width: 1024px) {\n' +
        '  .elvora-rw-wall { column-count: 2; }\n' +
        '}\n';
      document.head.appendChild(style);
    }

    // ---------------------------------------------------------------------------
    // Build HTML
    // ---------------------------------------------------------------------------
    var container = document.getElementById('elvora-reviews');
    if (!container && mode !== 'badge') return;

    // Summary section
    function buildSummary() {
      if (!showSummary) return '';
      var maxCount = Math.max(dist[5], dist[4], dist[3], dist[2], dist[1], 1);
      var bars = '';
      for (var s = 5; s >= 1; s--) {
        var pct = Math.round((dist[s] / maxCount) * 100);
        bars += '<div class="elvora-rw-bar-row">' +
          '<span class="elvora-rw-bar-label" style="color:' + textMuted + ';">' + s + '</span>' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="#FBBF24" style="flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
          '<div class="elvora-rw-bar-track" style="background:' + borderColor + ';">' +
            '<div class="elvora-rw-bar-fill" style="width:' + pct + '%;background:' + accentColor + ';"></div>' +
          '</div>' +
          '<span class="elvora-rw-bar-count" style="color:' + textMuted + ';">' + dist[s] + '</span>' +
        '</div>';
      }
      return '<div class="elvora-rw-summary" style="background:' + cardBg + ';border:1px solid ' + borderColor + ';">' +
        '<div class="elvora-rw-summary-left">' +
          '<div class="elvora-rw-summary-num" style="color:' + textColor + ';">' + avgRating + '</div>' +
          '<div style="margin:4px 0;">' + starsHTML(Math.round(avgRating), 18) + '</div>' +
          '<div class="elvora-rw-summary-label" style="color:' + textMuted + ';">' + reviews.length + ' Bewertung' + (reviews.length !== 1 ? 'en' : '') + '</div>' +
        '</div>' +
        '<div class="elvora-rw-summary-bars">' + bars + '</div>' +
      '</div>';
    }

    // Single review card
    function buildCard(r) {
      var initials = r.author_name.split(' ').map(function(n){return n.charAt(0);}).join('').toUpperCase().substring(0,2);
      var dateStr = '';
      if (r.review_date) {
        try {
          var d = new Date(r.review_date);
          dateStr = d.toLocaleDateString('de-DE', {year:'numeric', month:'short', day:'numeric'});
        } catch(e) { dateStr = r.review_date; }
      }
      var sourceBadge = '';
      if (r.source === 'google') {
        sourceBadge = '<span class="elvora-rw-source" style="background:' + (theme==='dark'?'rgba(66,133,244,0.15)':'rgba(66,133,244,0.1)') + ';color:#4285F4;">' +
          googleBadge() + 'Google' +
        '</span>';
      }
      return '<div class="elvora-rw-card" style="background:' + cardBg + ';border-color:' + borderColor + ';box-shadow:0 2px 8px ' + shadowColor + ';">' +
        '<div class="elvora-rw-card-header">' +
          '<div class="elvora-rw-avatar" style="background:' + accentColor + '20;color:' + accentColor + ';">' + initials + '</div>' +
          '<div>' +
            '<div class="elvora-rw-author" style="color:' + textColor + ';">' + esc(r.author_name) + '</div>' +
            (dateStr ? '<div class="elvora-rw-date" style="color:' + textMuted + ';">' + dateStr + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:8px;">' + starsHTML(r.rating) + '</div>' +
        (r.text ? '<p class="elvora-rw-text" style="color:' + textColor + ';">' + esc(r.text) + '</p>' : '') +
        sourceBadge +
      '</div>';
    }

    // ---- BADGE MODE ----
    if (mode === 'badge') {
      // Floating badge button
      var btn = document.createElement('div');
      btn.className = 'elvora-rw-badge-btn';
      btn.style.cssText = 'color:#fff;background:' + accentColor + ';';
      // Position
      if (POSITION.indexOf('right') !== -1) {
        btn.style.right = '20px';
      } else {
        btn.style.left = '20px';
      }
      if (POSITION.indexOf('top') !== -1) {
        btn.style.top = '20px';
      } else {
        btn.style.bottom = '20px';
      }
      btn.innerHTML = starsHTML(Math.round(avgRating), 14) + ' ' + avgRating + ' <span style="font-weight:400;opacity:0.85;">(' + reviews.length + ' Bewertungen)</span>';
      document.body.appendChild(btn);

      // Popover
      var pop = document.createElement('div');
      pop.className = 'elvora-rw-badge-popover';
      pop.style.cssText = 'background:' + bg + ';border-color:' + borderColor + ';';
      // Position popover relative to badge
      if (POSITION.indexOf('right') !== -1) {
        pop.style.right = '20px';
      } else {
        pop.style.left = '20px';
      }
      if (POSITION.indexOf('top') !== -1) {
        pop.style.top = '70px';
      } else {
        pop.style.bottom = '60px';
      }
      var popHTML = buildSummary();
      for (var p = 0; p < reviews.length; p++) {
        popHTML += '<div style="margin-bottom:12px;">' + buildCard(reviews[p]) + '</div>';
      }
      pop.innerHTML = popHTML;
      document.body.appendChild(pop);

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        pop.classList.toggle('open');
      });
      document.addEventListener('click', function() {
        pop.classList.remove('open');
      });
      pop.addEventListener('click', function(e) { e.stopPropagation(); });

      // Also render in container if present
      if (container) {
        container.className = 'elvora-rw';
        container.style.cssText = 'background:' + bg + ';padding:24px;border-radius:16px;';
        container.innerHTML = buildSummary();
      }
      return;
    }

    // ---- CONTAINER MODES (carousel, grid, wall) ----
    if (!container) return;
    container.className = 'elvora-rw';
    container.style.cssText = 'background:' + bg + ';padding:24px;border-radius:16px;';

    var html = buildSummary();

    if (mode === 'carousel') {
      var cards = '';
      for (var c = 0; c < reviews.length; c++) {
        cards += buildCard(reviews[c]);
      }
      html += '<div class="elvora-rw-carousel">' +
        '<div class="elvora-rw-track" id="elvora-rw-track">' + cards + '</div>' +
        '<button class="elvora-rw-arrow elvora-rw-arrow-left" id="elvora-rw-left" style="background:' + accentColor + ';color:#fff;" aria-label="Zurueck">&#8249;</button>' +
        '<button class="elvora-rw-arrow elvora-rw-arrow-right" id="elvora-rw-right" style="background:' + accentColor + ';color:#fff;" aria-label="Weiter">&#8250;</button>' +
      '</div>';
      container.innerHTML = html;

      // Carousel logic
      var track = document.getElementById('elvora-rw-track');
      var leftBtn = document.getElementById('elvora-rw-left');
      var rightBtn = document.getElementById('elvora-rw-right');
      var pos = 0;
      var cardW = 336; // 320 + 16 gap
      var maxScroll = Math.max(0, (reviews.length * cardW) - track.parentElement.offsetWidth);
      var autoInterval = null;
      var paused = false;

      function slide(dir) {
        pos += dir * cardW;
        if (pos < 0) pos = 0;
        if (pos > maxScroll) pos = 0; // loop
        track.style.transform = 'translateX(-' + pos + 'px)';
      }

      leftBtn.addEventListener('click', function() { slide(-1); });
      rightBtn.addEventListener('click', function() { slide(1); });

      // Auto-scroll
      function startAuto() {
        autoInterval = setInterval(function() {
          if (!paused) slide(1);
        }, 5000);
      }
      startAuto();

      // Pause on hover
      var carousel = track.parentElement;
      carousel.addEventListener('mouseenter', function() { paused = true; });
      carousel.addEventListener('mouseleave', function() { paused = false; });

    } else if (mode === 'grid') {
      var gridCards = '';
      for (var g = 0; g < reviews.length; g++) {
        gridCards += buildCard(reviews[g]);
      }
      html += '<div class="elvora-rw-grid">' + gridCards + '</div>';
      container.innerHTML = html;

    } else if (mode === 'wall') {
      var wallCards = '';
      for (var w = 0; w < reviews.length; w++) {
        wallCards += buildCard(reviews[w]);
      }
      html += '<div class="elvora-rw-wall">' + wallCards + '</div>';
      container.innerHTML = html;
    }
  }

})();
