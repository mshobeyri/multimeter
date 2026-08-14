(function (global) {
  var SHAFT =
      'M 55.500 31.500 C 55.500 31.500, -11.319 37.178, -9.858 -2.485 ' +
      'C -9.092 -23.274, 24.405 -27.208, 29.908 -5.761 ' +
      'C 31.028 -1.395, 32.675 20.931, -1.750 24.500 ' +
      'C -31.882 27.624, -52.464 -9.656, -51.500 -18.335 ' +
      'C -51.375 -18.835, -36.250 -9.375, -36.250 -9.375';
  var HEAD = 'M -59.969 -3.304 L -51.469 -18.304';
  var TIP_X = 6;
  var TIP_Y = 13;
  var TAIL_X = 145;
  var TAIL_Y = 73;
  var WIDTH = 132;
  var HEIGHT = 74;
  var COLOR = '#3b82f6';

  var overlay;
  var pending = '';
  var retryTimer;
  var currentEl;

  function ensureStyle() {
    if (document.getElementById('mmt-coach-arrow-style')) {
      return;
    }
    var style = document.createElement('style');
    style.id = 'mmt-coach-arrow-style';
    style.textContent =
        '#mmt-coach-arrow{position:fixed;z-index:10000;width:' + WIDTH +
        'px;height:' + HEIGHT +
        'px;pointer-events:none;overflow:visible;}' +
        '#mmt-coach-arrow svg{width:100%;height:100%;overflow:visible;display:block;}' +
        '#mmt-coach-arrow .mmt-coach-shaft,#mmt-coach-arrow .mmt-coach-head{' +
        'fill:none;stroke:' + COLOR +
        ';stroke-width:5;stroke-linecap:round;stroke-linejoin:round;' +
        'stroke-dasharray:1;stroke-dashoffset:1;}' +
        '#mmt-coach-arrow .mmt-coach-shaft{animation:mmtCoachShaft 1.4s ease-in-out infinite;}' +
        '#mmt-coach-arrow .mmt-coach-head{animation:mmtCoachHead 1.4s ease-in-out infinite;}' +
        '@keyframes mmtCoachShaft{0%{stroke-dashoffset:1;}62%{stroke-dashoffset:0;}100%{stroke-dashoffset:0;}}' +
        '@keyframes mmtCoachHead{0%,55%{stroke-dashoffset:1;}72%{stroke-dashoffset:0;}100%{stroke-dashoffset:0;}}';
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    ensureStyle();
    if (overlay && overlay.isConnected) {
      return overlay;
    }
    overlay = document.createElement('div');
    overlay.id = 'mmt-coach-arrow';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
        '<svg viewBox="0 0 150 84">' +
        '<g transform="translate(78.125 34.75) scale(1.20366)">' +
        '<path class="mmt-coach-shaft" pathLength="1" d="' + SHAFT + '"/>' +
        '<path class="mmt-coach-head" pathLength="1" d="' + HEAD + '"/>' +
        '</g></svg>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function resolve(target) {
    if (!target) {
      return null;
    }
    if (target.nodeType === 1) {
      return target;
    }
    return document.querySelector('[data-mmt-coach="' + target + '"]');
  }

  function place(el) {
    var box = ensureOverlay();
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hide();
      return;
    }
    box.style.display = 'block';
    var tailX = (TAIL_X / 150) * WIDTH;
    var tailY = (TAIL_Y / 84) * HEIGHT;
    var headX = (TIP_X / 150) * WIDTH;
    var headY = (TIP_Y / 84) * HEIGHT;
    var corner = el.getAttribute('data-mmt-coach');
    if (corner === 'body' || corner === 'yaml') {
      var tailAtX = rect.right;
      var tailAtY = rect.top;
      var midX = rect.left + rect.width / 2;
      var midY = rect.top + rect.height / 2;
      var natural = Math.atan2(headY - tailY, headX - tailX);
      var desired = Math.atan2(midY - tailAtY, midX - tailAtX);
      var deg = (desired - natural) * 180 / Math.PI;
      box.style.left = Math.round(tailAtX - tailX) + 'px';
      box.style.top = Math.round(tailAtY - tailY) + 'px';
      box.style.transformOrigin = tailX + 'px ' + tailY + 'px';
      box.style.transform = 'rotate(' + deg + 'deg)';
      return;
    }
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var flip = (window.innerWidth - rect.right) < WIDTH - 24;
    var tipX = flip ? WIDTH - headX : headX;
    box.style.left = Math.round(cx - tipX) + 'px';
    box.style.top = Math.round(cy - headY) + 'px';
    box.style.transformOrigin = '50% 50%';
    box.style.transform = flip ? 'scaleX(-1)' : 'none';
  }

  function hide() {
    pending = '';
    currentEl = null;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  function pointAt(target) {
    pending = target || '';
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
    if (!pending) {
      hide();
      return;
    }
    var el = resolve(pending);
    if (!el) {
      if (overlay) {
        overlay.style.display = 'none';
      }
      retryTimer = setTimeout(function () {
        if (pending) {
          pointAt(pending);
        }
      }, 350);
      return;
    }
    currentEl = el;
    place(el);
  }

  function onMessage(event) {
    var data = event && event.data;
    if (!data) {
      return;
    }
    if (data.command === 'multimeter.coachArrow' || data.type === 'coachArrow') {
      pointAt(data.target || '');
    }
  }

  function relayout() {
    if (currentEl && currentEl.isConnected) {
      place(currentEl);
    } else if (pending) {
      pointAt(pending);
    }
  }

  global.addEventListener('message', onMessage);
  global.addEventListener('resize', relayout);
  document.addEventListener('scroll', relayout, true);

  global.mmtCoach = {
    pointAt: pointAt,
    hide: hide,
  };
})(window);
