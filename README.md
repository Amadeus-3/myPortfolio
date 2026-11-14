# Omar — A little universe

An interactive portfolio you fly through. My head is the sun at the centre of a small solar system; each planet holds part of the story (Experience, Projects, Education, Skills, Contact). Built with React, TypeScript, Three.js and React Three Fiber.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` type-checks and builds to `dist/`. `npm test` checks flight, collisions, and that the autopilot reaches every planet from anywhere without touching a body.

## Run with Docker

```sh
docker compose up --build
```

Then open http://localhost:8080. The image builds and tests the site with Node, then serves the static files with nginx (about 80 MB). Without Compose:

```sh
docker build -t omar-portfolio .
docker run -p 8080:80 omar-portfolio
```

## Getting around

- Click a planet, its title, or a name in the bottom bar to fly there on autopilot
- E: fly to the nearest planet (its title shows the E hint)
- WASD / arrow keys: fly yourself; Shift: boost; R: back to the start
- Each planet's panel ends with **Next**, to tour every planet in order
- Esc closes a panel; touch screens get directional buttons

## Editing the content

Everything the planets say is in `src/content.ts`: titles, headings and entries. Entries marked `TODO` are placeholders.

## The head

`public/models/omar-meshy-toy.glb` (1.3 MB) is generated in Meshy (Smart Topology) from a toy-style reference image, then prepared for the web with:

```sh
npm run prepare:head
```

`scripts/prepare-clay-head.mjs` keeps the model's parts, fixes face orientation, shrinks the texture to 1K and normalises size and position. It can also simplify dense exports and cut off a modelled neck (`NECK=<fraction>`). Reference art and raw models live in `docs/art/`, which is kept out of git.
