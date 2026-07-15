// Single source of truth for real-world content, presenting consistent
// (not invented) information across the site. Keep this in sync — edit
// here, not inline in main.js.
//
// TODO(santiago): everything marked TODO below is a placeholder. Don't
// invent specifics (names, links, achievements) when extending a section —
// leave the placeholder and flag it instead.

export const person = {
  name: 'Santiago',
  // TODO(santiago): the line that runs under your name on the hero. Placeholder
  // draft below — swap for your own whenever you're ready (you mentioned you'd
  // give me one).
  tagline: 'Chasing the quiet logic underneath music, motion, and the game.',
  photo: null, // TODO(santiago): path to a hero photo, e.g. './assets/photo-hero.jpg'
};

// About section — brief self-introduction, right after the hero.
export const aboutIntro =
  "TODO(santiago): a short paragraph introducing yourself — who you are outside of the five areas below, in your own words.";

// The five "key areas" driving the About section's nav and each one's hero.
export const keyAreas = [
  { id: 'machine-learning', label: 'Machine Learning', index: '01' },
  { id: 'math-physics', label: 'Math & Physics', index: '02' },
  { id: 'volleyball', label: 'Volleyball', index: '03' },
  { id: 'recital', label: 'Piano', index: '04' },
  { id: 'reading', label: 'Reading', index: '05' },
];

export const links = {
  github: { url: 'https://github.com/TODO-santiago', handle: '@TODO-santiago' },
  instagram: { url: 'https://instagram.com/TODO-santiago', handle: '@TODO-santiago' },
  email: { address: 'TODO@example.com' },
};

// Machine learning project cards — the "detailed" ML hero's showcase grid.
export const projects = [
  {
    title: 'Untitled Project I',
    description: 'TODO(santiago): describe what this project does, the problem it solves, and the stack you used.',
    tags: ['TODO', 'ML'],
    url: '#',
  },
  {
    title: 'Untitled Project II',
    description: 'TODO(santiago): another project slot, ready whenever you are.',
    tags: ['TODO'],
    url: '#',
  },
  {
    title: 'Untitled Project III',
    description: 'TODO(santiago): a third slot — delete if you only have two to show right now.',
    tags: ['TODO'],
    url: '#',
  },
];

export const hobbies = [
  { title: 'Exploring the Lands Between', description: 'Elden Ring, evidently.' },
  { title: 'Hobby Two', description: 'TODO(santiago): what else do you do with your time?' },
  { title: 'Hobby Three', description: 'TODO(santiago): another one, or delete this slot.' },
];

export const pianoIntro =
  "TODO(santiago): a few sentences on your relationship with piano — how long you've played, what you love performing, anything you'd want a visitor to know.";

// Volleyball — key-area hero stats + photo slot.
export const volleyball = {
  height: '180cm',
  position: 'Middle Blocker',
  verticalReach: '310cm',
  photo: null, // TODO(santiago): path to a volleyball action photo of you
  intro:
    'TODO(santiago): a couple of sentences on your volleyball background — how long you\'ve played, what position work means to you, any team/league worth naming.',
};

// Reading — favorite books, "key area" hero. Titles/authors are placeholders;
// don't invent real ones — leave as TODO until you hand me the actual list.
export const books = [
  { title: 'TODO(santiago)', author: 'Title one' },
  { title: 'TODO(santiago)', author: 'Title two' },
  { title: 'TODO(santiago)', author: 'Title three' },
  { title: 'TODO(santiago)', author: 'Title four' },
];
