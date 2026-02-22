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

// ── OS detection & download links ──
var REPO = 'rajat-mehra05/rundownly';
var RELEASES_API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
var RELEASES_PAGE = 'https://github.com/' + REPO + '/releases/latest';

var LABELS = {
  macos: 'Download for macOS',
  windows: 'Download for Windows',
  linux: 'Download for Linux',
  android: 'Download for Android',
};

// Detect current OS
var ua = navigator.userAgent.toLowerCase();
var currentOS = 'macos';
if (ua.indexOf('win') !== -1) currentOS = 'windows';
else if (ua.indexOf('android') !== -1) currentOS = 'android';
else if (ua.indexOf('linux') !== -1) currentOS = 'linux';

// Download URLs — fallback to releases page
var downloadUrls = { macos: RELEASES_PAGE, windows: RELEASES_PAGE, linux: RELEASES_PAGE, android: RELEASES_PAGE };

// Best-effort heuristic: UA parsing is unreliable on modern macOS browsers
// (Safari 17+, Chrome 110+) due to UA freezing — Intel may be reported even on
// Apple Silicon. For reliable detection, prefer navigator.userAgentData
// (User-Agent Client Hints) in Chromium-based browsers.
function isAppleSilicon() {
  return !/Intel/.test(navigator.userAgent);
}

function updateDownloadBtn(os) {
  var btn = document.getElementById('download-btn');
  var textEl = document.getElementById('download-text');
  if (textEl) textEl.textContent = LABELS[os] || LABELS.macos;
  if (btn) btn.href = downloadUrls[os] || RELEASES_PAGE;
}

// Set initial label + href
updateDownloadBtn(currentOS);

// Fetch latest release from GitHub API
var fetchController = new AbortController();
var fetchTimeout = setTimeout(function () { fetchController.abort(); }, 8000);
fetch(RELEASES_API, { signal: fetchController.signal })
  .then(function (res) {
    clearTimeout(fetchTimeout);
    if (!res.ok) throw new Error(res.status);
    return res.json();
  })
  .then(function (data) {
    if (!data || !data.assets) return;

    // Update version tag
    if (data.tag_name) {
      var versionEl = document.getElementById('version-tag');
      if (versionEl) versionEl.textContent = data.tag_name;
    }

    var assets = data.assets;

    // macOS: pick .dmg matching architecture
    var dmgs = assets.filter(function (a) { return /\.dmg$/i.test(a.name); });
    if (dmgs.length > 0) {
      if (dmgs.length > 1) {
        var preferred = isAppleSilicon()
          ? dmgs.find(function (a) { return /aarch64|arm64/i.test(a.name); })
          : dmgs.find(function (a) { return /x86_64|x64|intel/i.test(a.name); });
        downloadUrls.macos = (preferred || dmgs[0]).browser_download_url;
      } else {
        downloadUrls.macos = dmgs[0].browser_download_url;
      }
    }

    // Windows: prefer .msi, fallback to .exe
    var msi = assets.find(function (a) { return /\.msi$/i.test(a.name); });
    var exe = assets.find(function (a) { return /\.exe$/i.test(a.name); });
    if (msi) downloadUrls.windows = msi.browser_download_url;
    else if (exe) downloadUrls.windows = exe.browser_download_url;

    // Linux: prefer .AppImage, fallback to .deb
    var appImage = assets.find(function (a) { return /\.AppImage$/i.test(a.name); });
    var deb = assets.find(function (a) { return /\.deb$/i.test(a.name); });
    if (appImage) downloadUrls.linux = appImage.browser_download_url;
    else if (deb) downloadUrls.linux = deb.browser_download_url;

    // Android: .apk
    var apk = assets.find(function (a) { return /\.apk$/i.test(a.name); });
    if (apk) downloadUrls.android = apk.browser_download_url;

    // Refresh the button with real URL
    updateDownloadBtn(currentOS);
  })
  .catch(function () {
    clearTimeout(fetchTimeout);
    // API failed (no releases yet, rate limit, timeout, etc.) — keep fallback URLs
  });

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
    updateDownloadBtn(os);
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
