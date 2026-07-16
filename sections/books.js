// Reading hero — books fall in from above and settle into a loose scatter,
// showing their real front covers (fetched live from Open Library by
// title/author — same "always a real embed/API, never invent or rehost"
// rule the rest of the site follows for YouTube/SoundCloud). Click a book
// to reveal a side note (what Santiago liked about it) in an overlay panel.
// Any cover that can't be resolved falls back to a colored gradient card
// with the title set in type — never a broken image.
//
// Usage:
//   const shelf = createBookDrop(containerEl, books); // books from content.js
//   shelf.play();     // scrolled into view — falls + settles once
//   shelf.dispose();

import gsap from 'gsap';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COVER_COLORS = [
  ['#8a5a3a', '#5c3a22'],
  ['#3a5a6a', '#20323c'],
  ['#6a3a4a', '#3c2028'],
  ['#5a6a3a', '#323c20'],
  ['#7a6a3a', '#4a3f20'],
  ['#4a5a7a', '#242c42'],
  ['#7a4a5a', '#3c2230'],
  ['#5a7a5a', '#28402a'],
  ['#7a6a5a', '#3f3226'],
];

async function fetchCoverUrl(title, author) {
  try {
    const params = new URLSearchParams({ title, author, limit: '1' });
    const res = await fetch(`https://openlibrary.org/search.json?${params}`);
    if (!res.ok) return null;
    const json = await res.json();
    const coverId = json.docs?.[0]?.cover_i;
    return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
  } catch {
    return null; // network hiccup or lookup miss — the gradient fallback covers it
  }
}

export function createBookDrop(container, books = []) {
  const field = document.createElement('div');
  field.className = 'book-fall';
  container.appendChild(field);

  const overlay = document.createElement('div');
  overlay.className = 'book-note-overlay';
  overlay.innerHTML = `
    <div class="book-note-panel" role="dialog" aria-modal="true">
      <button class="book-note-close" type="button" aria-label="Close">&times;</button>
      <div class="book-note-cover" aria-hidden="true"></div>
      <div class="book-note-body">
        <p class="book-note-title"></p>
        <p class="book-note-author"></p>
        <p class="book-note-text"></p>
      </div>
    </div>`;
  container.appendChild(overlay);
  const notePanel = overlay.querySelector('.book-note-panel');
  const noteCoverEl = overlay.querySelector('.book-note-cover');
  const noteTitleEl = overlay.querySelector('.book-note-title');
  const noteAuthorEl = overlay.querySelector('.book-note-author');
  const noteTextEl = overlay.querySelector('.book-note-text');

  function openNote(book, coverStyle) {
    noteTitleEl.textContent = book.title;
    noteAuthorEl.textContent = book.author;
    noteTextEl.textContent = book.note;
    noteCoverEl.setAttribute('style', coverStyle);
    overlay.classList.add('open');
  }
  function closeNote() {
    overlay.classList.remove('open');
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeNote();
  });
  overlay.querySelector('.book-note-close').addEventListener('click', closeNote);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNote();
  });

  const items = books.map((b, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'book-card';
    card.setAttribute('aria-label', `${b.title} by ${b.author} — click for a note`);
    const [c1, c2] = COVER_COLORS[i % COVER_COLORS.length];
    const fallbackStyle = `background: linear-gradient(155deg, ${c1}, ${c2});`;
    card.innerHTML = `
      <span class="book-cover" style="${fallbackStyle}">
        <span class="book-fallback-title">${b.title}</span>
      </span>
      <span class="book-caption">
        <span class="book-caption-title">${b.title}</span>
        <span class="book-caption-author">${b.author}</span>
      </span>`;
    const coverEl = card.querySelector('.book-cover');
    let coverStyle = fallbackStyle;

    fetchCoverUrl(b.title, b.author).then((url) => {
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        coverEl.style.background = `#111 url("${url}") center/cover no-repeat`;
        coverEl.classList.add('has-image');
        coverStyle = `background: #111 url("${url}") center/cover no-repeat;`;
      };
      img.src = url;
    });

    card.addEventListener('click', () => openNote(b, coverStyle));
    field.appendChild(card);
    return card;
  });

  let played = false;

  function play() {
    if (played) return;
    played = true;
    if (REDUCED) {
      gsap.set(items, { y: 0, opacity: 1, rotate: 0 });
      return;
    }
    gsap.set(items, {
      y: () => gsap.utils.random(-420, -260),
      x: () => gsap.utils.random(-18, 18),
      opacity: 0,
      rotate: () => gsap.utils.random(-22, 22),
    });
    gsap.to(items, {
      y: 0,
      x: 0,
      opacity: 1,
      rotate: () => gsap.utils.random(-6, 6),
      duration: 1.3,
      ease: 'bounce.out',
      stagger: { each: 0.12, from: 'random' },
    });
  }

  return {
    play,
    dispose() {
      field.remove();
      overlay.remove();
    },
  };
}
