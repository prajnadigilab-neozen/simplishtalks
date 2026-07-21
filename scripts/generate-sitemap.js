import fs from 'fs';
import path from 'path';

const SITE_URL = process.env.VITE_SITE_URL || 'https://talks.simplish.in';
const sitemapPath = path.resolve('public/sitemap.xml');
const today = new Date().toISOString().split('T')[0];

const routes = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/packages', priority: '0.8', changefreq: 'weekly' },
  { url: '/curriculum', priority: '0.8', changefreq: 'weekly' },
  { url: '/discover', priority: '0.7', changefreq: 'weekly' },
  { url: '/login', priority: '0.6', changefreq: 'monthly' },
  { url: '/register', priority: '0.6', changefreq: 'monthly' },
  { url: '/placement', priority: '0.5', changefreq: 'monthly' },
];

const generateSitemap = () => {
  console.log(`Generating sitemap for ${SITE_URL}...`);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  routes.forEach(route => {
    xml += `  <url>\n`;
    xml += `    <loc>${SITE_URL}${route.url}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    xml += `    <priority>${route.priority}</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>\n`;

  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log(`✅ Sitemap successfully generated at ${sitemapPath}`);
};

generateSitemap();
