# Omar — A little universe

An interactive portfolio you fly through. My head is the sun at the centre of a small solar system; each planet holds part of the story (Experience, Projects, Education, Skills, Contact). Built with React, TypeScript, Three.js and React Three Fiber.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` type-checks and builds to `dist/`. `npm test` checks flight, collisions, and that the autopilot reaches every planet from anywhere without touching a body; and, on the planets, that the road reaches every stop with the scenery kept off it, and that driving by hand respects obstacles and the edge of the area.

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
- Arriving at a planet, you fall through its air, the rocket makes a powered descent onto its pad, and a rover is lowered to the ground
- On a planet the rover is yours: WASD / arrow keys drive it (touch screens get drive pads). The painted road leads from the rocket past every stop, with a light running along it towards the next stop you haven't seen; off the road, an arrow by the rover points back to it
- After landing, the rocket's door drops into a ramp and the rover drives out. Each stop has a painted stop line across the road. Pull up beside a station and press **E** (or tap the prompt) to unfold its board; the camera squares up to read it. E or Esc closes it, and so does driving off. The dots at the bottom show which stops you've read
- **Fly to** goes on to the next planet; Esc returns to space
- Touch screens get directional buttons in space

## Editing the content

Everything the planets say is in `src/content.ts`: titles, headings and entries, taken from my CV. Each entry becomes a stop on that planet's road (`label` is the short name on its tag).

## The head

`public/models/omar-meshy-toy.glb` (1.3 MB) is generated in Meshy (Smart Topology) from a toy-style reference image, then prepared for the web with:

```sh
npm run prepare:head
```

`scripts/prepare-clay-head.mjs` keeps the model's parts, fixes face orientation, shrinks the texture to 1K and normalises size and position. It can also simplify dense exports and cut off a modelled neck (`NECK=<fraction>`). Reference art and raw models live in `docs/art/`, which is kept out of git.
