/* Josiane Pilar Makeup — interatividade
   1) Faixa de selos: marquee automático + arraste manual (mouse/touch)
   2) Reveal on scroll (IntersectionObserver)
   3) Tilt 3D nos cards de serviço + parallax leve no hero
   Sem dependências. */
(function () {
  'use strict';

  var html = document.documentElement;
  html.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* -------------------------------------------------------------
     1) MARQUEE ARRASTÁVEL
     - Duplica o conteúdo até preencher a viewport e cria 2 metades
       idênticas, animando translateX(0) -> translateX(-50%).
     - Hover/touch pausa; arraste move manualmente nos dois sentidos;
       ~2s após soltar, a animação automática retoma do ponto atual.
  ------------------------------------------------------------- */
  function initMarquee(viewport) {
    var track = viewport.querySelector('[data-marquee-track]');
    var group = viewport.querySelector('[data-marquee-group]');
    if (!track || !group) return;

    var SPEED = 55;          // px por segundo (constante, independente da largura)
    var RESUME_DELAY = 2000; // ms parado antes de retomar o automático
    var halfWidth = 0;       // largura de uma metade (= o quanto -50% desloca)
    var duration = 35;       // s por loop (recalculado no build)

    // Constrói as duas metades idênticas a partir do grupo original.
    function build() {
      // Remove clones anteriores (mantém só o grupo original).
      while (track.children.length > 1) track.removeChild(track.lastChild);
      track.style.transform = '';
      track.style.animationDelay = '';

      var vw = viewport.clientWidth;

      // Clona o grupo até uma metade cobrir a viewport com folga.
      while (track.scrollWidth < vw + group.offsetWidth) {
        track.appendChild(group.cloneNode(true));
      }

      halfWidth = track.scrollWidth; // largura da 1ª metade (antes de duplicar)

      // Duplica tudo para formar a 2ª metade -> translateX(-50%) fica perfeito.
      var firstHalf = Array.prototype.slice.call(track.children);
      for (var i = 0; i < firstHalf.length; i++) {
        track.appendChild(firstHalf[i].cloneNode(true));
      }

      duration = Math.max(12, halfWidth / SPEED);
      track.style.animationDuration = duration + 's';

      if (!reduceMotion) {
        track.classList.add('is-animating');
      }
    }

    // Lê o translateX atual (px) a partir da matriz computada.
    function currentX() {
      var m = getComputedStyle(track).transform;
      if (!m || m === 'none') return 0;
      var match = m.match(/matrix.*\((.+)\)/);
      if (!match) return 0;
      var parts = match[1].split(',').map(parseFloat);
      // matrix(a,b,c,d,tx,ty) -> tx = parts[4]; matrix3d -> tx = parts[12]
      return parts.length > 6 ? parts[12] : parts[4];
    }

    // Normaliza um valor de translateX para dentro de (-halfWidth, 0].
    function wrap(x) {
      if (!halfWidth) return x;
      x = x % halfWidth;      // mantém em (-halfWidth, halfWidth)
      if (x > 0) x -= halfWidth;
      return x;
    }

    var dragging = false;
    var pointerId = null;
    var startX = 0;
    var baseX = 0;
    var curX = 0;
    var resumeTimer = null;

    function pause() {
      track.classList.add('is-paused');
    }

    function scheduleResume() {
      clearTimeout(resumeTimer);
      if (reduceMotion) return; // sem auto-scroll: fica onde parou
      resumeTimer = setTimeout(function () {
        // Recoloca a animação a partir da posição atual, sem "pulo",
        // usando animation-delay negativo proporcional ao progresso.
        var progress = halfWidth ? (-wrap(curX) / halfWidth) : 0; // 0..1
        track.style.transform = '';
        track.classList.remove('is-animating');
        // força reflow para reiniciar a animação com o novo delay
        void track.offsetWidth;
        track.style.animationDelay = (-progress * duration) + 's';
        track.classList.add('is-animating');
        track.classList.remove('is-paused');
      }, RESUME_DELAY);
    }

    // ---- Pausa no hover (mouse), sem arraste ----
    viewport.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse' && !dragging) pause();
    });
    viewport.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && !dragging) {
        track.classList.remove('is-paused');
      }
    });

    // ---- Arraste (mouse + touch + caneta via Pointer Events) ----
    viewport.addEventListener('pointerdown', function (e) {
      clearTimeout(resumeTimer);

      // Lê a posição atual AINDA com a animação aplicada (valor ao vivo)...
      baseX = wrap(currentX());
      // ...e então tira a animação para o transform inline valer no arraste.
      track.classList.remove('is-animating');
      track.classList.remove('is-paused');
      track.style.animationDelay = '';

      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      curX = baseX;

      track.style.transform = 'translateX(' + baseX + 'px)';
      viewport.classList.add('is-grabbing');
      try { viewport.setPointerCapture(pointerId); } catch (err) {}
    });

    viewport.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var delta = e.clientX - startX;
      curX = wrap(baseX + delta);
      track.style.transform = 'translateX(' + curX + 'px)';
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('is-grabbing');
      if (pointerId !== null) {
        try { viewport.releasePointerCapture(pointerId); } catch (err) {}
      }
      pointerId = null;
      scheduleResume();
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    build();

    // Rebuild em resize (largura muda a quantidade de clones necessários).
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 200);
    });
  }

  var marquees = document.querySelectorAll('[data-marquee]');
  for (var i = 0; i < marquees.length; i++) initMarquee(marquees[i]);

  /* -------------------------------------------------------------
     2) REVEAL ON SCROLL
  ------------------------------------------------------------- */
  (function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      for (var j = 0; j < els.length; j++) els[j].classList.add('in-view');
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    for (var k = 0; k < els.length; k++) obs.observe(els[k]);
  })();

  /* -------------------------------------------------------------
     3a) TILT 3D nos cards de serviço (só mouse/pointer fino)
  ------------------------------------------------------------- */
  if (canHover && !reduceMotion) {
    var cards = document.querySelectorAll('.services-grid .card');
    var MAX_TILT = 6; // graus — sutil

    Array.prototype.forEach.call(cards, function (card) {
      var rafId = null;

      function apply(e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width;  // 0..1
        var py = (e.clientY - rect.top) / rect.height;  // 0..1
        var ry = (px - 0.5) * 2 * MAX_TILT;             // esquerda/direita
        var rx = (0.5 - py) * 2 * MAX_TILT;             // cima/baixo
        card.style.transform =
          'perspective(800px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' +
          ry.toFixed(2) + 'deg)';
      }

      card.addEventListener('pointerenter', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        card.classList.add('is-tilting');
      });
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(function () { apply(e); });
      });
      card.addEventListener('pointerleave', function () {
        if (rafId) cancelAnimationFrame(rafId);
        card.classList.remove('is-tilting');
        card.style.transform = ''; // volta suave (transition do CSS)
      });
    });
  }

  /* -------------------------------------------------------------
     3b) PARALLAX leve no hero
  ------------------------------------------------------------- */
  if (!reduceMotion) {
    var frame = document.querySelector('.hero-photo-frame');
    var arch = document.querySelector('.hero-photo-arch');
    if (frame || arch) {
      var ticking = false;

      function onScroll() {
        var y = window.pageYOffset || document.documentElement.scrollTop;
        if (y > 900) { // fora da área do hero: não precisa calcular
          if (frame) frame.style.transform = 'translateY(' + (900 * 0.05) + 'px)';
          if (arch) arch.style.transform = 'translateY(' + (900 * 0.11) + 'px)';
          ticking = false;
          return;
        }
        if (frame) frame.style.transform = 'translateY(' + (y * 0.05) + 'px)';
        if (arch) arch.style.transform = 'translateY(' + (y * 0.11) + 'px)';
        ticking = false;
      }

      window.addEventListener('scroll', function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(onScroll);
        }
      }, { passive: true });

      onScroll();
    }
  }
})();
