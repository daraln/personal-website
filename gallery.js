/* Optional details from data/gallery.json. */
(() => {
  const grid = document.querySelector('#photo-gallery');
  const dialog = document.querySelector('#photo-lightbox');
  if (!grid || !dialog || typeof dialog.showModal !== 'function') return;

  const image = dialog.querySelector('#lightbox-image');
  const title = dialog.querySelector('#lightbox-title');
  const details = dialog.querySelector('#lightbox-details');
  const instagram = dialog.querySelector('#lightbox-instagram');
  const counter = dialog.querySelector('#lightbox-count');
  const previous = dialog.querySelector('#lightbox-prev');
  const next = dialog.querySelector('#lightbox-next');
  let photos = [];
  let current = 0;

  // Don't display links with non-Instagram or non-HTTPS addresses
  function instagramUrl(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && /(^|\.)instagram\.com$/i.test(url.hostname)
        ? url.href : null;
    } catch { return null; }
  }

  // Map commonly used labels to SVG icons
  // Default is to use the neutral info icon.
  function iconFor(label) {
    const name = label.trim().toLowerCase();
    if (/\b(telescope|scope|optical tube)\b/.test(name)) return 'telescope';
    if (/\b(camera|sensor|dslr|ccd|cmos)\b/.test(name)) return 'camera';
    if (/\b(frame|frames|subs|subframes|stack|lights|darks|flats|bias)\b/.test(name)) return 'layers';
    if (/\b(exposure|integration|shutter|duration|hours|time)\b/.test(name)) return 'clock';
    if (/\b(location|site|country|place|observatory)\b/.test(name)) return 'map-pin';
    if (/\b(filter|filters|narrowband|broadband)\b/.test(name)) return 'filter';
    if (/\b(date|captured|night|session)\b/.test(name)) return 'calendar';
    if (/\b(lens|aperture|focal|iso|gain|f-ratio)\b/.test(name)) return 'aperture';
    if (/\b(mount|tracking|tracker|guiding|software|processing)\b/.test(name)) return 'settings';
    if (/\b(target|object|constellation|bortle|sky|seeing|transparency)\b/.test(name)) return 'sparkles';
    return 'info';
  }

  function makeDetailIcon(label) {
    const wrap = document.createElement('span');
    wrap.className = 'photo-spec-icon';
    wrap.title = label; // Native hover tooltip, labels should remain visible on touch screen
    wrap.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#detail-icon-${iconFor(label)}`);
    svg.append(use);
    wrap.append(svg);
    return wrap;
  }

  function show(index) {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    image.src = photo.image;
    image.alt = photo.alt || photo.title;
    title.textContent = photo.title;

    const content = [];
    if (typeof photo.description === 'string' && photo.description.trim()) {
      const description = document.createElement('p');
      description.className = 'photo-description';
      description.textContent = photo.description;
      content.push(description);
    }

    const specs = Object.entries(photo.details && typeof photo.details === 'object' &&
      !Array.isArray(photo.details) ? photo.details : {})
      .filter(([label, value]) => label.trim() && typeof value === 'string' && value.trim());
    if (specs.length) {
      const list = document.createElement('dl');
      list.className = 'photo-specs';
      for (const [label, value] of specs) {
        const row = document.createElement('div');
        // const term = document.createElement('dt');
        const definition = document.createElement('dd');
        // term.textContent = label;
        definition.textContent = value;
        row.append(makeDetailIcon(label), /* term, */ definition);
        list.append(row);
      }
      
      content.push(list);
    }
    details.replaceChildren(...content);
    title.parentElement.querySelector('.photo-info-toggle')?.remove();

    // Switch between desc and details
    // Mobile: switch between description and capture details
    if (details.querySelector('.photo-description') &&
        details.querySelector('.photo-specs')) {

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'photo-info-toggle';

      let showingSpecs = false;

      function updateView() {
        details.dataset.view = showingSpecs ? 'specs' : 'description';
        toggle.textContent = showingSpecs
          ? '← Description'
          : 'Capture details →';
      }

      toggle.addEventListener('click', () => {
        showingSpecs = !showingSpecs;
        updateView();
      });

      updateView();
      title.parentElement.append(toggle);
    }

    const url = instagramUrl(photo.instagram);
    instagram.hidden = !url;
    if (url) instagram.href = url;
    else instagram.removeAttribute('href');

    counter.textContent = `${current + 1} / ${photos.length}`;
    previous.disabled = next.disabled = photos.length < 2;
  }

  function makeCard(photo, index) {
    const figure = document.createElement('figure');
    figure.className = 'photo-card';
    const link = document.createElement('a');
    link.href = photo.image;
    const thumb = document.createElement('img');
    thumb.src = photo.thumbnail || photo.image;
    thumb.alt = photo.alt || photo.title;
    thumb.loading = 'lazy';
    thumb.decoding = 'async';
    link.append(thumb);

    const caption = document.createElement('figcaption');
    const heading = document.createElement('span');
    heading.className = 'photo-title';
    heading.textContent = photo.title;
    caption.append(heading);
    if (typeof photo.date === 'string' && photo.date.trim()) {
      const date = document.createElement('span');
      date.className = 'photo-date';
      date.textContent = photo.date;
      caption.append(date);
    }
    figure.append(link, caption);

    link.addEventListener('click', (event) => {
      // Preserve normal open new tab behaviour.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      show(index);
      dialog.showModal();
    });
    return figure;
  }

  //Keys
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); if (photos.length > 1) show(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); if (photos.length > 1) show(current + 1); }
    //Escape should close the dialog
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  fetch('./data/gallery.json')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      photos = Array.isArray(data.photos) ? data.photos.filter(photo =>
        photo && typeof photo.title === 'string' && photo.title.trim() &&
        typeof photo.image === 'string' && photo.image.trim()) : [];
      if (!photos.length) {
        grid.replaceChildren();
        const message = document.createElement('p');
        message.className = 'gallery-message';
        message.textContent = 'No photographs added yet.';
        grid.append(message);
        return;
      }
      grid.replaceChildren(...photos.map(makeCard));
    })
    .catch((error) => {
      console.error('Could not load gallery data:', error);
      const message = grid.querySelector('.gallery-message');
      if (message) message.textContent = 'Gallery unavailable.';
    });
})();
