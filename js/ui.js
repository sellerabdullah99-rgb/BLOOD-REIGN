/* ==========================================================
   BLOOD REIGN — Shared UI helpers (modal system)
   ========================================================== */

window.BR = window.BR || {};

BR.ui = (function () {
  const root = () => document.getElementById('modalRoot');

  function openModal(id, { title, bodyHTML }) {
    closeModal(id, true);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = `overlay-${id}`;
    overlay.innerHTML = `
      <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
        <div class="modal-header">
          <h3 id="${id}-title" style="font-size:var(--text-lg);letter-spacing:1.5px">${title}</h3>
          <button class="modal-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="${id}">${bodyHTML}</div>
      </div>`;
    root().appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(id));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(id); });
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id, instant = false) {
    const overlay = document.getElementById(`overlay-${id}`);
    if (!overlay) return;
    if (instant) { overlay.remove(); document.body.style.overflow = ''; return; }
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 260);
  }

  return { openModal, closeModal };
})();
