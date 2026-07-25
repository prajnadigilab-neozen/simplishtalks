import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = './public';

const imagesToOptimize = [
  { name: 'brand-image', pngQuality: 80, webpQuality: 80, avifQuality: 70 },
  { name: 'simplish_logo_final1', pngQuality: 85, webpQuality: 85, avifQuality: 75 },
  { name: 'female_coach', pngQuality: 80, webpQuality: 80, avifQuality: 70 },
  { name: 'male_coach', pngQuality: 80, webpQuality: 80, avifQuality: 70 },
  { name: 'mic_icon', pngQuality: 85, webpQuality: 85, avifQuality: 75 },
  { name: 'logo-new', pngQuality: 85, webpQuality: 85, avifQuality: 75 },
];

async function optimize() {
  for (const img of imagesToOptimize) {
    const pngPath = path.join(publicDir, `${img.name}.png`);
    if (!fs.existsSync(pngPath)) continue;

    const inputBuffer = fs.readFileSync(pngPath);
    const initialSize = inputBuffer.length;

    // 1. Optimize PNG (only overwrite if smaller)
    const compressedPng = await sharp(inputBuffer)
      .png({ compressionLevel: 9, quality: img.pngQuality })
      .toBuffer();
    if (compressedPng.length < initialSize) {
      fs.writeFileSync(pngPath, compressedPng);
    }

    // 2. Generate WebP
    const webpPath = path.join(publicDir, `${img.name}.webp`);
    const compressedWebp = await sharp(inputBuffer)
      .webp({ quality: img.webpQuality })
      .toBuffer();
    fs.writeFileSync(webpPath, compressedWebp);

    // 3. Generate AVIF
    const avifPath = path.join(publicDir, `${img.name}.avif`);
    const compressedAvif = await sharp(inputBuffer)
      .avif({ quality: img.avifQuality })
      .toBuffer();
    fs.writeFileSync(avifPath, compressedAvif);

    const finalPngSize = fs.statSync(pngPath).size;
    console.log(`${img.name}:`);
    console.log(`  Initial PNG: ${(initialSize / 1024).toFixed(1)} KB`);
    console.log(`  Final PNG:   ${(finalPngSize / 1024).toFixed(1)} KB`);
    console.log(`  New WebP:    ${(compressedWebp.length / 1024).toFixed(1)} KB`);
    console.log(`  New AVIF:    ${(compressedAvif.length / 1024).toFixed(1)} KB`);
  }
}

optimize().catch(err => {
  console.error(err);
  process.exit(1);
});
