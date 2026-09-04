/**
 * Renders public/og-image.svg to a PNG for link previews.
 *
 *   npm run og:image
 *
 * Facebook, LinkedIn, WhatsApp, Slack and X do not render SVG in og:image —
 * a link shared with only an SVG shows no preview at all. The SVG stays the
 * source of truth; this produces the raster the scrapers can actually read.
 */

import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'public', 'og-image.svg')
const target = join(root, 'public', 'og-image.png')

const info = await sharp(source, { density: 192 })
  .resize(1200, 630, { fit: 'contain', background: '#16261f' })
  .png({ compressionLevel: 9 })
  .toFile(target)

console.log(`og-image.png — ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`)
