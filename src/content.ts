import type { DestinationId } from './flight';

// Everything the planets say lives here. Titles appear above the planets and in the destination bar. Each entry is a
// stop on the planet's road: the rover drives to it and its card opens. Taken from Omar's CV.

export const TITLES: Record<DestinationId, string> = {
  home: 'About me',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  skills: 'Skills',
  contact: 'Contact',
};

/** Each planet's air: its atmosphere glow, the haze you fall through on the way down, the horizon on the ground. */
export const AIR: Record<DestinationId, string> = {
  home: '#86c3ff', experience: '#a7b4ff', projects: '#9fdcff', education: '#d0b8ff', skills: '#a6f2e6', contact: '#ffb8e2',
};

export type Entry = {
  title: string;
  /** Short name for the tag over its stop on the planet (defaults to the title). */
  label?: string;
  meta?: string;
  text?: string;
  points?: string[];
  tags?: string[];
  link?: { label: string; href: string };
};
export type Section = { heading: string; lead: string; entries: Entry[] };

export const SECTIONS: Record<DestinationId, Section> = {
  home: {
    heading: 'Hey, I’m Omar.',
    lead: 'Full stack & AI software engineer. I build web and mobile apps that put AI agents to work.',
    entries: [
      { title: 'Who I am', meta: 'Full Stack & AI Software Engineer · Morocco', text: 'Four years of designing, building and shipping web and mobile apps with React, Next.js and Node.js, more and more of them built around AI agents and LLMs.' },
      { title: 'How I work', text: 'End to end: I gather what the client needs, turn it into a technical plan, build it, take it to production, and report back on how it is used.' },
      { title: 'What’s in my orbit', text: 'Boxing, music, cinema, painting and philosophy: different ways to move, feel, see and ask questions.' },
    ],
  },
  experience: {
    heading: 'Where I’ve worked',
    lead: 'Four years of shipping products, from AI platforms to public-sector dashboards.',
    entries: [
      {
        title: 'Full Stack Engineer & IT Project Manager', label: 'Awlers', meta: 'Awlers · Rabat · May 2022 – present',
        text: 'I manage and build the company’s AI products, from the first client meeting to production.',
        points: [
          'A multi-agent career assistant for the World Bank, on WhatsApp',
          'Avigen, an AI video and image generation platform',
          'MCP servers that connect the company’s platforms to AI agents',
        ],
        tags: ['OpenAI Agents SDK', 'Node.js', 'React', 'MCP'],
      },
      {
        title: 'Data, mobile and web platforms', label: 'Awlers · platforms', meta: 'Awlers · alongside the AI work',
        points: [
          'A volatility dashboard for Morocco’s Unified Social Registry (RSU), covering the ASD and AMO Tadamon programmes',
          'A social media monitoring platform with web scraping and AI analysis',
          'The “1000 First Days” app for young parents (React Native, Expo) and its online course',
          'The company website, on Next.js and Strapi',
        ],
      },
      {
        title: 'Deployment and client delivery', label: 'Awlers · delivery', meta: 'Awlers · infrastructure and project management',
        points: [
          'Apps deployed on Ubuntu VPS (Coolify, CloudPanel), PM2, Docker, AWS and GCP',
          'Automated testing, performance reports and high availability',
          'Requirements gathering, solution design and client presentations',
          'Production rollouts and weekly usage reports',
        ],
      },
      {
        title: 'Web Developer (internship)', label: 'Tekinside', meta: 'Tekinside · Rabat · Jan – Mar 2023',
        points: ['Custom features in PHP, HTML and CSS; theme and plugin integration', 'Faster pages, better SEO and mobile support'],
      },
    ],
  },
  projects: {
    heading: 'Things I’ve built',
    lead: 'AI platforms, LLM infrastructure and the apps around them.',
    entries: [
      {
        title: 'World Bank career assistant', label: 'World Bank', meta: 'Multi-agent assistant · WhatsApp',
        text: 'Career guidance for young graduates from a team of AI agents, reachable on WhatsApp. I managed and built it, supported the rollout and reported usage every week.',
        tags: ['OpenAI Agents SDK', 'Node.js', 'Express', 'React', 'WhatsApp Cloud API'],
      },
      {
        title: 'Avigen', meta: 'AI video and image generation',
        text: 'Containerised microservices (front end, API, Nginx gateway, MongoDB, PostgreSQL) and an AI video agent, driven over MCP, that writes, directs and edits.',
        tags: ['Docker Compose', 'MCP', 'MongoDB', 'PostgreSQL', 'Nginx'],
      },
      {
        title: 'gRPC LLM Gateway', meta: 'Mykonos',
        text: 'A single gRPC service as the only way to reach LLM providers: streaming chat, embeddings and reranking, with Redis capacity leases, per-session budgets and tracing that never logs prompts.',
        tags: ['Python asyncio', 'gRPC', 'Redis', 'PostgreSQL', 'OpenTelemetry', 'ONNX'],
      },
      {
        title: 'ProjectX', meta: 'Freelance · supplier offer ingestion',
        text: 'Reads supplier offers from email and WhatsApp (PDF, Excel, images), turns them into product lines with Claude, applies business rules and sends them to human review.',
        tags: ['FastAPI', 'PostgreSQL', 'Anthropic API', 'React', 'AWS'],
      },
      {
        title: 'This little universe', label: 'This universe', meta: 'React · Three.js',
        text: 'The portfolio you’re exploring: my head is the sun, and every planet holds part of the story.',
      },
    ],
  },
  education: {
    heading: 'What I’ve studied',
    lead: 'Five years of higher education, from software development to big data and the cloud.',
    entries: [
      { title: 'Master’s in Data Science & Engineering', label: 'Master’s', meta: 'ESFI Mohammedia · Big Data & Cloud Computing · 2024 – 2026', text: 'Distributed architectures and middleware, web services, Big Data, AI and multi-agent systems, mobile and IoT.' },
      { title: 'Professional Bachelor’s, Web & Mobile Development', label: 'Bachelor’s', meta: 'Faculty of Sciences, Kénitra · 2022 – 2023', text: 'Software design, object-oriented programming, JavaScript, PHP and databases.' },
      { title: 'Specialised Technician Diploma, Software Development', label: 'Diploma', meta: 'ISTA · 2020 – 2022', text: 'Server-side programming, client–server architecture, databases and project management.' },
      { title: 'Certifications', meta: 'Programmes', points: ['Llama Design Drive (2025), Meta and Startupbootcamp: an accelerator for building AI agents', 'Web Development Bootcamp, 3W Academy'] },
    ],
  },
  skills: {
    heading: 'What I work with',
    lead: 'The tools I reach for when an idea needs to become real.',
    entries: [
      { title: 'AI & LLMs', tags: ['OpenAI API', 'Agents SDK', 'Claude', 'OpenRouter', 'LangChain', 'MCP', 'LLM gateways', 'Embeddings & reranking', 'Multi-agent systems'] },
      { title: 'Front end & mobile', tags: ['React', 'Next.js', 'TypeScript', 'Redux', 'React Router', 'Tailwind CSS', 'React Native', 'Expo'] },
      { title: 'Back end & data', tags: ['Node.js', 'Express', 'FastAPI', 'Python', 'Strapi', 'gRPC', 'REST', 'Webhooks', 'Job queues', 'MongoDB', 'PostgreSQL', 'Redis'] },
      { title: 'DevOps & cloud', tags: ['Docker', 'CI/CD', 'Nginx', 'Caddy', 'PM2', 'Linux', 'Coolify', 'AWS', 'GCP', 'OpenTelemetry', 'Sentry', 'Prometheus'] },
      { title: 'Leading projects', text: 'Requirements and analysis, turning needs into technical solutions, tracking delivery, supporting rollouts and reporting to clients, the Agile way.' },
    ],
  },
  contact: {
    heading: 'Say hello',
    lead: 'Have an idea, a role or a question? I’d like to hear it.',
    entries: [
      { title: 'Email', link: { label: 'omaraafir69@gmail.com', href: 'mailto:omaraafir69@gmail.com' } },
      // TODO: swap the search link for the direct profile URL.
      { title: 'LinkedIn', link: { label: 'AAFIR Omar', href: 'https://www.linkedin.com/search/results/people/?keywords=AAFIR%20Omar' } },
      { title: 'GitHub', link: { label: 'github.com/Amadeus-3', href: 'https://github.com/Amadeus-3' } },
      { title: 'Where I am', text: 'Morocco. Open to remote work and to relocating; eligible for a German EU Blue Card.' },
    ],
  },
};
