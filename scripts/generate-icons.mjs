// Renders the app icon set into public/icons. Run with `npm run icons` after changing the artwork.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const outDir = fileURLToPath(new URL("../public/icons/", import.meta.url));

/**
 * @param {{ cornerRadius: number, scale: number }} options `scale` shrinks the artwork towards the
 * centre so a maskable icon keeps it inside the safe zone.
 */
function artwork({ cornerRadius, scale }) {
  const offset = (512 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#131f3d"/>
      <stop offset="1" stop-color="#060912"/>
    </linearGradient>
    <linearGradient id="flow" gradientUnits="userSpaceOnUse" x1="110" y1="420" x2="330" y2="170">
      <stop offset="0" stop-color="#3ee6a8"/>
      <stop offset="0.55" stop-color="#ffc94a"/>
      <stop offset="1" stop-color="#ff4f6d"/>
    </linearGradient>
    <radialGradient id="ball" cx="0.36" cy="0.3" r="0.85">
      <stop offset="0" stop-color="#f3ffa6"/>
      <stop offset="0.55" stop-color="#d6ff3f"/>
      <stop offset="1" stop-color="#9ccc17"/>
    </radialGradient>
    <clipPath id="ballClip"><circle cx="348" cy="164" r="84"/></clipPath>
  </defs>
  <rect width="512" height="512" rx="${cornerRadius}" fill="url(#bg)"/>
  <g transform="translate(${offset - 16 * scale} ${offset + 8 * scale}) scale(${scale})">
    <path d="M118 424 C118 300 262 336 262 244 C262 204 292 184 330 178" fill="none" stroke="#0a1022" stroke-width="84" stroke-linecap="round"/>
    <path d="M118 424 C118 300 262 336 262 244 C262 204 292 184 330 178" fill="none" stroke="url(#flow)" stroke-width="58" stroke-linecap="round"/>
    <path d="M118 424 C118 300 262 336 262 244 C262 204 292 184 330 178" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="7" stroke-linecap="round" stroke-dasharray="20 26"/>
    <circle cx="348" cy="164" r="100" fill="#0b1226"/>
    <circle cx="348" cy="164" r="84" fill="url(#ball)"/>
    <g clip-path="url(#ballClip)" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="9" stroke-linecap="round">
      <path d="M296 84 C338 124 338 204 296 244"/>
      <path d="M400 84 C358 124 358 204 400 244"/>
    </g>
  </g>
</svg>
`;
}

const standard = artwork({ cornerRadius: 116, scale: 1 });
const fullBleed = artwork({ cornerRadius: 0, scale: 1 });
const maskable = artwork({ cornerRadius: 0, scale: 0.78 });

async function png(svg, size, name) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(outDir + name);
}

await mkdir(outDir, { recursive: true });
await writeFile(outDir + "icon.svg", standard);
await png(standard, 192, "icon-192.png");
await png(standard, 512, "icon-512.png");
await png(maskable, 512, "icon-maskable-512.png");
// iOS masks the icon itself and fills transparency with black, so it gets square corners.
await png(fullBleed, 180, "apple-touch-icon.png");
console.log("Icons written to public/icons");
