// desktop zoom for gallery
(() => {
  const lightbox = document.querySelector('#photo-lightbox');
  const panel = lightbox?.querySelector('.lightbox-image-panel');
  const original = lightbox?.querySelector('#lightbox-image');
  if (!lightbox || !panel || !original) return;

  const desktop = window.matchMedia('(hover: hover) and (pointer: fine)');
  //zoom variables
  const MAX_ZOOM = 2;
  const DOUBLE_CLICK_ZOOM = 2;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // original image determines panel size
  const stage = document.createElement('div');
  stage.className = 'desktop-zoom-stage';
  stage.hidden = true;
  stage.setAttribute('aria-hidden', 'true');
  const enlarged = document.createElement('img');
  enlarged.className = 'desktop-zoom-image';
  enlarged.alt = '';
  enlarged.draggable = false;
  stage.append(enlarged);
  panel.append(stage);
  panel.classList.add('desktop-zoom-host');

  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let ready = false;
  let source = '';
  let drag = null;
  let frame = 0;

  function fittedSize() {
    const rect = original.getBoundingClientRect();
    if (!original.naturalWidth || !rect.width || !rect.height ||
        !panel.clientWidth || !panel.clientHeight) return null;
    return { width: rect.width, height: rect.height };
  }

  function limitPan(fit) {
    panX = clamp(panX, -Math.max(0, (fit.width * zoom - panel.clientWidth) / 2),
                        Math.max(0, (fit.width * zoom - panel.clientWidth) / 2));
    panY = clamp(panY, -Math.max(0, (fit.height * zoom - panel.clientHeight) / 2),
                        Math.max(0, (fit.height * zoom - panel.clientHeight) / 2));
  }

  function paint() {
    const fit = fittedSize();
    if (!fit || !ready) return;
    limitPan(fit);

    // blur fix
    const width = fit.width * MAX_ZOOM;
    const height = fit.height * MAX_ZOOM;
    enlarged.style.width = `${width}px`;
    enlarged.style.height = `${height}px`;
    enlarged.style.left = `${(panel.clientWidth - width) / 2}px`;
    enlarged.style.top = `${(panel.clientHeight - height) / 2}px`;
    enlarged.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoom / MAX_ZOOM})`;
    // 1x show original image
    stage.hidden = zoom <= 1.01;
    panel.classList.toggle('desktop-zoom-active', zoom > 1.01);
    stage.classList.toggle('is-zoomed', zoom > 1.01);
  }

  function queuePaint() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      paint();
    });
  }

  function reset() {
    zoom = 1;
    panX = panY = 0;
    drag = null;
    stage.classList.remove('is-dragging');
    stage.hidden = true;
    panel.classList.remove('desktop-zoom-active');
    queuePaint();
  }

  function zoomAt(value, clientX, clientY) {
    if (!ready) return;
    const bounds = panel.getBoundingClientRect();
    const pointX = clientX - bounds.left - bounds.width / 2;
    const pointY = clientY - bounds.top - bounds.height / 2;
    const next = clamp(value, 1, MAX_ZOOM);
    const ratio = next / zoom;
    panX = pointX - (pointX - panX) * ratio;
    panY = pointY - (pointY - panY) * ratio;
    zoom = next;
    queuePaint();
  }

  function stop() {
    ready = false;
    source = '';
    stage.hidden = true;
    reset();
    enlarged.removeAttribute('src'); // free extra rendered image on close
  }

  function finishPreparation() {
    if (!lightbox.open || !desktop.matches || !original.complete ||
        !original.naturalWidth || !enlarged.naturalWidth ||
        (original.currentSrc || original.src) !== source ||
        enlarged.src !== source) return;
    ready = true;
    
    paint();
  }

  function prepare() {
    // flicker fix
    if (!lightbox.open || !desktop.matches || !original.complete ||
        !original.naturalWidth) return;
    const nextSource = original.currentSrc || original.src;
    if (!nextSource || !original.getBoundingClientRect().width) return;
    if (ready && source === nextSource) return;

    
    stage.hidden = true;
    ready = false;
    reset();
    source = nextSource;
    if (enlarged.src !== nextSource) enlarged.src = nextSource;
    if (enlarged.complete && enlarged.naturalWidth) finishPreparation();
  }


  function imageChanged() {
    if (!desktop.matches) return;
    ready = false;
    source = '';
    stage.hidden = true;
    panel.classList.remove('desktop-zoom-active');
    enlarged.removeAttribute('src');
    reset();
    if (lightbox.open && original.complete && original.naturalWidth) {
      requestAnimationFrame(prepare);
    }
  }
  new MutationObserver(imageChanged).observe(original, {
    attributes: true, attributeFilter: ['src', 'srcset']
  });

  original.addEventListener('load', () => {
    if (lightbox.open) requestAnimationFrame(prepare);
  });
  enlarged.addEventListener('load', finishPreparation);
  enlarged.addEventListener('error', () => {
    if (enlarged.src !== source ||
        (original.currentSrc || original.src) !== source) return;
    stage.hidden = true;
    panel.classList.remove('desktop-zoom-active');
    ready = false;
  });


  new MutationObserver(() => {
    if (lightbox.open && desktop.matches) {
      requestAnimationFrame(prepare);
    } else stop();
  }).observe(lightbox, { attributes: true, attributeFilter: ['open'] });
  lightbox.addEventListener('close', stop);

  desktop.addEventListener('change', () => {
    if (!desktop.matches) {
      stop();
    } else if (lightbox.open) requestAnimationFrame(prepare);
  });

  panel.addEventListener('wheel', (event) => {
    if (!ready || !desktop.matches) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? panel.clientHeight : 1);
    zoomAt(zoom * Math.exp(-clamp(delta, -150, 150) * 0.0015), event.clientX, event.clientY);
  }, { passive: false });

  panel.addEventListener('dblclick', (event) => {
    if (!ready || !desktop.matches) return;
    event.preventDefault();
    if (zoom > 1.01) reset();
    else zoomAt(DOUBLE_CLICK_ZOOM, event.clientX, event.clientY);
  });

  stage.addEventListener('pointerdown', (event) => {
    if (!ready || !desktop.matches || event.pointerType !== 'mouse' ||
        event.button !== 0 || zoom <= 1.01) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
    stage.classList.add('is-dragging');
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    panX = drag.panX + event.clientX - drag.x;
    panY = drag.panY + event.clientY - drag.y;
    queuePaint();
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    stage.classList.remove('is-dragging');
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('lostpointercapture', endDrag);

  
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { if (ready) queuePaint(); }).observe(panel);
    new ResizeObserver(() => { if (ready) queuePaint(); }).observe(original);
  }
})();
