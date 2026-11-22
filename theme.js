(() => {
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

  let savedTheme;
  try { savedTheme = localStorage.getItem('site-theme'); } catch {}
  let hasManualChoice = savedTheme === 'light' || savedTheme === 'dark';

  // Run in <head>, choose correct theme before page is loaded
  root.dataset.theme = hasManualChoice
    ? savedTheme
    : (systemTheme.matches ? 'dark' : 'light');

  function update() {
    const light = root.dataset.theme === 'light';
    const toggle = document.querySelector('.theme-toggle');
    const label = `Switch to ${light ? 'dark' : 'light'} mode`;
    if (toggle) {
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', light ? '#f7f8fa' : '#101318');
  }

  // Use OS choice initially, or manual selection.
  systemTheme.addEventListener('change', (event) => {
    if (hasManualChoice) return;
    root.dataset.theme = event.matches ? 'dark' : 'light';
    update();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      hasManualChoice = true;
      try { localStorage.setItem('site-theme', root.dataset.theme); } catch {}
      update();
    });
    update();
  });

  update();
})();
