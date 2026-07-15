// Single source of truth for site copy. See CLAUDE.md and the
// grace-menu-section skill before adding/removing entries — the menu,
// panels, and icons are all driven from here.

export const loadingTips = [
  'Tip: Vigor increases your maximum HP. Sleep increases your maximum patience.',
  'Tip: If a model refuses to converge, try lowering the learning rate — or your expectations.',
  'Tip: Every bug is an NPC waiting to drop a rare item once defeated.',
  'Tip: Piano scales and neural nets both punish you for skipping practice.',
  'Tip: Ashes of War can be swapped freely. Deadlines cannot.',
  'Tip: A Site of Grace restores HP and FP. A good commit message restores sanity.',
  'Tip: When in doubt, roll — in code, that means committing before you refactor.',
  'Tip: Some say the jack of all trades masters none. They have not met Santiago.',
  'Tip: Try adjusting your Flasks. Or your hyperparameters. Similar ritual, similar hope.',
  'Tip: This page has no invisible walls, but it does have a few hidden easter eggs.',
];

// The location name shown in the grace menu header, mirroring how the game
// shows "Agheel Lake North" etc. — see NEW_RFERENCE.webp in design-reference/.
export const graceName = "Santiago's Place";

export const graceMenu = [
  {
    id: 'passtime',
    label: 'Pass Time',
    icon: 'passtime',
    summary: 'Let the light shift — morning, afternoon, or evening.',
  },
  {
    id: 'ml-projects',
    label: 'ML Projects',
    icon: 'projects',
    summary: 'Models, experiments, and things that (mostly) trained successfully.',
  },
  {
    id: 'piano',
    label: 'Piano',
    icon: 'piano',
    summary: 'A lifelong duet with music — press a few keys.',
  },
  {
    id: 'hobbies',
    label: 'Hobbies',
    icon: 'hobbies',
    summary: 'What fills the time between builds and boss fights.',
  },
  {
    id: 'arsenal',
    label: 'Arsenal',
    icon: 'arsenal',
    summary: 'The tools and languages currently in rotation.',
  },
  {
    id: 'instagram',
    label: 'Instagram Channel',
    icon: 'instagram',
    summary: 'Cross over to the visual side of the story.',
  },
  {
    id: 'contact',
    label: 'Contacts',
    icon: 'mail',
    summary: 'Send a summon sign — GitHub, Instagram, email.',
  },
  {
    id: 'flasks',
    label: 'Adjust Flasks',
    icon: 'flask',
    summary: 'Mix a different Wondrous Physick for this page.',
  },
  {
    id: 'levelup',
    label: 'Level Up',
    icon: 'levelup',
    summary: 'Spend runes on entirely fictional stats.',
  },
];

// TODO(santiago): swap these placeholder cards for real projects —
// title, a sentence or two, tags, and a real link each.
export const projects = [
  {
    title: 'Untitled Project I',
    description:
      'TODO(santiago): describe what this project does, the problem it solves, and the stack you used.',
    tags: ['TODO', 'ML'],
    links: [{ label: 'GitHub', url: '#' }],
  },
  {
    title: 'Untitled Project II',
    description: 'TODO(santiago): another project slot, ready whenever you are.',
    tags: ['TODO'],
    links: [{ label: 'GitHub', url: '#' }],
  },
  {
    title: 'Untitled Project III',
    description: 'TODO(santiago): a third slot — delete if you only have two to show right now.',
    tags: ['TODO'],
    links: [{ label: 'GitHub', url: '#' }],
  },
];

export const piano = {
  intro:
    "TODO(santiago): a few sentences on your relationship with piano — how long you've played, what you love performing, anything you'd want a visitor to know.",
};

// TODO(santiago): replace with your real hobbies. "Exploring the Lands
// Between" is left in because a site like this doesn't happen without a
// genuine soft spot for Elden Ring — everything else is a placeholder.
export const hobbies = [
  {
    title: 'Exploring the Lands Between',
    description: 'Elden Ring, evidently. This entire page is the confession.',
  },
  {
    title: 'Hobby Two',
    description: 'TODO(santiago): what else do you do with your time?',
  },
  {
    title: 'Hobby Three',
    description: 'TODO(santiago): another one, or delete this slot.',
  },
];

// TODO(santiago): fill in your real handles/links — used by both the
// Instagram Channel section and the Contact section.
export const links = {
  github: { url: 'https://github.com/TODO-santiago', handle: '@TODO-santiago' },
  instagram: { url: 'https://instagram.com/TODO-santiago', handle: '@TODO-santiago' },
  email: { address: 'TODO@example.com' },
};

export const instagramChannel = {
  blurb: 'TODO(santiago): what does your channel document — piano, projects, the Lands Between?',
};

export const timesOfDay = [
  { id: 'morning', label: 'Morning', description: 'Cool light, long shadows over Limgrave.' },
  { id: 'afternoon', label: 'Afternoon', description: 'Full sun over the grass and the golden trees.' },
  { id: 'evening', label: 'Evening', description: 'The sky burns over the hills before dark.' },
];

// TODO(santiago): swap for your real stack — languages, frameworks, tools.
export const arsenal = [
  { name: 'TODO', category: 'Language' },
  { name: 'TODO', category: 'ML / Framework' },
  { name: 'TODO', category: 'Tool' },
  { name: 'TODO', category: 'Tool' },
];

export const flaskThemes = [
  { id: 'gold', label: 'Gold Flask', description: 'The original consecrated gold.' },
  { id: 'crimson', label: 'Crimson Flask', description: 'A warmer, blood-red accent.' },
  { id: 'cerulean', label: 'Cerulean Flask', description: 'A cool, focused blue accent.' },
  { id: 'verdant', label: 'Verdant Flask', description: 'A calm, verdant-green accent.' },
];

export const levelupStats = [
  { id: 'focus', label: 'Focus', flavor: 'Deep work without checking Slack.' },
  { id: 'caffeine', label: 'Caffeine Tolerance', flavor: 'Espresso is now a food group.' },
  { id: 'debugging', label: 'Debugging Stamina', flavor: 'Staring at a stack trace until it confesses.' },
  { id: 'curiosity', label: 'Curiosity', flavor: 'Opening seventeen tabs. Closing zero.' },
  { id: 'typing', label: 'Typing Speed', flavor: 'Ctrl+S is a nervous tic at this point.' },
  { id: 'rhythm', label: 'Rhythm', flavor: 'Piano fingers, mechanical-keyboard hands.' },
  { id: 'ideas', label: '3am Ideas', flavor: 'Arcane knowledge nobody asked for.' },
];
