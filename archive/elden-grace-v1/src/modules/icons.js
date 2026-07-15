import projects from '../assets/icons/projects.svg?raw';
import piano from '../assets/icons/piano.svg?raw';
import hobbies from '../assets/icons/hobbies.svg?raw';
import instagram from '../assets/icons/instagram.svg?raw';
import mail from '../assets/icons/mail.svg?raw';
import flask from '../assets/icons/flask.svg?raw';
import levelup from '../assets/icons/levelup.svg?raw';
import leave from '../assets/icons/leave.svg?raw';
import github from '../assets/icons/github.svg?raw';
import passtime from '../assets/icons/passtime.svg?raw';
import arsenal from '../assets/icons/arsenal.svg?raw';

const ICONS = { projects, piano, hobbies, instagram, mail, flask, levelup, leave, github, passtime, arsenal };

export function iconMarkup(id) {
  return ICONS[id] ?? '';
}
