// توليد أيقونة احترافية لـ Selim ERP
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.join(__dirname, '..', 'public')

// أيقونة ERP احترافية - حرف S على خلفية داكنة مع لمسة ذهبية
async function createIcon(size, filename, maskable = false) {
  const padding = maskable ? Math.floor(size * 0.1) : 0
  const innerSize = size - padding * 2

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="50%" stop-color="#fbbf24"/>
          <stop offset="100%" stop-color="#d97706"/>
        </linearGradient>
        <linearGradient id="emerald" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      
      <!-- دائرة خارجية ذهبية رفيعة -->
      <circle cx="${size/2}" cy="${size/2}" r="${size*0.42}" fill="none" stroke="url(#gold)" stroke-width="${size*0.015}" opacity="0.6"/>
      
      <!-- حرف S بارز -->
      <text x="50%" y="54%" font-size="${innerSize * 0.62}" text-anchor="middle" dominant-baseline="central" fill="url(#gold)" font-family="Georgia, serif" font-weight="bold">S</text>
      
      <!-- نقطة ملونة في الأعلى (لمسة ERP) -->
      <circle cx="${size*0.5}" cy="${size*0.18}" r="${size*0.025}" fill="url(#emerald)"/>
      <circle cx="${size*0.42}" cy="${size*0.18}" r="${size*0.018}" fill="url(#gold)" opacity="0.7"/>
      <circle cx="${size*0.58}" cy="${size*0.18}" r="${size*0.018}" fill="url(#gold)" opacity="0.7"/>
    </svg>
  `

  await sharp(Buffer.from(svg)).png().toFile(path.join(PUBLIC_DIR, filename))
  console.log(`✅ ${filename} (${size}x${size})`)
}

async function createAppleTouchIcon() {
  const size = 180
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#d97706"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size*0.42}" fill="none" stroke="url(#gold)" stroke-width="${size*0.015}" opacity="0.6"/>
      <text x="50%" y="54%" font-size="${size * 0.62}" text-anchor="middle" dominant-baseline="central" fill="url(#gold)" font-family="Georgia, serif" font-weight="bold">S</text>
    </svg>
  `
  await sharp(Buffer.from(svg)).png().toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'))
  console.log(`✅ apple-touch-icon.png`)
}

async function createFavicon() {
  const size = 32
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#d97706"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="6" fill="url(#bg)"/>
      <text x="50%" y="54%" font-size="${size * 0.65}" text-anchor="middle" dominant-baseline="central" fill="url(#gold)" font-family="Georgia, serif" font-weight="bold">S</text>
    </svg>
  `
  await sharp(Buffer.from(svg)).png().toFile(path.join(PUBLIC_DIR, 'favicon.png'))
  console.log(`✅ favicon.png`)
}

// لوجو افتراضي للمصنع (لو المستخدم ما رفعش لوجو)
async function createDefaultFactoryLogo() {
  const width = 400
  const height = 200
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <text x="50%" y="50%" font-size="32" text-anchor="middle" dominant-baseline="central" fill="#64748b" font-family="Tahoma, sans-serif" font-weight="bold">مصنع الملابس</text>
      <text x="50%" y="70%" font-size="16" text-anchor="middle" dominant-baseline="central" fill="#94a3b8" font-family="Tahoma, sans-serif">Factory Logo</text>
    </svg>
  `
  await sharp(Buffer.from(svg)).png().toFile(path.join(PUBLIC_DIR, 'default-factory-logo.png'))
  console.log(`✅ default-factory-logo.png`)
}

async function main() {
  console.log('🎨 توليد أيقونات Selim ERP...\n')
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true })

  await createIcon(192, 'icon-192.png')
  await createIcon(512, 'icon-512.png')
  await createIcon(192, 'icon-192-maskable.png', true)
  await createIcon(512, 'icon-512-maskable.png', true)
  await createAppleTouchIcon()
  await createFavicon()
  await createDefaultFactoryLogo()

  console.log('\n🎉 تم إنشاء كل الأيقونات!')
}

main().catch(console.error)
