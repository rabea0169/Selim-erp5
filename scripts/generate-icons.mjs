// سكريبت توليد أيقونات PWA بأحجام مختلفة
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.join(__dirname, '..', 'public')

// إنشاء أيقونة بخلفية خضراء + رمز 👕
async function createIcon(size, filename, maskable = false) {
  const padding = maskable ? Math.floor(size * 0.1) : 0
  const innerSize = size - padding * 2

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#0d9488"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      <text x="50%" y="50%" font-size="${innerSize * 0.55}" text-anchor="middle" dominant-baseline="central" fill="white">👕</text>
    </svg>
  `

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(PUBLIC_DIR, filename))

  console.log(`✅ تم إنشاء ${filename} (${size}x${size})`)
}

async function createAppleTouchIcon() {
  const size = 180
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#10b981"/>
      <text x="50%" y="50%" font-size="${size * 0.55}" text-anchor="middle" dominant-baseline="central" fill="white">👕</text>
    </svg>
  `
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'))
  console.log(`✅ تم إنشاء apple-touch-icon.png (${size}x${size})`)
}

async function createFavicon() {
  const size = 32
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="6" fill="#10b981"/>
      <text x="50%" y="50%" font-size="${size * 0.6}" text-anchor="middle" dominant-baseline="central" fill="white">👕</text>
    </svg>
  `
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon.png'))
  console.log(`✅ تم إنشاء favicon.png (${size}x${size})`)
}

async function main() {
  console.log('🎨 بدء توليد أيقونات PWA...\n')

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true })
  }

  // أحجام قياسية
  await createIcon(192, 'icon-192.png')
  await createIcon(512, 'icon-512.png')
  await createIcon(192, 'icon-192-maskable.png', true)
  await createIcon(512, 'icon-512-maskable.png', true)

  // Apple Touch Icon
  await createAppleTouchIcon()

  // Favicon
  await createFavicon()

  console.log('\n🎉 تم إنشاء كل الأيقونات بنجاح!')
}

main().catch(console.error)
