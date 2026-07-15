import gsap from 'gsap';
import { motionPrefs } from './motionPrefs.js';

// Lazy-loaded per the grace-menu-section skill: id -> dynamic import.
const sectionModules = {
  passtime: () => import('./sections/passtime.js'),
  'ml-projects': () => import('./sections/projects.js'),
  piano: () => import('./sections/piano.js'),
  hobbies: () => import('./sections/hobbies.js'),
  arsenal: () => import('./sections/arsenal.js'),
  instagram: () => import('./sections/instagram.js'),
  contact: () => import('./sections/contact.js'),
  flasks: () => import('./sections/flasks.js'),
  levelup: () => import('./sections/levelup.js'),
};

/**
 * Renders whichever section is selected inside a centered stone panel.
 * "Back" always means "return one level, to the Grace menu" — it does not
 * know about the hero/menu state machine, it just reports back via onBack.
 */
export function createPanelRouter({ onBack }) {
  const overlay = document.getElementById('panel-overlay');
  const root = document.getElementById('panel-root');

  root.innerHTML = `
    <div class="panel-topbar">
      <button class="panel-back" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 12 H20 M17 8.5 L20.5 12 L17 15.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Return to Grace
      </button>
      <span class="panel-kbd-hint"><kbd>Esc</kbd>Back</span>
    </div>
    <div class="panel-body" id="panel-body"></div>
  `;

  const body = root.querySelector('#panel-body');
  const backBtn = root.querySelector('.panel-back');

  gsap.set(overlay, { opacity: 0 });
  gsap.set(root, { opacity: 0, y: 24, scale: 0.98 });
  overlay.inert = true;

  let isOpenState = false;
  let currentCleanup = null;
  let currentId = null;

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleBack();
    }
  }

  function handleBack() {
    onBack(currentId);
  }

  backBtn.addEventListener('click', handleBack);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleBack();
  });

  async function open(id) {
    const loader = sectionModules[id];
    if (!loader) return;
    currentId = id;

    if (!isOpenState) {
      isOpenState = true;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.inert = false;
      overlay.style.pointerEvents = 'auto';
      document.addEventListener('keydown', handleKeydown);
      const dur = motionPrefs.reduced ? 0.01 : undefined;
      gsap
        .timeline()
        .to(overlay, { opacity: 1, duration: dur ?? 0.3 })
        .to(root, { opacity: 1, y: 0, scale: 1, duration: dur ?? 0.45, ease: 'power3.out' }, dur ? 0 : '<0.05');
    }

    const mod = await loader();
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
    body.innerHTML = '';
    mod.render(body);
    body.scrollTop = 0;
    currentCleanup = typeof mod.cleanup === 'function' ? mod.cleanup : null;
    const heading = body.querySelector('h2');
    if (heading) root.setAttribute('aria-label', heading.textContent.trim());
    backBtn.focus();
  }

  function close() {
    if (!isOpenState) return;
    isOpenState = false;
    document.removeEventListener('keydown', handleKeydown);
    overlay.style.pointerEvents = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;

    const dur = motionPrefs.reduced ? 0.01 : undefined;
    gsap
      .timeline()
      .to(root, { opacity: 0, y: 16, scale: 0.98, duration: dur ?? 0.3, ease: 'power2.in' })
      .to(overlay, { opacity: 0, duration: dur ?? 0.25 }, dur ? 0 : '<');

    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
    currentId = null;
  }

  return {
    open,
    close,
    isOpen: () => isOpenState,
  };
}
