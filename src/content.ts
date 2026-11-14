import type { DestinationId } from './flight';

// Everything the planets say lives here. Titles appear above the planets and in the destination bar; each section's
// entries become the floating cards you find when you land on that planet.
// Entries marked TODO are placeholders waiting for Omar's real details.

export const TITLES: Record<DestinationId, string> = {
  home: 'About me',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  skills: 'Skills',
  contact: 'Contact',
};

export type Entry = { title: string; meta?: string; text?: string; link?: { label: string; href: string } };
export type Section = { heading: string; lead: string; entries: Entry[] };

export const SECTIONS: Record<DestinationId, Section> = {
  home: {
    heading: 'Hey, I’m Omar.',
    lead: 'Creative ideas. Complex problems. Useful software.',
    entries: [
      { title: 'Who I am', text: 'A software developer who enjoys building creative, complex apps that are genuinely useful to the people using them.' },
      { title: 'What’s in my orbit', text: 'Boxing, music, cinema, painting and philosophy: different ways to move, feel, see and ask questions.' },
      { title: 'What drives me', text: 'The challenge of making something creative and complex feel simple to use.' },
    ],
  },
  experience: {
    heading: 'Where I’ve worked',
    lead: 'The teams and products that shaped how I build.',
    entries: [
      // TODO: replace with real roles, newest first.
      { title: 'Role title', meta: 'Company · Year – present', text: 'What you built there, and the difference it made.' },
      { title: 'Previous role', meta: 'Company · Year – Year', text: 'A short line on the problems you solved.' },
    ],
  },
  projects: {
    heading: 'Things I’ve made',
    lead: 'Creative, complex, and useful: the projects I’m proudest of.',
    entries: [
      // TODO: replace with real projects and links.
      { title: 'This little universe', meta: 'React · Three.js', text: 'A portfolio you fly through: my head is the sun, every planet holds part of the story.' },
      { title: 'Project name', meta: 'Stack', text: 'One line on what it does and why it’s interesting.', link: { label: 'View project', href: '#' } },
    ],
  },
  education: {
    heading: 'What I’ve studied',
    lead: 'Where the foundations came from.',
    entries: [
      // TODO: replace with real degrees, schools and courses.
      { title: 'Degree or programme', meta: 'School · Year – Year', text: 'Focus, highlights, or a project worth mentioning.' },
    ],
  },
  skills: {
    heading: 'What I work with',
    lead: 'Tools I reach for when an idea needs to become real.',
    entries: [
      // TODO: replace with your actual stack.
      { title: 'Frontend', text: 'React, TypeScript, Three.js' },
      { title: 'Backend', text: 'Languages, frameworks and databases you use' },
      { title: 'Craft', text: 'Product thinking, interaction design, 3D on the web' },
    ],
  },
  contact: {
    heading: 'Say hello',
    lead: 'Have an idea, a role, or a question? I’d like to hear it.',
    entries: [
      // TODO: replace the links with your real profiles and email.
      { title: 'Email', link: { label: 'your@email.com', href: 'mailto:your@email.com' } },
      { title: 'GitHub', link: { label: 'github.com/your-handle', href: '#' } },
      { title: 'LinkedIn', link: { label: 'linkedin.com/in/your-handle', href: '#' } },
    ],
  },
};
