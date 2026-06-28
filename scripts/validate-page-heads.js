import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { servicePages } from '../seo/serviceMenuUtils.js';

const root = process.cwd();
const publicDir = join(root, 'public');
const finalPagesDir = join(publicDir, 'final-pages');
const standardPageFiles = [
  'index.html',
  'assistant.html',
  'services.html',
  'price.html',
  'process.html',
  'about.html',
  'location.html',
  'contacts.html',
  'privacy-policy.html',
];
const routes = new Map();
const errors = [];
const draftTextPatterns = [
  /SEO-заготовка/i,
  /SEO-фундамент/i,
  /SEO-страница/i,
  /SEO-структура/i,
  /будущих SEO/i,
  /будет раскрыт/i,
  /будущие фотографии/i,
  /Блок подготовлен/i,
  /прайс-листа/i,
];

function getAttr(tag, name) {
  const pattern = "\\b" + name + "=[\"']([^\"']*)[\"']";
  return tag.match(new RegExp(pattern, 'i'))?.[1] || '';
}

function firstTag(html, pattern) {
  return html.match(pattern)?.[0] || '';
}

function head(html) {
  return html.match(/<head>[\s\S]*?<\/head>/i)?.[0] || '';
}

function title(htmlHead) {
  return htmlHead.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
}

function canonical(htmlHead) {
  const tag = htmlHead
    .match(/<link\b[^>]*>/gi)
    ?.find((item) => getAttr(item, 'rel').toLowerCase() === 'canonical');
  return tag ? getAttr(tag, 'href') : '';
}

function canonicalRoute(value) {
  if (!value) return '';
  return new URL(value, 'https://atelier.local').pathname.replace(/\/+$/, '') || '/';
}

function rememberRoute(route, source) {
  if (!route) {
    errors.push(`${source}: missing canonical route`);
    return;
  }

  if (routes.has(route)) {
    errors.push(`${source}: duplicate route ${route} also used by ${routes.get(route)}`);
    return;
  }

  routes.set(route, source);
}

function validateHtmlPage(filePath, source, options = {}) {
  if (!existsSync(filePath)) {
    errors.push(`${source}: missing file`);
    return;
  }

  const html = readFileSync(filePath, 'utf8');
  const htmlHead = head(html);
  validateNoDraftText(html, source);

  if (!htmlHead) errors.push(`${source}: missing <head>`);
  if (!title(htmlHead)) errors.push(`${source}: missing <title>`);
  if (!getAttr(firstTag(htmlHead, /<meta\s+name=["']description["'][\s\S]*?>/i), 'content')) {
    errors.push(`${source}: missing meta description`);
  }

  const route = canonicalRoute(canonical(htmlHead));
  rememberRoute(route, source);

  if (options.finalPage && /(href|src|content)=["']\.\//.test(html)) {
    errors.push(`${source}: contains relative ./ asset paths`);
  }
}

function validateNoDraftText(text, source) {
  const matched = draftTextPatterns.find((pattern) => pattern.test(text));
  if (matched) {
    errors.push(`${source}: contains draft SEO text (${matched.source})`);
  }
}

standardPageFiles.forEach((file) => {
  validateHtmlPage(join(publicDir, file), `public/${file}`);
});

readdirSync(finalPagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .forEach((entry) => {
    validateHtmlPage(
      join(finalPagesDir, entry.name, 'index.html'),
      `public/final-pages/${entry.name}/index.html`,
      { finalPage: true }
    );
  });

servicePages.forEach((page) => {
  validateNoDraftText(
    [
      page.seoTitle,
      page.seoDescription,
      page.h1,
      page.introText,
      page.heroUsp,
      page.priceNote,
      ...(page.availableOptions || []),
      ...(page.pricingFactors || []),
      ...(page.processSteps || []),
      ...(page.materials || []),
      ...(page.galleryItems || []).flatMap((item) => [item.title, item.description]),
      ...(page.whyItems || []).flatMap((item) => [item.title, item.description]),
      ...(page.faq || []).flatMap((item) => [item.question, item.answer]),
    ].filter(Boolean).join('\n'),
    `serviceMenuData:${page.path}`
  );
});

if (errors.length) {
  console.error(`HTML head validation failed: ${errors.length} error(s)`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`HTML head validation passed: ${routes.size} HTML routes checked.`);
