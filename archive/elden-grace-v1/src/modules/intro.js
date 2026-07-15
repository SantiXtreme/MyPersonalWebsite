import gsap from 'gsap';
import { motionPrefs } from './motionPrefs.js';

/**
 * The first-paint choreography: "Grace Discovered" banner (mirrors the
 * game's Lost Grace discovery notification) → corner nameplate → title
 * card → the grace symbol drawing itself in beside the resting figure →
 * the "Rest at the Grace" prompt. Returns the GSAP timeline in case the
 * caller wants to know when it settles.
 */
export function playIntroSequence({ graceSymbol, figure }) {
  if (motionPrefs.reduced) {
    gsap.set('.grace-banner', { opacity: 0 });
    gsap.set(['.nameplate', '.title-lockup', '.grace-plot', '.rest-prompt', '.scroll-hint', '.hud'], {
      opacity: 1,
    });
    figure.playIntro();
    graceSymbol.playIntro();
    return gsap.timeline();
  }

  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

  tl.addLabel('start')
    .fromTo('.grace-banner', { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.9 }, 'start+=0.15')
    .to('.grace-banner', { opacity: 0, duration: 0.7 }, 'start+=2.6')
    .fromTo('.nameplate', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'start+=1.6')
    .fromTo('.title-lockup', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1 }, 'start+=1.1')
    .fromTo('.grace-plot', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'start+=1.7')
    .add(() => figure.playIntro(), 'start+=1.75')
    .add(() => graceSymbol.playIntro(), 'start+=2.05')
    .fromTo('.rest-prompt', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6 }, 'start+=3.15')
    .fromTo('.scroll-hint', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'start+=3.35')
    .fromTo('.hud', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 'start+=3.15');

  return tl;
}
