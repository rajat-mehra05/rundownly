// ── Theme toggle ──
(function initTheme() {
  var stored = localStorage.getItem('lp-theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isLight = stored === 'light' || (!stored && !prefersDark);

  if (isLight) document.documentElement.classList.add('light');
  updateThemeIcon(isLight);
})();

function updateThemeIcon(isLight) {
  var moon = document.getElementById('theme-icon-moon');
  var sun = document.getElementById('theme-icon-sun');
  if (!moon || !sun) return;
  moon.style.display = isLight ? 'block' : 'none';
  sun.style.display = isLight ? 'none' : 'block';
}

var toggleBtn = document.getElementById('theme-toggle');
if (toggleBtn) {
  toggleBtn.addEventListener('click', function () {
    var isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('lp-theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
  });
}

// ── OS detection ──
(function () {
  var ua = navigator.userAgent.toLowerCase();
  var os = 'macos';
  if (ua.indexOf('win') !== -1) os = 'windows';
  else if (ua.indexOf('linux') !== -1) os = 'linux';

  var labels = {
    macos: 'Download for macOS',
    windows: 'Download for Windows',
    linux: 'Download for Linux',
  };

  var textEl = document.getElementById('download-text');
  if (textEl) textEl.textContent = labels[os];
})();

// ── Tab switching ──
document.querySelectorAll('.tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    var target = this.getAttribute('data-tab');

    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(function (c) {
      c.classList.remove('active');
    });

    this.classList.add('active');
    this.setAttribute('aria-selected', 'true');
    var content = document.querySelector('.tab-content[data-tab="' + target + '"]');
    if (content) content.classList.add('active');
  });
});

// ── Platform links ──
document.querySelectorAll('.platform-link').forEach(function (link) {
  link.addEventListener('click', function () {
    var os = this.getAttribute('data-os');
    var labels = {
      windows: 'Download for Windows',
      linux: 'Download for Linux',
      macos: 'Download for macOS',
    };

    var textEl = document.getElementById('download-text');
    if (textEl) textEl.textContent = labels[os] || labels.macos;
  });
});

// ── Scroll reveal ──
(function () {
  var reveals = document.querySelectorAll('.reveal');
  if (!reveals.length || !('IntersectionObserver' in window)) {
    // Fallback: show everything
    reveals.forEach(function (el) { el.classList.add('visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach(function (el) { observer.observe(el); });
})();

// ── Particle canvas ──
(function () {
  var canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var particles = [];
  var count = 60;
  var animId;

  function resize() {
    var hero = canvas.parentElement;
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;
  }

  function createParticles() {
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.15,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var isLight = document.documentElement.classList.contains('light');
    var color = isLight ? '147, 51, 234' : '192, 132, 252';

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + color + ',' + p.opacity + ')';
      ctx.fill();

      p.x += p.dx;
      p.y += p.dy;

      if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
    }

    animId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener('resize', function () {
    resize();
    createParticles();
  });

  // Pause when not visible
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      draw();
    }
  });
})();
