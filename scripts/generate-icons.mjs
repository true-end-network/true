#!/usr/bin/env node
/**
 * Generates PWA icons as SVG files that can be served directly.
 * For PNG generation, we create optimized SVGs that render perfectly at each size.
 */
import { writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, "..", "public")

// True logo: shield with "T" — minimal, dark, encrypted feel
function generateSvgIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0a0a0a"/>
  <g transform="translate(256,256)">
    <!-- Shield outline -->
    <path d="M0-160 C80-160 140-120 160-80 L160 40 C160 120 100 170 0 200 C-100 170 -160 120 -160 40 L-160-80 C-140-120 -80-160 0-160Z" fill="none" stroke="#10b981" stroke-width="12" opacity="0.6"/>
    <!-- Inner shield glow -->
    <path d="M0-130 C60-130 110-100 125-70 L125 30 C125 95 75 135 0 160 C-75 135 -125 95 -125 30 L-125-70 C-110-100 -60-130 0-130Z" fill="#10b981" opacity="0.08"/>
    <!-- Letter T -->
    <text x="0" y="35" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="200" font-weight="700" fill="#fafafa" letter-spacing="-8">T</text>
    <!-- Lock keyhole dot -->
    <circle cx="0" cy="110" r="8" fill="#10b981" opacity="0.8"/>
  </g>
</svg>`
}

// Maskable icon (safe area is inner 80%)
function generateMaskableIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  <g transform="translate(256,256)">
    <path d="M0-120 C60-120 100-95 115-65 L115 25 C115 80 70 115 0 140 C-70 115 -115 80 -115 25 L-115-65 C-100-95 -60-120 0-120Z" fill="none" stroke="#10b981" stroke-width="10" opacity="0.6"/>
    <path d="M0-95 C45-95 80-75 92-55 L92 18 C92 60 55 90 0 110 C-55 90 -92 60 -92 18 L-92-55 C-80-75 -45-95 0-95Z" fill="#10b981" opacity="0.08"/>
    <text x="0" y="25" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="150" font-weight="700" fill="#fafafa">T</text>
    <circle cx="0" cy="82" r="6" fill="#10b981" opacity="0.8"/>
  </g>
</svg>`
}

// Apple touch icon (needs solid background, no transparency)
function generateAppleTouchIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="0" fill="#0a0a0a"/>
  <g transform="translate(256,256)">
    <path d="M0-140 C70-140 120-110 140-75 L140 35 C140 105 85 150 0 175 C-85 150 -140 105 -140 35 L-140-75 C-120-110 -70-140 0-140Z" fill="none" stroke="#10b981" stroke-width="11" opacity="0.6"/>
    <path d="M0-115 C55-115 95-90 108-60 L108 28 C108 82 65 115 0 135 C-65 115 -108 82 -108 28 L-108-60 C-95-90 -55-115 0-115Z" fill="#10b981" opacity="0.08"/>
    <text x="0" y="30" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="175" font-weight="700" fill="#fafafa">T</text>
    <circle cx="0" cy="97" r="7" fill="#10b981" opacity="0.8"/>
  </g>
</svg>`
}

// Generate all icon sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  writeFileSync(join(publicDir, `icon-${size}.svg`), generateSvgIcon(size))
}

// Maskable icons
writeFileSync(join(publicDir, "icon-maskable-192.svg"), generateMaskableIcon(192))
writeFileSync(join(publicDir, "icon-maskable-512.svg"), generateMaskableIcon(512))

// Apple touch icon
writeFileSync(join(publicDir, "apple-touch-icon.svg"), generateAppleTouchIcon(180))

// Favicon SVG (modern browsers)
writeFileSync(join(publicDir, "favicon.svg"), generateSvgIcon(32))

console.log("Icons generated successfully!")
console.log(`  Standard: ${sizes.map(s => `icon-${s}.svg`).join(", ")}`)
console.log("  Maskable: icon-maskable-192.svg, icon-maskable-512.svg")
console.log("  Apple: apple-touch-icon.svg")
console.log("  Favicon: favicon.svg")
