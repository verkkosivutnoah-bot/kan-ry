
  /* ── Navbar scroll + progress bar ── */
  const navbar = document.getElementById('navbar');
  const progress = document.getElementById('scrollProgress');
  function onScroll() {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
    if (progress) {
      const h = document.documentElement;
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      progress.style.width = pct + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Mobile drawer toggle ── */
  const burger = document.getElementById('navBurger');
  const drawer = document.getElementById('navDrawer');
  if (burger && drawer) {
    const closeDrawer = () => {
      burger.classList.remove('open');
      drawer.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    };
    const openDrawer = () => {
      burger.classList.add('open');
      drawer.classList.add('open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-open');
    };
    burger.addEventListener('click', () => {
      drawer.classList.contains('open') ? closeDrawer() : openDrawer();
    });
    drawer.querySelectorAll('[data-drawer-link]').forEach(a => {
      a.addEventListener('click', closeDrawer);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
    });
  }

  /* ── Fade-up on scroll ── */
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));

  /* ── Animated count-up for stats ── */
  function parseTarget(str) {
    const num = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(num) ? null : num;
  }
  function formatNum(n, original) {
    if (original.includes('%')) return Math.round(n) + '%';
    if (original.includes('+')) return Math.round(n).toLocaleString('fi-FI').replace(/,/g, ' ') + '+';
    return Math.round(n).toLocaleString('fi-FI').replace(/,/g, ' ');
  }
  const statObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      if (el.dataset.counted) return;
      el.dataset.counted = '1';
      const original = el.textContent.trim();
      const target = parseTarget(original);
      if (target === null) return;
      const dur = 1400, t0 = performance.now();
      function tick(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = formatNum(target * eased, original);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = original;
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('.stat-num').forEach(el => statObs.observe(el));


  /* ── Location accordion ── */
  document.querySelectorAll('.loc-head').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.loc-item');
      const open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ── Cookie banner ── */
  (function(){
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    if (!localStorage.getItem('kan-cookie-ack')) banner.classList.add('show');
    const btn = document.getElementById('cookie-accept');
    if (btn) btn.addEventListener('click', () => {
      localStorage.setItem('kan-cookie-ack', '1');
      banner.classList.remove('show');
    });
  })();

  /* ── Form submit loading state ── */
  document.querySelectorAll('form.form-grid').forEach(form => {
    form.addEventListener('submit', (e) => {
      const btn = form.querySelector('.form-submit');
      if (!btn) return;
      btn.disabled = true;
      btn.dataset.original = btn.dataset.original || btn.textContent;
      btn.style.opacity = '0.7';
      btn.style.cursor = 'wait';
    });
  });
