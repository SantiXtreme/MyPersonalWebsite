import gsap from 'gsap';
import { iconMarkup } from './icons.js';
import { motionPrefs } from './motionPrefs.js';

const HEADER_GLYPH = `<svg viewBox="0 0 24 24"><path d="M12 2 L12 22 M7 8 A5 5 0 0 0 17 8" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>`;

/**
 * The Grace menu: a keyboard- and pointer-operable option list styled after
 * the game's Site of Grace panel. Purely a view + interaction layer — it
 * knows nothing about panels/content, it just reports selections upward.
 */
export function createGraceMenu({ items, title, onSelect, onLeave }) {
  const panel = document.getElementById('grace-menu');
  const backdrop = document.createElement('div');
  backdrop.className = 'menu-backdrop';
  // Must live inside #stage (not #app) so it shares #stage's stacking
  // context — #stage itself establishes one (position:relative + z-index),
  // so a sibling appended straight to #app would be stacked against
  // #stage as a whole using #stage's z-index, ignoring the higher
  // z-index set on .grace-menu inside it, and would sit on top of and
  // swallow every click on the menu.
  document.getElementById('stage').insertBefore(backdrop, panel);

  panel.innerHTML = `
    <div class="menu-header">
      <span class="menu-header-icon">${HEADER_GLYPH}</span>
      <h2>${title}</h2>
    </div>
    <div class="menu-divider"></div>
    <ul class="menu-list">
      <div class="menu-highlight" aria-hidden="true"></div>
      ${items
        .map(
          (item) => `
        <li>
          <button class="menu-item" type="button" data-id="${item.id}">
            <span class="item-icon">${iconMarkup(item.icon)}</span>
            <span class="item-text">
              <span class="item-label">${item.label}</span>
              <span class="item-summary">${item.summary}</span>
            </span>
          </button>
        </li>`,
        )
        .join('')}
      <li>
        <button class="menu-item is-leave" type="button" data-id="leave">
          <span class="item-icon">${iconMarkup('leave')}</span>
          <span class="item-text"><span class="item-label">Leave</span></span>
        </button>
      </li>
    </ul>
    <div class="menu-footer">
      <span><kbd>&#8593;&#8595;</kbd>Navigate</span>
      <span><kbd>&#9166;</kbd>Rest</span>
      <span><kbd>Esc</kbd>Leave</span>
    </div>
  `;

  const list = panel.querySelector('.menu-list');
  const highlight = panel.querySelector('.menu-highlight');
  const buttons = Array.from(panel.querySelectorAll('.menu-item'));

  gsap.set(panel, { xPercent: -100 });
  gsap.set(backdrop, { opacity: 0 });
  // Off-screen transforms and aria-hidden don't remove real <button>s from
  // the Tab order — without `inert`, a keyboard user could tab into the
  // hidden menu before ever opening it.
  panel.inert = true;

  let isOpenState = false;
  let previouslyFocused = null;

  function setHighlightTo(el) {
    if (!el) {
      gsap.to(highlight, { opacity: 0, duration: 0.2 });
      return;
    }
    const rect = el.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    gsap.to(highlight, {
      top: rect.top - listRect.top + list.scrollTop,
      height: rect.height,
      opacity: 1,
      duration: motionPrefs.reduced ? 0.01 : 0.32,
      ease: 'power3.out',
    });
  }

  // Gated on real pointer movement (not mouseenter/mouseleave) — a bare
  // mouseenter also fires when a new element slides in under an already-
  // stationary cursor (e.g. the menu opening under where "Rest at the
  // Grace" was clicked), which would otherwise highlight a row the user
  // never actually pointed at.
  list.addEventListener('pointermove', (e) => {
    const btn = e.target.closest('.menu-item');
    if (btn) setHighlightTo(btn);
  });
  list.addEventListener('pointerleave', () => {
    const active = document.activeElement;
    setHighlightTo(list.contains(active) ? active : null);
  });

  buttons.forEach((btn) => {
    btn.addEventListener('focus', () => {
      buttons.forEach((b) => b.classList.remove('is-focused'));
      btn.classList.add('is-focused');
      setHighlightTo(btn);
    });
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (id === 'leave') onLeave();
      else onSelect(id);
    });
  });

  function focusAt(index) {
    const clamped = (index + buttons.length) % buttons.length;
    buttons[clamped].focus();
  }

  function handleKeydown(e) {
    const currentIndex = buttons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusAt(currentIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusAt(currentIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAt(buttons.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onLeave();
    } else if (e.key === 'Tab') {
      // simple focus trap: keep tabbing within the menu list
      e.preventDefault();
      focusAt(currentIndex + (e.shiftKey ? -1 : 1));
    }
  }

  function handleBackdropClick() {
    onLeave();
  }

  function open(preferredId) {
    if (isOpenState) return;
    isOpenState = true;
    previouslyFocused = document.activeElement;
    panel.setAttribute('aria-hidden', 'false');
    panel.inert = false;
    backdrop.style.pointerEvents = 'auto';
    document.addEventListener('keydown', handleKeydown);
    backdrop.addEventListener('click', handleBackdropClick);

    const dur = motionPrefs.reduced ? 0.01 : undefined;
    gsap
      .timeline()
      .to(backdrop, { opacity: 1, duration: dur ?? 0.35 })
      .to(panel, { xPercent: 0, duration: dur ?? 0.55, ease: 'power3.out' }, dur ? 0 : '<0.05');

    const target = (preferredId && buttons.find((b) => b.dataset.id === preferredId)) || buttons[0];
    requestAnimationFrame(() => target?.focus());
  }

  function close() {
    if (!isOpenState) return;
    isOpenState = false;
    document.removeEventListener('keydown', handleKeydown);
    backdrop.removeEventListener('click', handleBackdropClick);
    backdrop.style.pointerEvents = 'none';
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;

    const dur = motionPrefs.reduced ? 0.01 : undefined;
    gsap
      .timeline()
      .to(panel, { xPercent: -100, duration: dur ?? 0.4, ease: 'power2.in' })
      .to(backdrop, { opacity: 0, duration: dur ?? 0.3 }, dur ? 0 : '<');

    if (previouslyFocused && document.contains(previouslyFocused)) {
      previouslyFocused.focus();
    }
  }

  return {
    open,
    close,
    isOpen: () => isOpenState,
  };
}
