// Single source of truth for real-world content, shared by all 5 concepts
// so they present consistent (not divergently invented) information. Keep
// this in sync across concepts — edit here, not per-concept.
//
// TODO(santiago): everything marked TODO below is a placeholder. Don't
// invent specifics (names, links, achievements) when extending a concept —
// leave the placeholder and flag it instead.

export const person = {
  name: 'Santiago',
};

export const links = {
  github: { url: 'https://github.com/TODO-santiago', handle: '@TODO-santiago' },
  instagram: { url: 'https://instagram.com/TODO-santiago', handle: '@TODO-santiago' },
  email: { address: 'TODO@example.com' },
};

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
