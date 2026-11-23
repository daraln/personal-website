// mobile full image viewer
(() => {
  const lightbox = document.querySelector('#photo-lightbox');
  const originalImage = lightbox?.querySelector('#lightbox-image');
  const actions = lightbox?.querySelector('.lightbox-heading-actions');
  if (!lightbox || !originalImage || !actions || typeof lightbox.showModal !== 'function') return;

  // Add full image button next to close button.
  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'lightbox-expand';
  expand.setAttribute('aria-label', 'View photograph full screen');
  expand.title = 'Expand photograph';
  expand.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
  actions.insertBefore(expand, actions.querySelector('.lightbox-close'));

  // Separate modal above lightbox
  const viewer = document.createElement('dialog');
  viewer.className = 'photo-zoom-viewer';
  viewer.setAttribute('aria-label', 'Expanded photograph');
  viewer.innerHTML = `
    <div class="photo-zoom-stage">
      <img class="photo-zoom-image" alt="" draggable="false">
    </div>
    <div class="photo-zoom-toolbar" aria-label="Image viewer controls">
      <button class="photo-zoom-reset" type="button" aria-label="Reset image zoom" title="Reset zoom">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.5 6.3M3 4v7h7"/></svg>
      </button>
      <button class="photo-zoom-close" type="button" aria-label="Close expanded view" title="Close expanded view" autofocus>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>
      </button>
    </div>`;
  document.body.append(viewer);

  const stage = viewer.querySelector('.photo-zoom-stage');
  const image = viewer.querySelector('.photo-zoom-image');
  const resetButton = viewer.querySelector('.photo-zoom-reset');
  const closeButton = viewer.querySelector('.photo-zoom-close');
  const pointers = new Map();
  const MAX_SCALE = 4;
  // Render at the max zoom size & scale down (scale < 1) avoid blurriness
  let scale = 1;
  let x = 0;
  let y = 0;
  let gesture = null;
  let moved = false;
  let hadMultiplePointers = false;
  let lastTap = null;
  let lastTouchTime = -Infinity;

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  // Size image to fit viewport & preserve aspect ratio
  function fittedSize() {
    if (!image.naturalWidth || !image.naturalHeight || !stage.clientWidth || !stage.clientHeight) return null;
    const ratio = Math.min(stage.clientWidth / image.naturalWidth,
                           stage.clientHeight / image.naturalHeight);
    return { width: image.naturalWidth * ratio, height: image.naturalHeight * ratio };
  }

  function constrain() {
    const fit = fittedSize();
    if (!fit) return;
    const maxX = Math.max(0, (fit.width * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (fit.height * scale - stage.clientHeight) / 2);
    x = clamp(x, -maxX, maxX);
    y = clamp(y, -maxY, maxY);
  }

  // Limit paint to one update per animation frame
  let renderPending = false;
  function render() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      const fit = fittedSize();
      if (!fit) return;

      // Keep the image's layout size at maximum zoom size
      const fullWidth = fit.width * MAX_SCALE;
      const fullHeight = fit.height * MAX_SCALE;
      image.style.width = `${fullWidth}px`;
      image.style.height = `${fullHeight}px`;
      image.style.left = `${(stage.clientWidth - fullWidth) / 2}px`;
      image.style.top = `${(stage.clientHeight - fullHeight) / 2}px`;
      image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale / MAX_SCALE})`;
      stage.classList.toggle('is-zoomed', scale > 1.01);
    });
  }

  function reset() {
    scale = 1;
    x = 0;
    y = 0;
    pointers.clear();
    gesture = null;
    moved = false;
    hadMultiplePointers = false;
    lastTap = null;
    stage.classList.remove('is-dragging');
    render();
  }

  function zoomAt(newScale, clientX, clientY) {
    const bounds = stage.getBoundingClientRect();
    const pointX = clientX - (bounds.left + bounds.width / 2);
    const pointY = clientY - (bounds.top + bounds.height / 2);
    const next = clamp(newScale, 1, MAX_SCALE);
    const ratio = next / scale;
    x = pointX - (pointX - x) * ratio;
    y = pointY - (pointY - y) * ratio;
    scale = next;
    constrain();
    render();
  }

  function point(event) { return { x: event.clientX, y: event.clientY }; }

  function snapshot() {
    const points = [...pointers.values()];
    const first = points[0];
    if (!first) { gesture = null; return; }
    gesture = { x, y, scale, first };
    if (points.length >= 2) {
      const second = points[1];
      gesture.middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      gesture.distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
    }
    moved = false;
  }

  stage.addEventListener('pointerdown', (event) => {
    if (!viewer.open || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (event.pointerType === 'touch') lastTouchTime = performance.now();
    pointers.set(event.pointerId, point(event));
    if (pointers.size > 1) hadMultiplePointers = true;
    try { stage.setPointerCapture?.(event.pointerId); } catch { /* Pointer capture is optional. */ }
    snapshot();
  });

  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, point(event));
    const points = [...pointers.values()];
    if (points.length >= 2 && gesture.middle) {
      const first = points[0], second = points[1];
      const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const newScale = clamp(gesture.scale * distance / gesture.distance, 1, MAX_SCALE);
      const ratio = newScale / gesture.scale;
      const start = stage.getBoundingClientRect();
      const centerX = start.left + start.width / 2;
      const centerY = start.top + start.height / 2;
      x = middle.x - centerX - ((gesture.middle.x - centerX) - gesture.x) * ratio;
      y = middle.y - centerY - ((gesture.middle.y - centerY) - gesture.y) * ratio;
      scale = newScale;
      constrain();
      render();
      moved = true;
    } else if (points.length === 1) {
      const dx = points[0].x - gesture.first.x;
      const dy = points[0].y - gesture.first.y;
      if (Math.hypot(dx, dy) > 7) moved = true;
      x = gesture.x + dx;
      y = gesture.y + dy;
      constrain();
      render();
      stage.classList.toggle('is-dragging', scale > 1.01);
    }
  });

  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    // Double-tap to zoom
    if (event.type === 'pointerup' && pointers.size === 1 && !moved && !hadMultiplePointers && event.pointerType === 'touch') {
      const now = performance.now();
      if (lastTap && now - lastTap.time < 320 &&
          Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 36) {
        if (scale > 1.01) reset();
        else zoomAt(2.5, event.clientX, event.clientY);
        lastTap = null;
      } else {
        lastTap = { time: now, x: event.clientX, y: event.clientY };
      }
    }
    pointers.delete(event.pointerId);
    stage.classList.remove('is-dragging');
    if (!pointers.size) {
      gesture = null;
      hadMultiplePointers = false;
    } else {
      snapshot();
    }
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  // Mouse
  stage.addEventListener('dblclick', (event) => {
    // avoid synthesised double click
    if (performance.now() - lastTouchTime < 700) return;
    if (scale > 1.01) reset();
    else zoomAt(2.5, event.clientX, event.clientY);
  });
  stage.addEventListener('wheel', (event) => {
    if (!viewer.open) return;
    event.preventDefault();
    zoomAt(scale * Math.exp(-event.deltaY * .0015), event.clientX, event.clientY);
  }, { passive: false });

  resetButton.addEventListener('click', reset);
  closeButton.addEventListener('click', () => viewer.close());
  image.addEventListener('load', reset);
  viewer.addEventListener('close', () => {
    reset();
    if (lightbox.open) expand.focus({ preventScroll: true });
  });
  lightbox.addEventListener('close', () => { if (viewer.open) viewer.close(); });

  // refit after phone turns
  window.matchMedia('(orientation: landscape)').addEventListener('change', () => {
    if (viewer.open) {
      reset();
    }
  });
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!viewer.open) return;
      constrain();
      render();
    }).observe(stage);
  }

  expand.addEventListener('click', () => {
    const source = originalImage.currentSrc || originalImage.src;
    if (!source || viewer.open) return;
    image.alt = originalImage.alt || 'Expanded photograph';
    reset();
    viewer.showModal();
    if (image.src !== source) image.src = source;
    closeButton.focus({ preventScroll: true });
  });
})();
