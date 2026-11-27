// Generates the certificate rope border used on verification and lobby surfaces.
// Run: node scripts/gen-guilloche.mjs   (output is committed; no runtime cost)
import { mkdirSync, writeFileSync } from "node:fs"

const f = (n) => Math.round(n * 10) / 10

mkdirSync("public/decor", { recursive: true })

// Rope band: four phase-shifted sines that cross like engraved rope, designed for a 10-14px strip.
// One tile is exactly one period so it repeats seamlessly.
const waves = []
const W = 32
const H = 16
for (let j = 0; j < 4; j++) {
  let p = ""
  for (let x = 0; x <= W; x += 0.5) {
    const y = H / 2 + Math.sin((x / W) * Math.PI * 2 + (j * Math.PI) / 2) * (H / 2 - 1.5)
    p += (x ? "L" : "M") + f(x) + " " + f(y)
  }
  waves.push(p)
}
writeFileSync(
  "public/decor/guilloche-wave.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="#000" stroke-width="0.9">${waves
    .map((d) => `<path d="${d}"/>`)
    .join("")}<path d="M0 0.5H${W}M0 ${H - 0.5}H${W}" stroke-width="0.7"/></svg>`
)
console.log("wrote public/decor/guilloche-wave.svg")
