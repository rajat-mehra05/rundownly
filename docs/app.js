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

function isAppleSilicon() {
  var ua = navigator.userAgent;
  var isMac = /Macintosh|Mac OS/.test(ua) && !/iPhone|iPad|iPod|Mobile/.test(ua);
  return isMac && !/Intel/.test(ua);
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

    // Populate "What's New" from release notes
    renderChangelog(data);
  })
  .catch(function () {
    clearTimeout(fetchTimeout);
    renderChangelogFallback();
  });

function renderChangelog(release) {
  var container = document.getElementById('releases');
  if (!container) return;

  var tag = release.tag_name || '';
  var date = release.published_at
    ? new Date(release.published_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  var body = release.body || '';

  var html = '<div class="release-card card">'
    + '<div class="release-header"><strong>' + tag + '</strong>'
    + (date ? ' &mdash; ' + date : '')
    + '</div>'
    + '<div class="release-body">' + markdownToHtml(body) + '</div>'
    + '</div>';
  container.innerHTML = html;
}

function renderChangelogFallback() {
  var container = document.getElementById('releases');
  if (!container) return;
  container.innerHTML = '<p class="changelog-loading">Could not load release notes. '
    + '<a href="https://github.com/' + REPO + '/releases" target="_blank" rel="noopener noreferrer">'
    + 'View on GitHub</a></p>';
}

function markdownToHtml(md) {
  // Sanitize HTML entities first
  var s = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Headings: ## Title
  s = s.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  // Bold: **text**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Links: [text](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Bare URLs (not already inside an href)
  s = s.replace(/(?<!href=")(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  // Bullet lists: * item or - item
  s = s.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  s = s.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // Line breaks for remaining non-empty lines
  s = s.replace(/\n{2,}/g, '<br>');
  // Clean up stray newlines inside tags
  s = s.replace(/\n/g, '');
  return s;
}

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
      c.setAttribute('hidden', '');
    });

    this.classList.add('active');
    this.setAttribute('aria-selected', 'true');
    var content = document.querySelector('.tab-content[data-tab="' + target + '"]');
    if (content) {
      content.classList.add('active');
      content.removeAttribute('hidden');
    }
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
  // Respect reduced motion preference
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  var canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var particles = [];
  var count = 60;
  var animId;
  var PARTICLE_COLOR = '212, 168, 83';

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

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + PARTICLE_COLOR + ',' + p.opacity + ')';
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