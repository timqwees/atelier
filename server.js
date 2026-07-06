import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { DateTime } from 'luxon';
import { serviceMenuData } from './seo/serviceMenuData.js';
import {
  findServicePageByPath,
  getServiceBreadcrumbs,
  normalizeServicePath,
  servicePages,
} from './seo/serviceMenuUtils.js';
import { menFinalPagesMatrix } from './seo/menFinalPagesMatrix.js';
import { womenFinalPagesMatrix } from './seo/womenFinalPagesMatrix.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const SITE_ORIGIN = (process.env.SITE_ORIGIN || '').replace(/\/$/, '');
const PUBLIC_DIR = join(__dirname, 'public');
const FINAL_PAGES_DIR = join(__dirname, 'public', 'final-pages');
const STANDARD_HTML_PAGE_FILES = [
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
const STANDARD_HTML_PAGES = loadStandardHtmlPages();
const STANDARD_HTML_ROUTES = STANDARD_HTML_PAGES.map((page) => page.route);
const FINAL_SERVICE_PAGES = loadFinalServicePages();
const FINAL_SERVICE_PAGE_ROUTES = FINAL_SERVICE_PAGES.map((page) => page.route);

app.set('trust proxy', true);

const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

let mailTransporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  mailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const BITRIX_WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL || '';
const CRM_REQUEST_ENDPOINT =
  process.env.CRM_REQUEST_ENDPOINT || 'https://crm.atelie1513.ru/api/index.php?action=site_request';
const CRM_WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AI_PROVIDER = (process.env.AI_PROVIDER || 'auto').toLowerCase();

const OPENAI_MODEL_TEXT = process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini';
const OPENAI_MODEL_VISION = process.env.OPENAI_MODEL_VISION || 'gpt-4o';
const GROQ_MODEL_TEXT = process.env.GROQ_MODEL_TEXT || 'llama-3.3-70b-versatile';
const GROQ_MODEL_VISION = process.env.GROQ_MODEL_VISION || 'meta-llama/llama-4-scout-17b-16e-instruct';

const SLOT_START_HOUR = 10;
const SLOT_END_HOUR = 22;
const SLOT_DURATION_HOURS = 2;
const SCHEDULE_DAYS = 14;

const FORMAT_LABELS = {
  open_game: 'Открытая игра',
  training: 'Тренировка с тренером',
  subscription: 'Абонемент (4 игры)',
  corporate: 'Корпоратив / ДР',
};

const LEGACY_ROUTES = {
  '/index.html': '/',
  '/services.html': '/services',
  '/price': '/pricing',
  '/price.html': '/pricing',
  '/pricing.html': '/pricing',
  '/process.html': '/process',
  '/about.html': '/about',
  '/location.html': '/location',
  '/contacts.html': '/contacts',
  '/contact': '/contacts',
  '/contact.html': '/contacts',
  '/assistant': '/consultant',
  '/assistant.html': '/consultant',
  '/consultant.html': '/consultant',
  '/user-agreement': '/privacy-policy',
  '/user-agreement.html': '/privacy-policy',
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderTextWithStrongPhrases(text, phrases = []) {
  return phrases.reduce((html, phrase) => {
    if (!phrase) return html;
    const escapedPhrase = escapeHtml(phrase);
    return html.replace(new RegExp(escapeRegExp(escapedPhrase), 'g'), `<strong>${escapedPhrase}</strong>`);
  }, escapeHtml(text));
}

function getOrigin(req) {
  if (SITE_ORIGIN) return SITE_ORIGIN;
  return `${req.protocol}://${req.get('host')}`;
}

function formatPrice(value) {
  if (!value) return '';
  return new Intl.NumberFormat('ru-RU').format(value);
}

function getClientFacingBaseName(baseName, userText = '') {
  const normalizedBaseName = String(baseName || '').toLowerCase().trim();
  const normalizedUserText = String(userText || '').toLowerCase();

  if (normalizedBaseName === 'платье вечернее(свадебное)') {
    if (/выпускн/.test(normalizedUserText)) return 'вечернее платье на выпускной';
    if (/свадьб|свадебн|невест/.test(normalizedUserText)) return 'свадебное платье';
    return 'вечернее платье';
  }

  return String(baseName || '').toLowerCase();
}

function getKnownDressDetailsSummary(userText = '') {
  const text = String(userText || '').toLowerCase();
  const details = [];

  if (/выпускн/.test(text)) details.push('для выпускного');
  else if (/свадьб|свадебн|невест/.test(text)) details.push('для свадьбы');
  else if (/торжеств|гала|вечерн|мероприят/.test(text)) details.push('для мероприятия');

  const colorMatches = [
    [/черн/, 'черное'],
    [/бел(ое|ый|ая|ого)/, 'белое'],
    [/красн/, 'красное'],
    [/син(ее|ий|яя)|темно-син/, 'синее'],
    [/зелен/, 'зеленое'],
    [/розов/, 'розовое'],
    [/золот/, 'золотое'],
    [/серебр/, 'серебристое'],
    [/бежев|нюдов/, 'бежевое'],
  ];
  const color = colorMatches.find(([pattern]) => pattern.test(text));
  if (color) details.push(color[1]);

  if (/отдельн[а-яёa-z]*.*(юбк|низ).*(верх|топ|лиф)|отдельн[а-яёa-z]*.*(верх|топ|лиф).*(юбк|низ)|верх[а-яёa-z]*\s+и\s+(юбк|низ)|юбк[а-яёa-z]*\s+и\s+верх|лиф[а-яёa-z]*\s+и\s+юбк|топ[а-яёa-z]*\s+и\s+юбк/.test(text)) {
    details.push('с раздельным верхом и юбкой');
  } else if (/отрезн|тал(ии|ией)|ли(ф|фа)\s*\+\s*юбк/.test(text)) {
    details.push('с отрезной талией');
  }

  if (/открыт[а-яёa-z]*\s+спин|спин[а-яёa-z]*.*открыт|вырез[а-яёa-z]*\s+на\s+спин/.test(text)) {
    details.push('с открытой спиной');
  }

  if (/корсет|корсаж/.test(text)) details.push('с корсетным верхом');
  if (/шлейф/.test(text)) details.push('со шлейфом');
  if (/пайет|страз|вышив|декор|бисер|перья/.test(text)) details.push('с декором');
  if (/необычн[а-яёa-z]*\s+форм|нестандартн[а-яёa-z]*\s+форм|сложн[а-яёa-z]*\s+форм/.test(text)) {
    details.push('нестандартной формы');
  }
  if (/в пол|до пола|макси|длинн/.test(text)) details.push('длиной в пол');
  else if (/миди|ниже колена/.test(text)) details.push('длины миди');
  else if (/мини|коротк|выше колена/.test(text)) details.push('короткой длины');

  const materialMatches = [
    [/бархат/, 'из бархата'],
    [/велюр/, 'из велюра'],
    [/ш[её]лк/, 'из шелка'],
    [/шифон/, 'из шифона'],
    [/кружев/, 'с кружевом'],
    [/органза/, 'из органзы'],
    [/атлас|сатин/, 'из атласа'],
    [/тюль|фатин/, 'из фатина'],
    [/креп/, 'из крепа'],
  ];
  const material = materialMatches.find(([pattern]) => pattern.test(text));
  if (material) details.push(material[1]);

  return details;
}

function hasMeaningfulDressDescription(userText = '') {
  return getKnownDressDetailsSummary(userText).length >= 2;
}

function hasAnyGarmentDetail(userText = '') {
  const text = String(userText || '').toLowerCase();
  return /ш[её]лк|атлас|сатин|шифон|кружев|бархат|велюр|органза|кашемир|шерст|драп|твид|хлопок|хлопк|плащевк|плащёвк|нейлон|полиэстер|кож[аеуой]|замш|деним|джинс|трикотаж|(?:^|\s)(?:лён|лен)(?:\s|$)|клетк|полоск|принт|рисунок|длинн|макси|в пол|до пола|до колена|миди|мини|коротк|удлин|открыт[а-яёa-z]*\s+спин|открыт[а-яёa-z]*\s+плеч|драпиров|корсет|асимметр|необычн[а-яёa-z]*\s+форм|нестандартн[а-яёa-z]*\s+форм|карман|капюшон|пояс|подкладк|пуговиц|молни|разрез|волан|рюши|пайет|бисер|вышив|декор/.test(text);
}

function hasEveningDressIntent(userText = '') {
  const text = String(userText || '').toLowerCase();
  if (!/плать/.test(text)) return false;
  if (/повседнев|каждый день|офис|рабоч|делов/.test(text)) return false;
  return /выпускн|свадьб|свадебн|невест|гала|торжеств|вечерн|мероприят|особ(ый|ого|ое)\s+случ/.test(text);
}

function forceEveningDressClassification(classification, userText = '') {
  if (!classification || classification.category !== 'ПЛАТЬЯ') return classification;
  if (!hasEveningDressIntent(userText)) return classification;

  return {
    ...classification,
    base_determined: true,
    base_name: 'платье вечернее(свадебное)',
    base_price: 80000,
    category: 'ПЛАТЬЯ',
    question: null,
    analysis: `${classification.analysis || ''} Серверное правило: платье для выпускного/вечернего события считается по базе вечернего платья, а силуэт и рукава учитываются как детали, не как смена базы.`,
  };
}

function renderJsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function getHtmlAttribute(tag, name) {
  const pattern = "\\b" + name + "=[\"']([^\"']*)[\"']";
  return tag.match(new RegExp(pattern, 'i'))?.[1] || '';
}

function extractCanonicalRoute(html, sourceName) {
  const canonicalTag = html
    .match(/<link\b[^>]*>/gi)
    ?.find((tag) => getHtmlAttribute(tag, 'rel').toLowerCase() === 'canonical');
  const href = canonicalTag ? getHtmlAttribute(canonicalTag, 'href') : '';

  if (!href) {
    throw new Error(sourceName + ': missing canonical link');
  }

  return normalizeServicePath(new URL(href, 'https://atelier.local').pathname);
}

function loadStandardHtmlPages() {
  return STANDARD_HTML_PAGE_FILES.map((fileName) => {
    const index = join(PUBLIC_DIR, fileName);
    const html = readFileSync(index, 'utf8');
    const stats = statSync(index);

    return {
      route: extractCanonicalRoute(html, 'public/' + fileName),
      index,
      lastmod: stats.mtime,
    };
  });
}

function loadFinalServicePages() {
  const routes = new Set();

  return readdirSync(FINAL_PAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const folder = entry.name;
      const index = join(FINAL_PAGES_DIR, folder, 'index.html');
      const html = readFileSync(index, 'utf8');
      const stats = statSync(index);
      const route = extractCanonicalRoute(html, 'public/final-pages/' + folder + '/index.html');

      if (routes.has(route)) {
        throw new Error('Duplicate final page route: ' + route);
      }

      routes.add(route);

      return { route, index, lastmod: stats.mtime };
    });
}

function readHtmlPage(page) {
  return readFileSync(page.index, 'utf8');
}

function serializeServiceMenuNode(node) {
  return {
    title: node.title,
    path: node.path,
    type: node.type,
    children: node.children.map(serializeServiceMenuNode),
  };
}

function renderBreadcrumbs(breadcrumbs) {
  return `
    <nav aria-label="Хлебные крошки" class="bg-background border-b border-border/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <ol class="flex flex-wrap items-center gap-2 text-xs tracking-widest uppercase text-muted-foreground">
          ${breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return `
              <li class="flex items-center gap-2">
                ${index > 0 ? '<span class="text-muted-foreground/40">/</span>' : ''}
                ${isLast
                  ? `<span class="text-foreground">${escapeHtml(item.title)}</span>`
                  : `<a href="${escapeHtml(item.path)}" class="hover:text-foreground transition-colors">${escapeHtml(item.title)}</a>`}
              </li>
            `;
          }).join('')}
        </ol>
      </div>
    </nav>
  `;
}

function renderCardGrid(items) {
  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      ${items.map((item) => `
        <article class="group rounded-md border border-border bg-card overflow-hidden">
          <div class="aspect-[3/4] overflow-hidden bg-muted">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
          </div>
          <div class="p-6">
            <h3 class="font-serif text-xl mb-3">${escapeHtml(item.title)}</h3>
            <p class="text-sm text-muted-foreground leading-relaxed">${escapeHtml(item.description)}</p>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderTextCards(items) {
  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      ${items.map((item) => `
        <article class="rounded-md border border-border bg-background p-8">
          <h3 class="service-text-card-title font-serif text-xl mb-3"><strong>${escapeHtml(item.title)}</strong></h3>
          <p class="text-sm text-muted-foreground leading-relaxed">${escapeHtml(item.description)}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderGallerySlider(items) {
  return `
    <div class="service-slider" data-service-slider>
      <div class="service-slider__viewport" data-service-slider-viewport>
        ${items.map((item) => `
          <article class="service-slider__card">
            <div class="service-slider__media">
              <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">
            </div>
            <div class="service-slider__body">
              <h3 class="service-slider__title"><strong>${escapeHtml(item.title)}</strong></h3>
              <p class="service-slider__text">${escapeHtml(item.description)}</p>
            </div>
          </article>
        `).join('')}
      </div>
      <div class="service-slider__controls" aria-label="Управление галереей">
        <button class="service-slider__button" type="button" data-service-slider-button="prev" aria-label="Предыдущие фотографии">‹</button>
        <button class="service-slider__button" type="button" data-service-slider-button="next" aria-label="Следующие фотографии">›</button>
      </div>
    </div>
  `;
}

function renderSimpleList(items) {
  return `
    <ul class="space-y-3">
      ${items.map((item) => `
        <li class="flex gap-3 text-sm text-muted-foreground leading-relaxed">
          <span class="mt-2 h-1 w-1 rounded-full bg-foreground/40 flex-shrink-0"></span>
          <span>${escapeHtml(item)}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderPriceFactors(items) {
  return `
    <div class="service-factor-list">
      ${items.map((item) => {
        if (typeof item === 'string') {
          return `<p class="service-factor">${escapeHtml(item)}</p>`;
        }

        return `
          <p class="service-factor">
            <strong>${escapeHtml(item.title)}</strong><br>
            ${escapeHtml(item.description)}
          </p>
        `;
      }).join('')}
    </div>
  `;
}

function renderMaterialsList(items) {
  return `
    <nav aria-label="Материалы для пошива">
      <ol class="service-materials-list">
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ol>
    </nav>
  `;
}

function renderProcessList(items) {
  return `
    <ol class="service-process-list">
      ${items.map((step) => `
        <li>
          <p>${escapeHtml(step)}</p>
        </li>
      `).join('')}
    </ol>
  `;
}

function renderSectionIntro(eyebrow, title, lead = '') {
  return `
    <div class="max-w-3xl mb-14">
      <p class="service-section-eyebrow text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4"><strong>${escapeHtml(eyebrow)}</strong></p>
      <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-light mb-5">${escapeHtml(title)}</h2>
      ${lead ? `<p class="text-muted-foreground leading-relaxed">${escapeHtml(lead)}</p>` : ''}
    </div>
  `;
}

function getServicePageContext(page) {
  const isAlteration = page.path.startsWith('/services/alterations');
  const isTailoring = page.path.startsWith('/services/custom-tailoring');

  if (isAlteration) {
    return {
      eyebrow: 'Корректировка изделий',
      galleryTitle: 'Посадка и детали корректировки',
      galleryLead: 'Показываем посадку, аккуратную обработку и детали, которые важны при работе с готовым изделием.',
      whyTitle: 'Аккуратная работа с готовым изделием',
      priceTitle: 'Корректировка',
      processTitle: 'От примерки до готового изделия',
      materialsTitle: 'Материалы и конструкция',
      materialsLead: 'Способ корректировки зависит от ткани, подкладки, фурнитуры и конструкции изделия.',
    };
  }

  if (isTailoring) {
    return {
      eyebrow: 'Индивидуальный пошив',
      galleryTitle: 'Кейсы, посадка и детали пошива',
      galleryLead: 'Показываем посадку, пропорции, материалы и детали, которые формируют характер изделия.',
      whyTitle: 'Изделие под задачу, фигуру и материал',
      priceTitle: 'Пошив',
      processTitle: 'От идеи до готового изделия',
      materialsTitle: 'Ткани и сезонность',
      materialsLead: 'Материалы подбираются под событие, сезон, силуэт и желаемую пластику изделия.',
    };
  }

  return {
    eyebrow: 'Услуги ателье',
    galleryTitle: 'Кейсы, посадка и детали',
    galleryLead: 'Показываем подход к посадке, материалам и деталям изделия.',
    whyTitle: 'Работа под задачу клиента',
    priceTitle: 'Стоимость',
    processTitle: 'Этапы работы',
    materialsTitle: 'Материалы',
    materialsLead: 'Материалы и способ работы подбираются под задачу, изделие и желаемый результат.',
  };
}

function renderServiceContent(page, req) {
  const breadcrumbs = getServiceBreadcrumbs(page.path);
  const priceLabel = page.priceFrom ? `от ${formatPrice(page.priceFrom)} ₽` : 'индивидуально';
  const context = getServicePageContext(page);

  return `
    <main class="min-h-screen pt-16 bg-background">
      <section class="service-hero relative min-h-screen flex items-center overflow-hidden">
        <div class="absolute inset-0">
          <img src="/images/hero-atelier.png" alt="${escapeHtml(page.title)}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30"></div>
        </div>
        <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div class="max-w-3xl">
            <p class="service-hero__eyebrow inline-block text-xs tracking-[0.35em] uppercase text-white/70 border border-white/25 px-4 py-2 rounded-md mb-6">${escapeHtml(context.eyebrow)}</p>
            <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-white leading-tight mb-6">${escapeHtml(page.h1)}</h1>
            <p class="service-hero__lead text-base sm:text-lg text-white/75 max-w-2xl mb-6 leading-relaxed">${escapeHtml(page.introText)}</p>
            <p class="service-hero__usp">${escapeHtml(page.heroUsp)}</p>
            <div class="flex flex-wrap gap-4">
              <a href="/contacts" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-white text-black shadow h-11 px-8 py-3">${escapeHtml(page.ctaLabel)}</a>
              <a href="#pricing" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium text-white border border-white/30 bg-white/10 backdrop-blur-sm h-11 px-8 py-3">Стоимость ${escapeHtml(priceLabel)}</a>
            </div>
          </div>
        </div>
      </section>

      ${renderBreadcrumbs(breadcrumbs)}

      <section class="py-24 sm:py-32 bg-background">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          ${renderSectionIntro('Галерея', context.galleryTitle, context.galleryLead)}
          ${renderGallerySlider(page.galleryItems)}
        </div>
      </section>

      <section class="py-24 sm:py-32 bg-card">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          ${renderSectionIntro('Почему ателье', context.whyTitle)}
          ${renderTextCards(page.whyItems)}
        </div>
      </section>

      <section id="pricing" class="py-24 sm:py-32 bg-background">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div>
              <div class="max-w-3xl mb-14 service-price">
                <p class="service-price__eyebrow text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4"><strong>Стоимость</strong></p>
                <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-light mb-5">${escapeHtml(context.priceTitle)} <strong>${escapeHtml(priceLabel)}</strong></h2>
                <p class="text-muted-foreground leading-relaxed">${escapeHtml(page.priceNote)}</p>
                <div class="service-price__cta-row">
                  <a href="/contacts" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground shadow h-11 px-8 py-3">${escapeHtml(page.ctaLabel)}</a>
                </div>
              </div>
            </div>
            <div class="rounded-md border border-border bg-card p-8">
              <h3 class="font-serif text-2xl mb-6">Что влияет на цену</h3>
              ${renderPriceFactors(page.pricingFactors)}
            </div>
          </div>
        </div>
      </section>

      <section class="py-24 sm:py-32 bg-card">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          ${renderSectionIntro('Процесс', context.processTitle)}
          ${renderProcessList(page.processSteps)}
        </div>
      </section>

      <section class="py-24 sm:py-32 bg-background">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div>
              ${renderSectionIntro('Материалы', context.materialsTitle, context.materialsLead)}
            </div>
            <div class="rounded-md border border-border bg-card p-8">
              ${renderMaterialsList(page.materials)}
            </div>
          </div>
        </div>
      </section>

      <section class="py-24 sm:py-32 bg-card">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          ${renderSectionIntro('FAQ', 'Частые вопросы')}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            ${page.faq.map((item) => `
              <details class="service-faq rounded-md border border-border bg-background p-6">
                <summary class="cursor-pointer"><h3>${renderTextWithStrongPhrases(item.question, item.strongPhrases)}</h3></summary>
                <p class="text-sm text-muted-foreground leading-relaxed mt-4">${escapeHtml(item.answer)}</p>
              </details>
            `).join('')}
          </div>
        </div>
      </section>
    </main><script>
  window.chatwootSettings = {"position":"right","type":"standard","launcherTitle":""};
  (function(d,t) {
    var BASE_URL="https://app.chatwoot.com";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/packs/js/sdk.js";
    g.async = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.chatwootSDK.run({
        websiteToken: 'ZFDyf4j1nG7yALnV2ECbPG5H',
        baseUrl: BASE_URL
      })
    }
  })(document,"script");
</script>

  `;
}

function renderServiceSchemas(page, req) {
  const canonical = `${getOrigin(req)}${page.canonical || page.path}`;
  const breadcrumbs = getServiceBreadcrumbs(page.path);
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.title,
      item: `${getOrigin(req)}${item.path}`,
    })),
  };
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.h1,
    description: page.seoDescription,
    url: canonical,
    provider: {
      '@type': 'LocalBusiness',
      name: 'Ателье 15/13',
      address: 'Москва, ул. Петровка 15/13, стр. 3',
    },
    areaServed: 'Москва',
    offers: page.priceFrom ? {
      '@type': 'Offer',
      price: page.priceFrom,
      priceCurrency: 'RUB',
      url: canonical,
    } : undefined,
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return [breadcrumbSchema, serviceSchema, faqSchema].map(renderJsonLd).join('\n');
}

function renderServicePage(page, req) {
  const origin = getOrigin(req);
  const canonical = `${origin}${page.canonical || page.path}`;
  const content = renderServiceContent(page, req);
  const robotsMeta = page.indexable === true ? '' : '    <meta name="robots" content="noindex,follow" />\n';

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" /><meta name="Cache-control" content="no-cache, no-store, must-revalidate">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5" />
    <title>${escapeHtml(page.seoTitle)}</title>
    <meta name="description" content="${escapeHtml(page.seoDescription)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
${robotsMeta}    <meta property="og:title" content="${escapeHtml(page.seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(page.seoDescription)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:image" content="${escapeHtml(origin)}/images/hero-atelier.png" />
    <meta property="og:image:alt" content="${escapeHtml(page.h1)} — Ателье 15/13, Москва" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(page.seoDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(origin)}/images/hero-atelier.png" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet"></noscript>
    <link rel="stylesheet" crossorigin href="/assets/index-B-os_Paw.css">
    <link rel="stylesheet" href="/assets/services-menu.css?v=6" media="print" onload="this.media='all'">
    <link rel="stylesheet" href="/assets/service-page.css?v=6" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="/assets/services-menu.css?v=6"></noscript>
    <noscript><link rel="stylesheet" href="/assets/service-page.css?v=6"></noscript>
    <style>html, body { overflow-x: hidden; } .text-muted-foreground\/40 { color: hsl(var(--muted-foreground) / .6) !important; } .text-muted-foreground\/50 { color: hsl(var(--muted-foreground) / .7) !important; }</style>
    ${renderServiceSchemas(page, req)}
  </head>
  <body>
    <div id="root">${content}</div>
    <script defer src="/assets/services-menu.js?v=6"></script>
    <script defer src="/assets/service-page.js?v=2"></script>
  </body>
</html>`;
}

function renderServiceNotFoundPage(req) {
  const origin = getOrigin(req);
  const canonical = `${origin}/services`;

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" /><meta name="Cache-control" content="no-cache, no-store, must-revalidate">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5" />
    <title>Страница услуги не найдена — Ателье 15/13</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:title" content="Страница услуги не найдена — Ателье 15/13" />
    <meta property="og:description" content="Такой страницы в структуре услуг пока нет." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:locale" content="ru_RU" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="stylesheet" crossorigin href="/assets/index-B-os_Paw.css">
    <link rel="stylesheet" href="/assets/services-menu.css?v=6" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="/assets/services-menu.css?v=6"></noscript>
  </head>
  <body>
    <div id="root">

      <main class="min-h-screen pt-16 bg-background">
        <section class="py-24 sm:py-32">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p class="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">404</p>
            <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl font-light mb-6">Страница услуги не найдена</h1>
            <p class="text-muted-foreground max-w-2xl mb-8 leading-relaxed">Такой страницы в структуре услуг пока нет. Можно вернуться к основному разделу услуг или записаться на консультацию.</p>
            <div class="flex flex-wrap gap-4">
              <a href="/services" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground shadow h-11 px-8 py-3">К услугам</a>
              <a href="/contacts" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-border h-11 px-8 py-3">Записаться</a>
            </div>
          </div>
        </section>
      </main><script>
  window.chatwootSettings = {"position":"right","type":"standard","launcherTitle":""};
  (function(d,t) {
    var BASE_URL="https://app.chatwoot.com";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/packs/js/sdk.js";
    g.async = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.chatwootSDK.run({
        websiteToken: 'ZFDyf4j1nG7yALnV2ECbPG5H',
        baseUrl: BASE_URL
      })
    }
  })(document,"script");
</script>

    </div>
  </body>
</html>`;
}

function getPagePriority(path) {
  if (path === '/') return '1.0';
  if (path === '/services') return '0.9';
  if (path === '/pricing') return '0.9';
  if (path === '/process') return '0.8';
  if (path === '/about') return '0.8';
  if (path === '/location') return '0.7';
  if (path === '/contacts') return '0.7';
  if (path === '/consultant') return '0.6';
  if (path === '/privacy-policy') return '0.3';
  if (path.startsWith('/services/')) return '0.8';
  if (path.startsWith('/final-pages/')) return '0.7';
  return '0.5';
}

function getPageChangefreq(path) {
  if (path === '/') return 'daily';
  if (path === '/services') return 'weekly';
  if (path === '/pricing') return 'monthly';
  if (path === '/process') return 'monthly';
  if (path === '/about') return 'monthly';
  if (path === '/location') return 'monthly';
  if (path === '/contacts') return 'monthly';
  if (path === '/consultant') return 'weekly';
  if (path === '/privacy-policy') return 'yearly';
  if (path.startsWith('/services/')) return 'weekly';
  if (path.startsWith('/final-pages/')) return 'monthly';
  return 'monthly';
}

function renderSitemap(req) {
  const origin = getOrigin(req);
  
  const routeSet = new Set();
  const pages = [];

  function addPage(path, lastmod, type) {
    if (routeSet.has(path)) return;
    routeSet.add(path);
    pages.push({ path, lastmod: lastmod || new Date(), type });
  }

  STANDARD_HTML_PAGES.forEach(page => addPage(page.route, page.lastmod, 'standard'));
  FINAL_SERVICE_PAGES.forEach(page => addPage(page.route, page.lastmod, 'final'));
  servicePages
    .filter(page => page.indexable === true)
    .forEach(page => addPage(page.path, new Date(), 'service'));

  addPage('/blog', new Date(), 'standard');
  blogArticles.forEach(article => addPage('/blog/' + article.id, article.created_at, 'blog'));

  const MAX_URLS = 50000;
  if (pages.length > MAX_URLS) {
    console.warn(`Sitemap exceeds maximum URL limit: ${pages.length} > ${MAX_URLS}`);
  }

  const urls = pages
    .slice(0, MAX_URLS)
    .map(page => {
      const priority = getPagePriority(page.path);
      const changefreq = getPageChangefreq(page.path);
      const lastmod = page.lastmod instanceof Date ? page.lastmod.toISOString() : new Date(page.lastmod).toISOString();
      
      return `
      <url>
        <loc>${origin}${page.path}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>${changefreq}</changefreq>
        <priority>${priority}</priority>
      </url>
    `;
    })
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (Buffer.byteLength(sitemap, 'utf8') > MAX_SIZE) {
    console.warn(`Sitemap exceeds maximum size limit: ${Buffer.byteLength(sitemap, 'utf8')} bytes > ${MAX_SIZE} bytes`);
  }

  return sitemap;
}

function renderStaticHtmlPage(page) {
  return readHtmlPage(page);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/images', (req, res, next) => {
  const accept = req.get('Accept') || '';
  if (accept.includes('image/webp')) {
    const ext = req.path.split('.').pop().toLowerCase();
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      const webpPath = join(PUBLIC_DIR, 'images', req.path.replace(/\.(png|jpg|jpeg)$/i, '.webp'));
      if (existsSync(webpPath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.type('image/webp').send(readFileSync(webpPath));
      }
    }
  }
  next();
});

app.use('/final-pages', (req, res, next) => {
  const accept = req.get('Accept') || '';
  if (accept.includes('image/webp') && /\/images\/.*\.(png|jpg|jpeg)$/i.test(req.path)) {
    const webpPath = join(PUBLIC_DIR, 'final-pages', req.path.replace(/\.(png|jpg|jpeg)$/i, '.webp'));
    if (existsSync(webpPath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.type('image/webp').send(readFileSync(webpPath));
    }
  }
  next();
});
app.use('/assets/demo-block.css', (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); next(); });
app.use('/assets/demo-block.js', (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); next(); });
app.use('/assets/services-menu.css', (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); next(); });
app.use('/assets/services-menu.js', (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); next(); });
app.use('/assets/service-page.css', (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); next(); });
app.use('/assets/service-page.js', (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); next(); });
app.use('/final-pages', (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=86400'); next(); });

app.get('/api/service-menu', (req, res) => {
  res.json(serializeServiceMenuNode(serviceMenuData));
});

app.get(Object.keys(LEGACY_ROUTES), (req, res) => {
  res.redirect(301, LEGACY_ROUTES[req.path]);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /assets/
Disallow: /docs/
Disallow: /final-pages/*/assets/
Sitemap: ${getOrigin(req)}/sitemap.xml
`);
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(renderSitemap(req));
});

function renderHtmlSitemap(req) {
  const origin = getOrigin(req);
  
  const standardPages = STANDARD_HTML_PAGES.map(page => ({
    path: page.route,
    title: getPageTitle(page.route),
    lastmod: page.lastmod || new Date()
  }));
  
  const servicePagesList = servicePages
    .filter(page => page.indexable === true)
    .map(page => ({
      path: page.path,
      title: page.title,
      lastmod: new Date()
    }));
  
  const finalPages = FINAL_SERVICE_PAGES.map(page => ({
    path: page.route,
    title: getPageTitle(page.route),
    lastmod: page.lastmod || new Date()
  }));

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Карта сайта - Atelier</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
    }
    .sitemap-section {
      background: white;
      padding: 25px;
      margin-bottom: 25px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .sitemap-section h2 {
      color: #555;
      margin-top: 0;
      margin-bottom: 20px;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .sitemap-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .sitemap-list li {
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .sitemap-list li:last-child {
      border-bottom: none;
    }
    .sitemap-list a {
      color: #0066cc;
      text-decoration: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sitemap-list a:hover {
      color: #004499;
      text-decoration: underline;
    }
    .lastmod {
      color: #999;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <h1>Карта сайта</h1>
  
  <div class="sitemap-section">
    <h2>Основные страницы</h2>
    <ul class="sitemap-list">
      ${standardPages.map(page => `
        <li>
          <a href="${origin}${page.path}">
            <span>${page.title}</span>
            <span class="lastmod">${formatDate(page.lastmod)}</span>
          </a>
        </li>
      `).join('')}
    </ul>
  </div>
  
  <div class="sitemap-section">
    <h2>Услуги</h2>
    <ul class="sitemap-list">
      ${servicePagesList.map(page => `
        <li>
          <a href="${origin}${page.path}">
            <span>${page.title}</span>
            <span class="lastmod">${formatDate(page.lastmod)}</span>
          </a>
        </li>
      `).join('')}
    </ul>
  </div>
  
  <div class="sitemap-section">
    <h2>Финальные страницы услуг</h2>
    <ul class="sitemap-list">
      ${finalPages.map(page => `
        <li>
          <a href="${origin}${page.path}">
            <span>${page.title}</span>
            <span class="lastmod">${formatDate(page.lastmod)}</span>
          </a>
        </li>
      `).join('')}
    </ul>
  </div>
  
  <div class="sitemap-section">
    <h2>Блог</h2>
    <ul class="sitemap-list">
      <li>
        <a href="${origin}/blog">
          <span>Все статьи</span>
          <span class="lastmod">${formatDate(new Date())}</span>
        </a>
      </li>
      ${blogArticles.map(article => `
        <li>
          <a href="${origin}/blog/${article.id}">
            <span>${article.title}</span>
            <span class="lastmod">${formatDate(article.created_at)}</span>
          </a>
        </li>
      `).join('')}
    </ul>
  </div>
  
</body>
</html>`;
}

function getPageTitle(path) {
  const titles = {
    '/': 'Главная',
    '/services': 'Услуги',
    '/pricing': 'Цены',
    '/process': 'Процесс',
    '/about': 'О нас',
    '/location': 'Расположение',
    '/contacts': 'Контакты',
    '/consultant': 'Консультант',
    '/blog': 'Блог'
  };
  return titles[path] || path;
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('ru-RU', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

app.get('/sitemap.html', (req, res) => {
  res.type('text/html').send(renderHtmlSitemap(req));
});

app.get(FINAL_SERVICE_PAGE_ROUTES, (req, res, next) => {
  const page = FINAL_SERVICE_PAGES.find((item) => item.route === req.path);
  if (!page) {
    next();
    return;
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(renderStaticHtmlPage(page));
});

app.get('/services/*', (req, res) => {
  const normalizedPath = normalizeServicePath(req.path);

  if (normalizedPath !== req.path) {
    res.redirect(301, normalizedPath);
    return;
  }

  const page = findServicePageByPath(req.path);

  if (!page) {
    res.status(404).send(renderServiceNotFoundPage(req));
    return;
  }

  if (page.indexable !== true) {
    res.setHeader('X-Robots-Tag', 'noindex, follow');
  }

  res.send(renderServicePage(page, req));
});

app.get(STANDARD_HTML_ROUTES, (req, res, next) => {
  const page = STANDARD_HTML_PAGES.find((item) => item.route === req.path);
  if (!page) {
    next();
    return;
  }

  res.send(renderStaticHtmlPage(page));
});

// Blog data loading
const BLOG_DATA_PATH = join(__dirname, 'public', 'blog', 'data', 'articles.json');
let blogArticles = [];

function loadBlogArticles() {
  try {
    if (existsSync(BLOG_DATA_PATH)) {
      const data = readFileSync(BLOG_DATA_PATH, 'utf-8');
      blogArticles = JSON.parse(data);
      blogArticles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  } catch (err) {
    console.error('Failed to load blog articles:', err.message);
    blogArticles = [];
  }
}

loadBlogArticles();

function blogMarkdownToHtml(md) {
  if (!md) return '';
  var html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  var lines = html.split('\n');
  var inList = false;
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var liMatch = line.match(/^- (.+)/);
    if (liMatch) {
      if (!inList) { result.push('<ul>'); inList = 'ul'; }
      result.push('<li>' + liMatch[1] + '</li>');
    } else if (inList) {
      result.push('</' + inList + '>');
      inList = false;
      result.push(line);
    } else {
      result.push(line);
    }
  }
  if (inList) result.push('</' + inList + '>');
  html = result.join('\n');

  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<(h[1-3]|ul|ol|li|blockquote)/g, '<$1');
  html = html.replace(/<\/(h[1-3]|ul|ol|li|blockquote)>\s*<\/p>/g, '</$1>');
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<\/ul><br>/g, '</ul>');
  html = html.replace(/<br><\/ul>/g, '</ul>');
  html = html.replace(/<\/ul>\n<br>/g, '</ul>');
  return html;
}

function blogFormatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  var day = String(d.getDate()).padStart(2, '0');
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var year = d.getFullYear();
  return day + '.' + month + '.' + year;
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderBlogCard(article) {
  var imgSrc = (article.image || '').replace('/blog/images/', '/images/blog/');
  var excerpt = article.content.replace(/<[^>]*>/g, '').substring(0, 100);
  return '<a href="/blog/' + article.id + '" class="article-card">' +
    '<img class="article-card__img" src="' + escapeHtmlAttr(imgSrc) + '" alt="' + escapeHtmlAttr(article.title) + '" loading="lazy">' +
    '<div class="article-card__body">' +
    '<span class="article-card__cat">' + escapeHtml(article.category || '') + '</span>' +
    '<h3 class="article-card__title">' + escapeHtml(article.title) + '</h3>' +
    '<p class="article-card__excerpt">' + escapeHtml(excerpt) + '...</p>' +
    '<div class="article-card__meta">' +
    '<span>' + blogFormatDate(article.created_at) + '</span>' +
    '<span class="article-card__link">Читать →</span>' +
    '</div></div></a>';
}

function renderRelatedCard(article) {
  var imgSrc = (article.image || '').replace('/blog/images/', '/images/blog/');
  return '<a href="/blog/' + article.id + '" class="related-card">' +
    '<img class="related-card__img" src="' + escapeHtmlAttr(imgSrc) + '" alt="' + escapeHtmlAttr(article.title) + '" loading="lazy">' +
    '<div class="related-card__body">' +
    '<div class="related-card__title">' + escapeHtml(article.title) + '</div>' +
    '<div class="related-card__meta">' + blogFormatDate(article.created_at) + '</div></div></a>';
}

// Blog API
app.get('/api/blog/articles', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(blogArticles);
});

// Blog listing page (SSR)
app.get('/blog', (req, res) => {
  var template = readFileSync(join(PUBLIC_DIR, 'blog', 'index.html'), 'utf-8');

  if (blogArticles.length > 0) {
    var featured = blogArticles[0];
    var imgSrc = (featured.image || '').replace('/blog/images/', '/images/blog/');
    var featuredHtml = '<a href="/blog/' + featured.id + '" class="featured-card">' +
      '<img class="featured-card__img" src="' + escapeHtmlAttr(imgSrc) + '" alt="' + escapeHtmlAttr(featured.title) + '" loading="eager">' +
      '<div class="featured-card__body">' +
      '<span class="featured-card__cat">' + escapeHtml(featured.category || '') + '</span>' +
      '<h2 class="featured-card__title">' + escapeHtml(featured.title) + '</h2>' +
      '<p class="featured-card__excerpt">' + escapeHtml(featured.content.replace(/<[^>]*>/g, '').substring(0, 140)) + '...</p>' +
      '<div class="featured-card__meta">' +
      '<span>' + blogFormatDate(featured.created_at) + '</span>' +
      '<span>·</span>' +
      '<span>' + escapeHtml(featured.author || '') + '</span>' +
      '</div></div></a>';
    template = template.replace('<!-- SSR_FEATURED -->', featuredHtml);

    var gridArticles = blogArticles.slice(1, 7);
    var articlesHtml = gridArticles.map(renderBlogCard).join('');
    template = template.replace('<!-- SSR_ARTICLES -->', articlesHtml);

    var popular = blogArticles.slice(0, 4);
    var popularHtml = popular.map(function(a) {
      var pImgSrc = (a.image || '').replace('/blog/images/', '/images/blog/');
      return '<a class="popular-item" href="/blog/' + a.id + '">' +
        '<img class="popular-item__img" src="' + escapeHtmlAttr(pImgSrc) + '" alt="' + escapeHtmlAttr(a.title) + '" loading="lazy">' +
        '<div><div class="popular-item__title">' + escapeHtml(a.title) + '</div>' +
        '<div class="popular-item__meta">' + blogFormatDate(a.created_at) + '</div></div></a>';
    }).join('');
    template = template.replace('<!-- SSR_POPULAR -->', popularHtml);

    var jsonLdArticles = blogArticles.map(function(a) {
      var url = 'https://atelie1513.ru/blog/' + a.id;
      var aImg = (a.image || '').replace('/blog/images/', '/images/blog/');
      return {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": a.title,
        "url": url,
        "image": aImg ? 'https://atelie1513.ru' + aImg : 'https://atelie1513.ru/images/hero-atelier.png',
        "datePublished": a.created_at,
        "author": { "@type": "Organization", "name": a.author || "Ателье 15/13" }
      };
    });
    var jsonLdHtml = '<script type="application/ld+json">' +
      JSON.stringify(jsonLdArticles).replace(/</g, '\\u003c') + '</script>';
    template = template.replace('</head>', jsonLdHtml + '\n</head>');
  }

  var dataScript = '<script>window.__BLOG_ARTICLES__ = ' +
    JSON.stringify(blogArticles).replace(/</g, '\\u003c') + ';</script>';
  template = template.replace('<script>window.__BLOG_ARTICLES__ = [];</script>', dataScript);

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(template);
});

// Blog images (must be before /blog/:id to avoid route conflict)
app.use('/blog/images', express.static(join(PUBLIC_DIR, 'blog', 'images')));

// RSS feed for blog
app.get('/blog/rss.xml', (req, res) => {
  var siteUrl = 'https://atelie1513.ru';
  var rssDate = function(dateStr) {
    if (!dateStr) return new Date().toUTCString();
    var d = new Date(dateStr);
    return d.toUTCString();
  };
  var stripMd = function(text) {
    return text.replace(/<[^>]*>/g, '').replace(/[#*\[\]()>]/g, '').replace(/\n+/g, ' ').trim();
  };
  var escapeXml = function(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  };

  var items = blogArticles.map(function(a) {
    var url = siteUrl + '/blog/' + a.id;
    var imgSrc = (a.image || '').replace('/blog/images/', '/images/blog/');
    var desc = stripMd(a.content).substring(0, 500);
    return '    <item>\n' +
      '      <title>' + escapeXml(a.title) + '</title>\n' +
      '      <link>' + escapeXml(url) + '</link>\n' +
      '      <guid isPermaLink="true">' + escapeXml(url) + '</guid>\n' +
      '      <description>' + escapeXml(desc) + '</description>\n' +
      '      <category>' + escapeXml(a.category || '') + '</category>\n' +
      '      <author>' + escapeXml(a.author || 'Ателье 15/13') + '</author>\n' +
      '      <pubDate>' + rssDate(a.created_at) + '</pubDate>\n' +
      '      <enclosure url="' + escapeXml(siteUrl + imgSrc) + '" type="image/jpeg" />\n' +
      '    </item>';
  }).join('\n');

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '  <channel>\n' +
    '    <title>Блог — Ателье 15/13</title>\n' +
    '    <link>' + escapeXml(siteUrl) + '/blog</link>\n' +
    '    <description>Полезные статьи о пошиве одежды, выборе тканей, уходе за изделиями и трендах моды</description>\n' +
    '    <language>ru</language>\n' +
    '    <lastBuildDate>' + rssDate(blogArticles[0] && blogArticles[0].created_at) + '</lastBuildDate>\n' +
    '    <atom:link href="' + escapeXml(siteUrl) + '/blog/rss.xml" rel="self" type="application/rss+xml" />\n' +
    '    <image>\n' +
    '      <url>' + escapeXml(siteUrl) + '/favicon.png</url>\n' +
    '      <title>Блог — Ателье 15/13</title>\n' +
    '      <link>' + escapeXml(siteUrl) + '/blog</link>\n' +
    '    </image>\n' +
    items + '\n' +
    '  </channel>\n' +
    '</rss>';

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// Blog article page (SSR)
app.get('/blog/:id', (req, res) => {
  var id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.sendFile(join(PUBLIC_DIR, 'blog', 'article.html'));
    return;
  }

  var article = blogArticles.find(function(a) { return a.id === id; });
  if (!article) {
    res.sendFile(join(PUBLIC_DIR, 'blog', 'article.html'));
    return;
  }

  var template = readFileSync(join(PUBLIC_DIR, 'blog', 'article.html'), 'utf-8');
  var baseUrl = 'https://atelie1513.ru';
  var articleUrl = baseUrl + '/blog/' + article.id;
  var plainText = article.content.replace(/<[^>]*>/g, '').replace(/[#*\[\]()]/g, '');
  var desc = plainText.substring(0, 160).replace(/\n/g, ' ').trim();
  var imgSrc = (article.image || '').replace('/blog/images/', '/images/blog/');
  var fullImgUrl = article.image ? baseUrl + imgSrc : baseUrl + '/images/hero-atelier.png';

  template = template.replace(
    '<title id="page-title">Статья — Ателье 15/13</title>',
    '<title id="page-title">' + escapeHtml(article.title) + ' — Ателье 15/13</title>'
  );
  template = template.replace(
    '<meta name="description" id="page-description" content="" />',
    '<meta name="description" id="page-description" content="' + escapeHtmlAttr(desc) + '" />'
  );
  template = template.replace(
    '<link rel="canonical" id="page-canonical" href="" />',
    '<link rel="canonical" id="page-canonical" href="' + escapeHtmlAttr(articleUrl) + '" />'
  );
  template = template.replace(
    '<meta property="og:title" id="og-title" content="" />',
    '<meta property="og:title" id="og-title" content="' + escapeHtmlAttr(article.title + ' — Ателье 15/13') + '" />'
  );
  template = template.replace(
    '<meta property="og:description" id="og-description" content="" />',
    '<meta property="og:description" id="og-description" content="' + escapeHtmlAttr(desc) + '" />'
  );
  template = template.replace(
    '<meta property="og:url" id="og-url" content="" />',
    '<meta property="og:url" id="og-url" content="' + escapeHtmlAttr(articleUrl) + '" />'
  );
  template = template.replace(
    '<meta property="og:image" id="og-image" content="https://atelie1513.ru/images/hero-atelier.png" />',
    '<meta property="og:image" id="og-image" content="' + escapeHtmlAttr(fullImgUrl) + '" />'
  );
  template = template.replace(
    '<meta name="twitter:title" id="tw-title" content="" />',
    '<meta name="twitter:title" id="tw-title" content="' + escapeHtmlAttr(article.title + ' — Ателье 15/13') + '" />'
  );
  template = template.replace(
    '<meta name="twitter:description" id="tw-description" content="" />',
    '<meta name="twitter:description" id="tw-description" content="' + escapeHtmlAttr(desc) + '" />'
  );
  template = template.replace(
    '<meta name="twitter:image" id="tw-image" content="https://atelie1513.ru/images/hero-atelier.png" />',
    '<meta name="twitter:image" id="tw-image" content="' + escapeHtmlAttr(fullImgUrl) + '" />'
  );

  var jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": desc,
    "image": fullImgUrl,
    "author": { "@type": "Organization", "name": article.author || "Ателье 15/13" },
    "publisher": {
      "@type": "Organization",
      "name": "Ателье 15/13",
      "logo": { "@type": "ImageObject", "url": baseUrl + "/favicon.png" }
    },
    "datePublished": article.created_at,
    "dateModified": article.updated_at || article.created_at,
    "url": articleUrl
  };
  var jsonLdStr = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  template = template.replace(
    /<script type="application\/ld\+json" id="json-ld">[\s\S]*?<\/script>/,
    '<script type="application/ld+json" id="json-ld">' + jsonLdStr + '</script>'
  );

  template = template.replace(
    '<span id="article-category" class="article-header__cat"></span>',
    '<span id="article-category" class="article-header__cat">' + escapeHtml(article.category || '') + '</span>'
  );
  template = template.replace(
    '<h1 id="article-title" class="article-header__title"></h1>',
    '<h1 id="article-title" class="article-header__title">' + escapeHtml(article.title) + '</h1>'
  );
  template = template.replace(
    '<span id="article-date" class="article-header__date"></span>',
    '<span id="article-date" class="article-header__date">' + blogFormatDate(article.created_at) + '</span>'
  );

  var authorInitial = article.author ? article.author.charAt(0) : 'A';
  template = template.replace(
    '<span class="article-header__avatar" id="article-avatar">A</span>',
    '<span class="article-header__avatar" id="article-avatar">' + escapeHtml(authorInitial) + '</span>'
  );
  template = template.replace(
    '<span id="article-author-name"></span>',
    '<span id="article-author-name">' + escapeHtml(article.author || 'Ателье 15/13') + '</span>'
  );

  if (article.tags) {
    var tags = article.tags.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t; });
    var tagsHtml = tags.map(function(t) {
      return '<span class="article-header__tag">#' + escapeHtml(t) + '</span>';
    }).join('');
    template = template.replace(
      '<div id="article-tags" class="article-header__tags"></div>',
      '<div id="article-tags" class="article-header__tags">' + tagsHtml + '</div>'
    );
  }

  if (article.image) {
    template = template.replace(
      '<div id="article-hero" class="article-hero hidden">',
      '<div id="article-hero" class="article-hero">'
    );
    template = template.replace(
      '<img id="article-hero-img" class="article-hero__img" alt="" />',
      '<img id="article-hero-img" class="article-hero__img" alt="' + escapeHtmlAttr(article.title) + '" src="' + escapeHtmlAttr(imgSrc) + '" />'
    );
  }

  var bodyHtml = '';
  try { bodyHtml = blogMarkdownToHtml(article.content); } catch(e) { console.error('blogMarkdownToHtml error:', e.message); }
  template = template.replace('<!-- SSR_ARTICLE_BODY -->', bodyHtml);

  var related = blogArticles.filter(function(a) { return a.id !== article.id; }).slice(0, 3);
  var relatedHtml = related.map(renderRelatedCard).join('');
  template = template.replace('<!-- SSR_RELATED -->', relatedHtml);

  var articleData = JSON.stringify(blogArticles).replace(/</g, '\\u003c');
  template = template.replace(
    '<script>window.__BLOG_ARTICLES__ = [];</script>',
    '<script>window.__BLOG_ARTICLES__ = ' + articleData + ';</script>'
  );

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(template);
});

app.use(express.static(join(__dirname, 'public')));

const PRICE_DATA = `
=== БАЗА_ИЗДЕЛИЙ ===
Категория | Изделие | Базовая цена (руб.)
ТОПЫ | топ | 14 000
КОРСЕТЫ | корсет | 50 000
КОРСЕТЫ | полукорсет (бельевой) | 35 000
ПЛАТЬЯ | платье футляр без рукава | 25 000
ПЛАТЬЯ | платье прямое с рукавом | 30 000
ПЛАТЬЯ | платье с отрезной талией | 35 000
ПЛАТЬЯ | платье вечернее(свадебное) | 80 000
ЮБКИ | юбка прямая до колена | 15 000
ЮБКИ | юбка по косой | 20 000
БЛУЗЫ | блуза | 27 000
БРЮКИ | брюки женские два кармана | 26 000
БРЮКИ | брюки спорт | 19 000
БРЮКИ | джинсы | 28 000
ЖАКЕТЫ | жилет | 24 000
ЖАКЕТЫ | жакет шанель на органзе | 55 000
ЖАКЕТЫ | жакет | 48 000
ВЕРХНЯЯ ОДЕЖДА | пальто | 52 000
ВЕРХНЯЯ ОДЕЖДА | плащ | 45 000
СОРОЧКИ | сорочка (рубашка) | 25 000
БРЮКИ | классические брюки | 30 000
ТРИКОТАЖ | лонгслив трикотажный | 14 000
ТРИКОТАЖ | худи с капюшеном | 20 000
ТРИКОТАЖ | свитшот трикотажный | 14 000
ТРИКОТАЖ | футболка | 8 000
ВЕРХНЯЯ ОДЕЖДА | куртка без подкладки | 40 000
ЖАКЕТЫ | пиджак мужской кежуал | 65 000
ЖАКЕТЫ | пиджак мужской классический | 120 000
АКСЕССУАРЫ | бейсболка | 10 000
ВЕРХНЯЯ ОДЕЖДА | бомбер мужской без подкладки | 35 000
ВЕРХНЯЯ ОДЕЖДА | парка без подкладки | 48 000
СОРОЧКИ | сорочка мужская | 27 000
ВЕРХНЯЯ ОДЕЖДА | пальто зимнее | 125 000
ВЕРХНЯЯ ОДЕЖДА | жилет пуховой (короткий) | 40 000
ВЕРХНЯЯ ОДЕЖДА | пуховик короткий | 65 000
ВЕРХНЯЯ ОДЕЖДА | пуховик длинный | 85 000
ВЕРХНЯЯ ОДЕЖДА | дубленка короткая | 80 000
ВЕРХНЯЯ ОДЕЖДА | куртка на меховой подкладке короткая | 150 000

=== ДРАЙВЕРЫ ===
Код | Элемент | Тип | Значение | База расчета
PODKLADKA | подкладка | percent | 50% | base_price
RISUNOK | ткань клетка, полоска, крупный рисунок | percent | 20% | base_price
BELAYA | белая ткань | percent | 20% | base_price
PAYETKI | паетки, бисер | percent | 50% | base_price
SLOZHNAYA_TKAN | шифон, бархат, велюр, кружево | percent | 30% | base_price
KOZHA_MEH | кожа, мех | percent | 100% | base_price
RELYEFY | дополнительные рельефы (два рельефа) | percent | 15% | base_price
REGLAN | рукав реглан | percent | 20% | base_price
OTREZNAYA_TALIYA | отрезная талия, доп сечения | percent | 10% | base_price
KAPYUSHON | капюшон | fixed | 5 000 | —
SLOZHNY_VOROTNIK | фантазийный, сложный воротник | fixed | 7 000 | —
SUPAT | супатная застежка | fixed | 4 000 | —
DOP_KARMAN | дополнительные карманы | fixed | 2000 / 1 карман | —
OTDELOCHNYE_STROCHKI | отделочные строчки | percent | 5% | base_price
DABL | ткань дабл | percent | 50% | base_price
MANZHETY_SHLITSY | манжеты, шлицы | fixed | 3 000 | —
POYAS | пояс | fixed | 4 000 | —
DEKOR_ELEM | декоративные элементы | fixed | 1000+ | —
RAZMER56 | размер свыше 56 | percent | 20% | base_price
POGONY_PATY | погоны, паты | per_unit | 500 / 1 ед. | —
DLINNOE | длинное изделие | percent | 25% | base_price
MEH_VOROT_OTL | меховой воротник отложной | fixed | 8 000 | —
MEH_VOROT_ANGL | меховой воротник английский | fixed | 15 000 | —
MEH_MANZHETY | манжеты меховые | fixed | 10 000 | —
USLOZHNENNY_KROY | усложненный крой | percent | 50% | base_price

=== СПЕЦ_ТОП ===
Спецификация топ
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | топ без корсетной конструкции | наличие косточек, жесткости или утяжки = переход в категорию корсет 
конструкция | силуэт | прямой или полуприлегающий без рельефов | сложная геометрия = USLOZHNENNY_KROY
конструкция | членение | перед и спинка без рельефов, допускаются базовые вытачки | дополнительные рельефы =  USLOZHNENNY_KROY
длина | длина изделия | до линии талии  | увеличение длины =  DLINNOE
верх | линия верха | прямая или слегка изогнутая | сложный фигурный верх = USLOZHNENNY_KROY
бретели | тип бретелей | прямые бретели шириной 1–3 см или цельнокроеная пройма | нестандартные крепления = USLOZHNENNY_KROY
рукава | рукава | отсутствуют | наличие рукавов = USLOZHNENNY_KROY
застежка | застежка | отсутствует | любая застежка = SUPAT
горловина | форма | круглая или V-образная неглубокая | сложные вырезы = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | любые карманы = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие подкладки = PODKLADKA
конструкция | жесткость | мягкая тканевая форма без дублирования и косточек | жесткая конструкция = переход в категорию корсет 
декор | декоративные элементы | отсутствуют | пайетки, вышивка = PAYETKI
материал | тип материала | хлопок, вискоза или аналогичная базовая ткань | кожа, кружево, бархат = SLOZHNAYA_TKAN/KOZHA_MEH

=== СПЕЦ_КОРСЕТ ===
Спецификация корсет 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | корсет с жесткой конструкцией | изделие с формообразованием, не мягкий топ
конструкция | основа | многослойная конструкция (верх + подклад + внутренний слой) | всегда есть внутренняя конструкция
конструкция | силуэт | плотное прилегание по фигуре | свободная форма = это уже не корсет
конструкция | членение | вертикальные рельефы по всей высоте изделия | отсутствие рельефов невозможно для корсета
конструкция | формообразование | за счет косточек | если нет косточек — это не корсет
конструкция | косточки | пластиковые или металлические по всем рельефам | 
конструкция | жесткость | жесткая с дублированием | мягкая форма = не корсет
застежка | тип застежки | шнуровка по спинке | молния = USLOZHNENNY_KROY
застежка | усиление застежки | люверсы или корсетная планка | отсутствие усиления невозможно
верх | линия верха | прямая или с легкой анатомической формой | сложный фигурный край = USLOZHNENNY_KROY
низ | линия низа | прямая или с легкой анатомической формой | фигурный низ = USLOZHNENNY_KROY
бретели | бретели | отсутствуют | наличие бретелей = USLOZHNENNY_KROY
чашки | чашки | отсутствуют | наличие чашек = USLOZHNENNY_KROY
подкладка | подкладка | присутствует как часть конструкции | не считается как отдельная подкладка
материал | внешний материал | базовая костюмная или корсетная ткань | кожа, кружево, бархат = SLOZHNAYA_TKAN/KOZHA_MEH
материал | внутренний слой | плотная стабилизирующая ткань | всегда присутствует
декор | декоративные элементы | отсутствуют | любой декор = DEKOR_ELEM
карманы | карманы | отсутствуют | любые карманы = USLOZHNENNY_KROY
конструкция | застежка дополнительная | отсутствует | молния/крючки = USLOZHNENNY_KROY

=== СПЕЦ_ПОЛУКОРСЕТ ===
Спецификация полукорсет 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | полукорсет (бельевой) | укороченное изделие без полной корсетной конструкции
конструкция | силуэт | прилегающий по фигуре | свободный силуэт = ошибка категории
конструкция | членение | базовые вертикальные членения (рельефы) | сложное членение = USLOZHNENNY_KROY
длина | длина изделия | до линии талии | удлиненный =DLINNOE
конструкция | жесткость | мягкая или полужесткая форма | жесткий каркас = переход в категорию корсет 
конструкция | косточки | отсутствуют | наличие = USLOZHNENNY_KROY
рукава | рукава | отсутствуют | наличие = ошибка категории
бретели | бретели | простые бретели или без них | сложные = USLOZHNENNY_KROY
воротник | воротник | отсутствует | наличие = ошибка категории
застежка | тип застежки | молния или крючки | сложная застежка = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = USLOZHNENNY_KROY
подкладка | подкладка | отсутствует | наличие = PODKLADKA
конструкция | чашки | отсутствуют или простые | сложные чашки = USLOZHNENNY_KROY
конструкция | драпировки | отсутствуют | наличие = USLOZHNENNY_KROY
материал | тип материала | легкие ткани (атлас, хлопок, смесовые) | сложные ткани = SLOZHNAYA_TKAN
декор | декоративные элементы | отсутствуют | кружево, вышивка = DEKOR_ELEM
отделка | отделочные строчки | отсутствуют | наличие = OTDELOCHNYE_STROCHKI
конструкция | многослойность | один слой | многослойность = USLOZHNENNY_KROY
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_БЛУЗА ===
Спецификация блуза
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | блуза из легкой ткани без жесткой конструкции | не относится к пиджакам и не к трикотажу
конструкция | силуэт | прямой или полуприлегающий без рельефов | сложный силуэт = USLOZHNENNY_KROY
конструкция | членение | перед и спинка без рельефов, допускаются базовые вытачки | рельефы = RELYEFY
длина | длина изделия | до линии бедра | удлинение = DLINNOE
рукава | тип рукава | втачной рукав прямой, длина до запястья | реглан = REGLAN
рукава | конструкция рукава | без сборок, без разрезов | сложные рукава = USLOZHNENNY_KROY
манжеты | манжеты | простые манжеты на пуговице | французские = MANZHETY_SHLITSY
воротник | тип воротника | классический рубашечный воротник или стойка | сложный воротник = SLOZHNY_VOROTNIK
застежка | тип застежки | центральная планка с пуговицами | Застежка на молнии = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
конструкция | жесткость | мягкая форма без дублирования | жесткая конструкция = ошибка категории
материал | тип материала | легкая ткань (хлопок, вискоза, шелк) | кружево= SLOZHNAYA_TKAN
декор | декоративные элементы | отсутствуют | Вышивка = DEKOR_ELEM
отделка | отделочные строчки | отсутствуют | наличие = OTDELOCHNYE_STROCHKI
конструкция | рюши / воланы | отсутствуют | наличие = USLOZHNENNY_KROY
конструкция | драпировки | отсутствуют | наличие = USLOZHNENNY_KROY
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_РУБАШКА ===
Спецификация рубашка
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | рубашка классического типа | отличается от блузы
конструкция | силуэт | прямой или полуприлегающий | сложный = USLOZHNENNY_KROY
конструкция | членение | без рельефов | рельефы = RELYEFY
длина | длина изделия | до середины бедра | удлинение = DLINNOE
рукава | тип рукава | втачной | реглан = REGLAN
манжеты | манжеты | простые | французские = MANZHETY_SHLITSY
воротник | тип воротника | классический | сложный = SLOZHNY_VOROTNIK
застежка | тип | планка | Молния = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
конструкция | кокетка | есть | сложная = USLOZHNENNY_KROY
материал | материал | хлопок | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
декор | декор | отсутствует | наличие = DEKOR_ELEM
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_СОРОЧКА_МУЖСКАЯ ===
Спецификация сорочка мужская 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | сорочка мужская классическая | 
конструкция | силуэт | полуприлегающий | сложный = USLOZHNENNY_KROY
конструкция | членение | без рельефов, с кокеткой | рельефы = RELYEFY
длина | длина изделия | до середины бедра | удлинение = DLINNOE
рукава | длина | длинный или короткий | оба допустимы
манжеты | манжеты | классические | французские = MANZHETY_SHLITSY
воротник | тип воротника | классический | сложный = SLOZHNY_VOROTNIK
застежка | тип | планка | Молния = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
материал | материал | сорочечная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN
декор | декор | отсутствует | наличие = DEKOR_ELEM
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПЛАТЬЕ_ФУТЛЯР ===
Спецификация платье футляр без рукава
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | платье-футляр без рукавов | классическая прилегающая база без корсетной конструкции
конструкция | силуэт | прилегающий по фигуре (полуприлегающий допустим) | жесткая утяжка = дополнительно добавляется корсет 
конструкция | членение | перед и спинка с базовыми вытачками без рельефов | рельефы = RELYEFY
длина | длина изделия | до колена (±5–10 см) | миди/макси = DLINNOE
верх | линия верха | закрытая классическая | сложная = USLOZHNENNY_KROY
горловина | форма | круглая или неглубокая V | сложная = SLOZHNY_VOROTNIK
рукава | рукава | отсутствуют | наличие = USLOZHNENNY_KROY
застежка | тип | потайная молния в среднем шве спинки | иная = USLOZHNENNY_KROY
подкладка | подкладка | отсутствует | наличие = PODKLADKA
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
конструкция | разрез | отсутствует | наличие = SHLITSA
конструкция | жесткость | мягкая форма | жесткость = дополнительно добавляется корсет
материал | тип материала | костюмная/плательная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
декор | декор | отсутствует | наличие = DEKOR_ELEM
отделка | строчки | отсутствуют | наличие = OTDELOCHNYE_STROCHKI
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПЛАТЬЕ_ПРЯМОЕ ===
Спецификация платье прямое с рукавом
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | платье прямого силуэта | без формообразования
конструкция | силуэт | прямой | прилегающий = переход в категорию платье футляр 
конструкция | членение | без рельефов | рельефы = RELYEFY
длина | длина изделия | до колена | длиннее = DLINNOE
горловина | форма | круглая или V | сложная = SLOZHNY_VOROTNIK
рукава | тип рукава | втачной | реглан = REGLAN
рукава | длина рукава | любая (короткий/3/4/длинный) | не влияет
застежка | тип | молния | другое = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
пояс | пояс | отсутствует | наличие = POYAS
материал | тип материала | плательная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
декор | декор | отсутствует | наличие = DEKOR_ELEM
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПЛАТЬЕ_ОТРЕЗНОЕ ===
Спецификация платье с отрезной талией
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | платье с отрезной талией | лиф + юбка
конструкция | деление | отрез по талии | ключевой признак
конструкция | силуэт лифа | полуприлегающий | сложный = USLOZHNENNY_KROY
конструкция | силуэт юбки | прямой или легкий клеш | Плиссе = USLOZHNENNY_KROY
конструкция | членение | без рельефов | рельефы = RELYEFY
длина | длина изделия | до колена/миди | макси = DLINNOE
рукава | рукава | отсутствуют или простые | сложные = USLOZHNENNY_KROY
застежка | тип | молния | другое = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
конструкция | сборка | отсутствует | наличие = USLOZHNENNY_KROY
материал | тип материала | плательная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
декор | декор | отсутствует | наличие = DEKOR_ELEM
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПЛАТЬЕ_ВЕЧЕРНЕЕ ===
Спецификация платье вечернее(свадебное)
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | платье вечернее | без корсетной конструкции
конструкция | силуэт | полуприлегающий | жесткость = добавляется корсет 
конструкция | членение | простое | сложное = USLOZHNENNY_KROY
конструкция | Спина | Закрытая  | Открытая = USLOZHNENNY_KROY
конструкция | разрез | отсутствует | наличие = SHLITSA
длина | длина изделия | миди | макси = DLINNOE
горловина | форма | простая | сложная = SLOZHNY_VOROTNIK
рукава | рукава | отсутствуют или простые | сложные = USLOZHNENNY_KROY
застежка | тип | молния | другое = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
конструкция | многослойность | один слой | наличие = USLOZHNENNY_KROY
материал | тип материала | плательная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
декор | декор | отсутствует | наличие = DEKOR_ELEM
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ЮБКА_ПРЯМАЯ ===
Спецификация юбка прямая до колена 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | юбка прямая до колена | базовая модель
силуэт | силуэт | прямой | другое = USLOZHNENNY_KROY
членение | членение | без рельефов | рельефы = RELYEFY
длина | длина | до колена | длиннее = DLINNOE
пояс | пояс | притачной | сложный = USLOZHNENNY_KROY
застежка | тип | молния | другое = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
конструкция | разрез | отсутствует | наличие = SHLITSA
конструкция | складки | отсутствуют | наличие = USLOZHNENNY_KROY
конструкция | запах | отсутствует | наличие = USLOZHNENNY_KROY
материал | материал | костюмная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
декор | декор | отсутствует | наличие = DEKOR_ELEM
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ЮБКА_ПО_КОСОЙ ===
Спецификация юбка по косой 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | юбка по косой | ключевой признак
силуэт | силуэт | мягкий | жесткий = ошибка
членение | членение | без рельефов | рельефы = RELYEFY
длина | длина | миди | длиннее = DLINNOE
пояс | пояс | притачной или обтачка | сложный = USLOZHNENNY_KROY
застежка | тип | молния | другое = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
конструкция | разрез | отсутствует | наличие = USLOZHNENNY_KROY
материал | материал | мягкая ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_БРЮКИ_ЖЕНСКИЕ ===
Спецификация брюки женские два кармана
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | брюки женские | база
силуэт | силуэт | прямые | другое = USLOZHNENNY_KROY
посадка | посадка | средняя | другое = USLOZHNENNY_KROY
пояс | пояс | Со шлевками | сложный  = POYAS
застежка | тип | Гульфик на молнии с пуговицей | другое = USLOZHNENNY_KROY
карманы | передние | 2 боковых | доп = DOP_KARMAN
карманы | задние | 1 задний | доп = DOP_KARMAN
конструкция | защипы | отсутствуют | наличие = USLOZHNENNY_KROY
подкладка | подкладка | отсутствует | наличие = PODKLADKA
материал | материал | костюмная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_БРЮКИ_КЛАССИЧЕСКИЕ ===
Спецификация классические брюки
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | брюки классические | строгая модель
силуэт | силуэт | прямые | другое = USLOZHNENNY_KROY
стрелки | стрелки | присутствуют | база
пояс | пояс | со шлевками | сложный = POYAS
застежка | тип | гульфик на пуговице  | другое = USLOZHNENNY_KROY
карманы | передние | 2 боковых | доп = DOP_KARMAN
карманы | задние | 1.0 | доп = DOP_KARMAN
конструкция | защипы | отсутствуют | наличие = USLOZHNENNY_KROY
материал | материал | костюмная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_БРЮКИ_СПОРТ ===
Спецификация брюки спорт
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | брюки спортивные | база
конструкция | Низ  | Подгибка или резинка | кулиска= USLOZHNENNY_KROY
силуэт | силуэт | прямые/зауженные | широкие = USLOZHNENNY_KROY
пояс | пояс | резинка | другое = USLOZHNENNY_KROY
застежка | тип | отсутствует | наличие = USLOZHNENNY_KROY
карманы | карманы | 2 боковых | доп = DOP_KARMAN
материал | материал | трикотаж | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ДЖИНСЫ ===
Спецификация джинсы 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | джинсы | деним
силуэт | силуэт | прямые | другое = USLOZHNENNY_KROY
застежка | тип | молния | пуговицы = USLOZHNENNY_KROY
карманы | передние | 2 | доп = DOP_KARMAN
карманы | задние | 2 | доп = DOP_KARMAN
материал | материал | деним | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ЖИЛЕТ ===
Спецификация жилет 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | жилет костюмный | без рукавов
силуэт | силуэт | прилегающий | свободный = USLOZHNENNY_KROY
застежка | тип | пуговицы | сложная = USLOZHNENNY_KROY
вырез | форма | V-образный | другой = USLOZHNENNY_KROY
спинка | материал | основная ткань | подкладка = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
материал | материал | костюмная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ЖАКЕТ_ШАНЕЛЬ ===
Спецификация жакет шанель на органзе
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | жакет шанель | без воротника
силуэт | силуэт | прямой или слегка прилегающий | сложный = USLOZHNENNY_KROY
длина | длина | укороченный | длинный = DLINNOE
застежка | тип | пуговицы | сложная = USLOZHNENNY_KROY
отделка | тесьма | отсутствует | наличие = DEKOR_ELEM
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
материал | материал | Органза  | бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ЖАКЕТ ===
Спецификация жакет 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | жакет | базовый
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
воротник | тип | Классический воротник пиджачного типа  | сложный = SLOZHNY_VOROTNIK
застежка | тип | пуговицы | сложная = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
материал | материал | костюмная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПИДЖАК_КЕЖУАЛ ===
Спецификация пиджак мужской кежуал
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | пиджак кежуал | мягкий
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
карманы | карманы | 2 | доп = DOP_KARMAN
застежка | тип | пуговицы | сложная = USLOZHNENNY_KROY
подкладка | подкладка | отсутствует | наличие = PODKLADKA
материал | материал | костюмная ткань | шифон, бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56
воротник | тип | Классический воротник пиджачного типа  | сложный = SLOZHNY_VOROTNIK

=== СПЕЦ_ПИДЖАК_BESPOKE ===
Спецификация пиджак мужской классический
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | пиджак классический | полная конструкция
силуэт | силуэт | прилегающий | сложный = USLOZHNENNY_KROY
конструкция | бортовка | присутствует | база
карманы | карманы | 2 | доп = DOP_KARMAN
застежка | тип | пуговицы | Другая застежка= переход в категорию пиджак кежуал (повседневный)
подкладка | подкладка | присутствует | база
материал | материал | костюмная ткань | Другая ткань= переход в категорию пиджак кежуал (повседневный)
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПАЛЬТО ===
Спецификация пальто 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | пальто демисезонное | без утепления
силуэт | силуэт | прямой или полуприлегающий | сложный = USLOZHNENNY_KROY
длина | длина | ниже бедра | длиннее = DLINNOE
застежка | тип | пуговицы | Молния = USLOZHNENNY_KROY
карманы | карманы | 2 | доп = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
утепление | утепление | отсутствует | наличие= переход в категорию пальто зимнее
материал | материал | пальтовая ткань | бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПАЛЬТО_ЗИМНЕЕ ===
Спецификация пальто зимнее
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | пальто зимнее | утепленное
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
длина | длина | ниже колена | длиннее = DLINNOE
застежка | тип | пуговицы | Молния = USLOZHNENNY_KROY
карманы | карманы | 2 | доп = DOP_KARMAN
подкладка | подкладка | присутствует | база
утепление | утепление | присутствует | база
материал | материал | пальтовая ткань | кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПЛАЩ ===
Спецификация плащ 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | плащ | легкий
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
длина | длина | ниже бедра | длиннее = DLINNOE
застежка | тип | пуговицы | молния= USLOZHNENNY_KROY
карманы | карманы | 2 | доп = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
утепление | утепление | отсутствует | наличие = переход в категорию зимнее пальто  
материал | материал | легкая ткань | бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_КУРТКА ===
Спецификация куртка
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | куртка | без утепления
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
длина | длина | до бедра | длиннее = DLINNOE
застежка | тип | молния или пуговицы |  Супатная застежка= SUPAT
карманы | карманы | 2 | доп = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
утепление | утепление | отсутствует | наличие = переход в категорию пуховик
капюшон | капюшон | отсутствует | наличие = KAPYUSHON
материал | материал | ткань | бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_БОМБЕР ===
Спецификация бомбер 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | бомбер | укороченный
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
резинки | манжеты/низ | резинки | база
застежка | тип | молния | Супатная = SUPAT
карманы | карманы | 2 | доп = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
капюшон | капюшон | отсутствует | наличие =KAPYUSHON
материал | материал | Ткань | бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПАРКА ===
Спецификация парка
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | парка | удлиненная куртка
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
длина | длина | до бедра/ниже | длиннее = DLINNOE
застежка | тип | молния | Супатная= SUPAT
карманы | карманы | накладные 2 | доп = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
капюшон | капюшон | отсутствует | наличие =KAPYUSHON
материал | материал | Ткань | кожа мех= KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ЖИЛЕТ_ПУХОВОЙ ===
Спецификация жилет пуховой 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | жилет пуховой | утепленный
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
длина | длина | до бедра | длиннее = DLINNOE
застежка | тип | молния или кнопки | Супатная= SUPAT
карманы | карманы | 2 | доп = DOP_KARMAN
подкладка | подкладка | присутствует | база
утепление | утепление | присутствует | база
капюшон | капюшон | отсутствует | наличие = KAPYUSHON
материал | материал | Ткань | бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа = KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ПУХОВИК ===
Спецификация пуховик 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | пуховик | утепленный
силуэт | силуэт | объемный | сложный = USLOZHNENNY_KROY
длина | длина | до бедра | длиннее = DLINNOE
застежка | тип | молния + планка | Супатная= SUPAT
карманы | карманы | 2 | доп = DOP_KARMAN
подкладка | подкладка | присутствует | база
утепление | утепление | присутствует | база
капюшон | капюшон | отсутствует | наличие = KAPYUSHON
материал | материал | Ткань  | бархат, велюр, кружево= SLOZHNAYA_TKAN/ кожа = KOZHA_MEH
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ДУБЛЕНКА ===
Спецификация дубленка
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | дубленка | мех внутри
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
длина | длина | до бедра/колена | длиннее = DLINNOE
застежка | тип | пуговицы или молния | супатная=SUPAT
карманы | карманы | 2 | доп = DOP_KARMAN
подкладка | подкладка | отсутствует | наличие = PODKLADKA
утепление | утепление | встроено | база
капюшон | капюшон | отсутствует | наличие = KAPYUSHON
материал | материал | овчина | Другая= ошибка категории
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ЛОНГСЛИВ ===
Спецификация лонгслив 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | лонгслив | трикотаж
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
рукава | длина | длинный | короткий = смена категории на футболка
горловина | тип | круглая | сложная = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
материал | материал | трикотаж | бархат, велюр, кружево= SLOZHNAYA_TKAN
декор | декор | отсутствует | наличие = DEKOR_ELEM
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ХУДИ ===
Спецификация худи
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | худи | с капюшоном
силуэт | силуэт | прямой | oversize = USLOZHNENNY_KROY
капюшон | капюшон | присутствует | база
карманы | карманы | кенгуру | доп = DOP_KARMAN
застежка | тип | отсутствует | наличие = USLOZHNENNY_KROY
материал | материал | трикотаж | бархат, велюр, кружево= SLOZHNAYA_TKAN
размер | размер одежды | спросите размер одежды | >56 = RAZMER56
рукава | тип | втачной | реглан=REGLAN

=== СПЕЦ_СВИТШОТ ===
Спецификация свитшот 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | свитшот | без капюшона
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
рукава | тип | втачной | реглан=REGLAN
горловина | тип | круглая с резинкой | сложная = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
материал | материал | трикотаж | бархат, велюр, кружево= SLOZHNAYA_TKAN
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_ФУТБОЛКА ===
Спецификация футболка 
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | футболка | трикотаж
силуэт | силуэт | прямой | сложный = USLOZHNENNY_KROY
рукава | длина | короткий | длинный = лонгслив
Рукава | тип  | Втачной  | Реглан=REGLAN
горловина | тип | круглая | сложная = USLOZHNENNY_KROY
карманы | карманы | отсутствуют | наличие = DOP_KARMAN
материал | материал | трикотаж | бархат, велюр, кружево= SLOZHNAYA_TKAN
размер | размер одежды | спросите размер одежды | >56 = RAZMER56

=== СПЕЦ_БЕЙСБОЛКА ===
блок | параметр | базовое значение | комментарий для бота
конструкция | тип изделия | бейсболка | головной убор
конструкция | панели | 6 панелей | другое = USLOZHNENNY_KROY
козырек | тип | жесткий | сложный = USLOZHNENNY_KROY
регулировка | тип | простая | сложная = USLOZHNENNY_KROY
материал | материал | хлопок | кожа = KOZHA_MEH
декор | декор | отсутствует | наличие = DEKOR_ELEM

=== ПРИМЕНИМОСТЬ_ТОПЫ ===
Элемент | Код | Источник | Вопрос
шелк | SLOZHNAYA_TKAN | фото | да
кружево | SLOZHNAYA_TKAN | фото | да
бархат / велюр | SLOZHNAYA_TKAN | фото | Нет
кожа / замша | KOZHA_MEH | фото | нет
белая ткань | BELAYA | фото | нет
ткань с рисунком | RISUNOK | вопрос | Нет
оверсайз | USLOZHNENNY_KROY | фото | Нет
сложный крой (асимметрия, сложная форма) | USLOZHNENNY_KROY | фото+вопрос | Нет
корсет | USLOZHNENNY_KROY | фото | нет
без бретелей | USLOZHNENNY_KROY | фото | Нет
сложный верх (драпировки, фигурный) | USLOZHNENNY_KROY | фото | Нет
объемные рукава | USLOZHNENNY_KROY | фото | Нет
реглан | REGLAN | фото | Нет
пуговицы | USLOZHNENNY_KROY | фото | Нет
шнуровка (корсет) | USLOZHNENNY_KROY | фото | нет
супат | SUPAT | фото | да
вышивка | DEKOR_ELEM | фото | Нет
пайетки / бисер | PAYETKI | фото | Да
драпировки | USLOZHNENNY_KROY | фото | Нет
воланы / рюши | USLOZHNENNY_KROY | фото | Нет
подкладка | PODKLADKA | вопрос | да
размер >56 | RAZMER56 | вопрос | да
длинное изделие | DLINNOE | Фото  | Нет

=== ПРИМЕНИМОСТЬ_КУРТКА ===
Элемент | Код | Источник | Вопрос
кожа / замша | KOZHA_MEH | фото | нет
сложная ткань (бархат, велюр, кружево) | SLOZHNAYA_TKAN | Фото+вопрос | да
ткань дабл | DABL | вопрос | да
белая ткань | BELAYA | фото | нет
рукав реглан | REGLAN | фото | Нет
дополнительные рельефы | RELYEFY | фото | нет
отрезные элементы (сложное членение) | OTREZNAYA_TALIYA | фото | Нет
сложный крой (асимметрия, сложная форма) | USLOZHNENNY_KROY | фото | Нет
капюшон | KAPYUSHON | фото | Нет
доп карманы (>2) | DOP_KARMAN | фото | нет
супатная застежка | SUPAT | фото | Нет
пояс | POYAS | фото | нет
манжеты / шлицы | MANZHETY_SHLITSY | фото | нет
погоны / паты | POGONY_PATY | фото | нет
сложный воротник | SLOZHNY_VOROTNIK | фото | Нет
мех (основной материал) | KOZHA_MEH | фото | нет
меховой воротник (отложной) | MEH_VOROT_OTL | фото | нет
меховой воротник (английский) | MEH_VOROT_ANGL | фото | нет
меховые манжеты | MEH_MANZHETY | фото | нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
декоративные элементы | DEKOR_ELEM | фото | Нет
ткань с рисунком (клетка / полоска) | RISUNOK | Фото | Нет
размер >56 | RAZMER56 | вопрос | да
длина (если не базовая) | DLINNOE | фото | Нет
подкладка | PODKLADKA | вопрос | да

=== ПРИМЕНИМОСТЬ_БОМБЕР ===
Элемент | Код | Источник | Вопрос
кожа / замша | KOZHA_MEH | фото | нет
сложная ткань | SLOZHNAYA_TKAN | фото | да
рукав реглан | REGLAN | фото | Нет
сложный крой | USLOZHNENNY_KROY | Фото | Нет
доп карманы | DOP_KARMAN | фото | нет
манжеты / резинки | MANZHETY_SHLITSY | фото | нет
сложный воротник | SLOZHNY_VOROTNIK | фото | Нет
декоративные элементы | DEKOR_ELEM | фото | Нет
размер >56 | RAZMER56 | вопрос | да
подкладка | PODKLADKA | вопрос | да
ткань дабл | DABL | вопрос | да
белая ткань | BELAYA | фото | нет
ткань с рисунком (клетка / полоска) | RISUNOK | Фото | Нет
мех (основной материал) | KOZHA_MEH | фото | нет
меховой воротник (отложной) | MEH_VOROT_OTL | фото | нет
меховой воротник (английский) | MEH_VOROT_ANGL | фото | нет
меховые манжеты | MEH_MANZHETY | фото | нет
капюшон | KAPYUSHON | фото | Нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет

=== ПРИМЕНИМОСТЬ_ПАРКА ===
Элемент | Код | Источник | Вопрос
кожа / сложный материал | KOZHA_MEH | фото | нет
капюшон | KAPYUSHON | фото | нет
мех на капюшоне / воротнике | MEH_VOROT_OTL | фото | нет
Подкладка | PODKLADKA | вопрос | да
доп карманы | DOP_KARMAN | фото | нет
пояс / кулиска | POYAS | фото | нет
сложный крой | USLOZHNENNY_KROY | фото+вопрос | Нет
декоративные элементы | DEKOR_ELEM | фото | Нет
размер >56 | RAZMER56 | вопрос | да
ткань с рисунком (клетка / полоска) | RISUNOK | вопрос | Нет
белая ткань | BELAYA | фото | нет
ткань дабл | DABL | вопрос | да
рукав реглан | REGLAN | фото | Нет
мех (основной материал) | KOZHA_MEH | фото | нет
меховой воротник (отложной) | MEH_VOROT_OTL | фото | нет
меховой воротник (английский) | MEH_VOROT_ANGL | фото | нет
меховые манжеты | MEH_MANZHETY | фото | нет
манжеты / шлицы | MANZHETY_SHLITSY | фото | нет
сложный воротник | SLOZHNY_VOROTNIK | фото | Нет
дополнительные рельефы | RELYEFY | фото | нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет

=== ПРИМЕНИМОСТЬ_ЖИЛЕТ_ПУХОВОЙ ===
Элемент | Код | Источник | Вопрос
сложная ткань | SLOZHNAYA_TKAN | фото | да
доп карманы | DOP_KARMAN | фото | нет
капюшон | KAPYUSHON | фото | нет
длина | DLINNOE | фото | Нет
декоративные элементы | DEKOR_ELEM | фото | Нет
размер >56 | RAZMER56 | вопрос | да
кожа / сложный материал | KOZHA_MEH | фото | нет
ткань с рисунком (клетка / полоска) | RISUNOK | вопрос | Нет
белая ткань | BELAYA | фото | нет
ткань дабл | DABL | вопрос | да
сложный крой | USLOZHNENNY_KROY | фото+вопрос | Нет
дополнительные рельефы | RELYEFY | фото | нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
сложный воротник | SLOZHNY_VOROTNIK | фото | Нет
мех на капюшоне / воротнике | MEH_VOROT_OTL | фото | нет
меховой воротник (отложной) | MEH_VOROT_OTL | фото | нет
меховой воротник (английский) | MEH_VOROT_ANGL | фото | нет

=== ПРИМЕНИМОСТЬ_ПУХОВИК ===
Элемент | Код | Источник | Вопрос
сложная ткань | SLOZHNAYA_TKAN | фото | да
доп карманы | DOP_KARMAN | фото | нет
капюшон | KAPYUSHON | фото | нет
длина | DLINNOE | фото | Нет
декоративные элементы | DEKOR_ELEM | фото | Нет
размер >56 | RAZMER56 | вопрос | да
кожа / сложный материал | KOZHA_MEH | фото | нет
ткань с рисунком (клетка / полоска) | RISUNOK | вопрос | Нет
белая ткань | BELAYA | фото | нет
ткань дабл | DABL | вопрос | да
сложный крой | USLOZHNENNY_KROY | фото+вопрос | Нет
дополнительные рельефы | RELYEFY | фото | нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
сложный воротник | SLOZHNY_VOROTNIK | фото | Нет
мех на капюшоне / воротнике | MEH_VOROT_OTL | фото | нет
меховой воротник (отложной) | MEH_VOROT_OTL | фото | нет
меховой воротник (английский) | MEH_VOROT_ANGL | фото | нет
меховые манжеты | MEH_MANZHETY | фото | нет
манжеты / шлицы | MANZHETY_SHLITSY | фото | нет
рукав реглан | REGLAN | фото | Нет

=== ПРИМЕНИМОСТЬ_ПАЛЬТО ===
Элемент | Код | Источник | Вопрос
кожа / замша | KOZHA_MEH | фото | нет
сложная ткань (велюр, бархат) | SLOZHNAYA_TKAN | фото | да
ткань дабл | DABL | вопрос | да
белая ткань | BELAYA | фото | нет
рукав реглан | REGLAN | фото | Нет
дополнительные рельефы | RELYEFY | фото | нет
отрезные элементы | OTREZNAYA_TALIYA | фото | да
сложный крой | USLOZHNENNY_KROY | фото | Нет
капюшон | KAPYUSHON | фото | Нет
доп карманы (>2) | DOP_KARMAN | фото | нет
супатная застежка | SUPAT | фото | Нет
пояс | POYAS | фото | нет
манжеты / шлицы | MANZHETY_SHLITSY | фото | нет
погоны / паты | POGONY_PATY | фото | нет
сложный воротник | SLOZHNY_VOROTNIK | фото | Нет
меховой воротник (отложной) | MEH_VOROT_OTL | фото | нет
меховой воротник (английский) | MEH_VOROT_ANGL | фото | нет
меховые манжеты | MEH_MANZHETY | фото | нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
декоративные элементы | DEKOR_ELEM | фото | Нет
ткань с рисунком (клетка / полоска) | RISUNOK | Фото | Нет
размер >56 | RAZMER56 | вопрос | да
длина выше базовой | DLINNOE | фото | Нет
Подкладка  | PODKLADKA | вопрос | да

=== ПРИМЕНИМОСТЬ_ПЛАЩ ===
Элемент | Код | Источник | Вопрос
кожа / замша | KOZHA_MEH | фото | нет
сложная ткань (велюр, бархат) | SLOZHNAYA_TKAN | фото | да
ткань дабл | DABL | вопрос | да
белая ткань | BELAYA | фото | нет
рукав реглан | REGLAN | фото | Нет
дополнительные рельефы | RELYEFY | фото | нет
отрезные элементы | OTREZNAYA_TALIYA | фото | да
сложный крой | USLOZHNENNY_KROY | фото | Нет
капюшон | KAPYUSHON | фото | Нет
доп карманы (>2) | DOP_KARMAN | фото | нет
супатная застежка | SUPAT | фото | Нет
пояс | POYAS | фото | нет
манжеты / шлицы | MANZHETY_SHLITSY | фото | нет
погоны / паты | POGONY_PATY | фото | нет
сложный воротник | SLOZHNY_VOROTNIK | фото | Нет
меховой воротник (отложной) | MEH_VOROT_OTL | фото | нет
меховой воротник (английский) | MEH_VOROT_ANGL | фото | нет
меховые манжеты | MEH_MANZHETY | фото | нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
декоративные элементы | DEKOR_ELEM | фото | Нет
ткань с рисунком (клетка / полоска) | RISUNOK | Фото | Нет
размер >56 | RAZMER56 | вопрос | да
длина выше базовой | DLINNOE | фото | Нет
Подкладка  | PODKLADKA | вопрос | да

=== ПРИМЕНИМОСТЬ_ДУБЛЕНКА ===
Элемент | Код | Источник | Вопрос
белая ткань | BELAYA | фото | нет
рукав реглан | REGLAN | фото | Нет
дополнительные рельефы (конструктивные швы между панелями разных материалов, контрастные вставки кожи/замши) | RELYEFY | фото | нет
отрезные элементы (комбинация разных типов кожи/замши, лаковые вставки, контрастные панели) | OTREZNAYA_TALIYA | фото | Нет
сложный крой (асимметричная молния, диагональная застёжка, нестандартная форма, косая молния) | USLOZHNENNY_KROY | Фото | Нет
капюшон | KAPYUSHON | фото | Нет
доп карманы (>2) | DOP_KARMAN | фото | нет
супатная застежка | SUPAT | фото | Нет
пояс | POYAS | фото | нет
манжеты / шлицы | MANZHETY_SHLITSY | фото | нет
погоны / паты / ремешки / пряжки | POGONY_PATY | фото | нет
сложный воротник | SLOZHNY_VOROTNIK | фото | Нет
меховой воротник (отложной) | MEH_VOROT_OTL | фото | нет
меховой воротник (английский) | MEH_VOROT_ANGL | фото | нет
меховые манжеты (мех на краях рукавов/низа) | MEH_MANZHETY | фото | нет
отделочные строчки (видимые декоративные строчки вдоль швов и краёв) | OTDELOCHNYE_STROCHKI | фото | нет
декоративные элементы (пряжки, клипсы, металлические элементы, декоративные молнии) | DEKOR_ELEM | фото | Нет
ткань с рисунком (клетка / полоска) | RISUNOK | Фото | Нет
размер >56 | RAZMER56 | вопрос | да
длина (если не базовая) | DLINNOE | фото | Нет

=== ПРИМЕНИМОСТЬ_ЖАКЕТЫ ===
Элемент | Код | Источник | Вопрос
кожа / замша | KOZHA_MEH | фото | нет
сложная ткань (бархат, велюр) | SLOZHNAYA_TKAN | фото | Нет
белая ткань | BELAYA | фото | нет
ткань с рисунком (клетка, полоска) | RISUNOK | Фото | Нет
реглан | REGLAN | фото | Нет
рельефы / сложное членение | RELYEFY | фото | нет
сложный крой (асимметрия, нестандарт) | USLOZHNENNY_KROY | фото | Нет
двубортный | USLOZHNENNY_KROY | фото | нет
сложный лацкан | SLOZHNY_VOROTNIK | фото | Нет
декоративные карманы | DOP_KARMAN | фото | нет
доп карманы (>3) | DOP_KARMAN | фото | нет
шлица (2 или сложная) | MANZHETY_SHLITSY | фото | нет
пояс | POYAS | фото | нет
погоны / паты | POGONY_PATY | фото | нет
шлица на рукаве (рабочая) | MANZHETY_SHLITSY | фото | Нет
сложная конструкция рукава | USLOZHNENNY_KROY | фото | Нет
Подкладка | PODKLADKA | вопрос | да
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
декоративные элементы | DEKOR_ELEM | фото | Нет
размер >56 | RAZMER56 | вопрос | да

=== ПРИМЕНИМОСТЬ_БРЮКИ ===
Элемент | Код | Источник | Вопрос
кожа / замша | KOZHA_MEH | фото | нет
сложная ткань (вельвет, бархат) | SLOZHNAYA_TKAN | фото | да
белая ткань | BELAYA | фото | нет
ткань с рисунком (клетка / полоска) | RISUNOK | Фото | Нет
защипы (1 или 2) | USLOZHNENNY_KROY | фото | Нет
высокая посадка | USLOZHNENNY_KROY | фото | Нет
сложный крой (асимметрия, нестандарт) | USLOZHNENNY_KROY | фото | Нет
боковые регуляторы | POYAS | фото | Нет
пояс с продолжением | USLOZHNENNY_KROY | фото | Нет
доп карманы | DOP_KARMAN | фото | нет
карманы с листочкой / сложные | DOP_KARMAN | фото | Нет
пуговицы вместо молнии | USLOZHNENNY_KROY | Фото | Нет
супатная застежка | SUPAT | фото | Нет
манжеты | MANZHETY_SHLITSY | фото | нет
нестандартный низ | USLOZHNENNY_KROY | фото | Нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
декоративные элементы | DEKOR_ELEM | фото | Нет
размер >56 | RAZMER56 | вопрос | да

=== ПРИМЕНИМОСТЬ_РУБАШКИ ===
Элемент | Код | Источник | Вопрос
сложная ткань (кружево, шелк, бархат, шифон, органза) | SLOZHNAYA_TKAN | фото | да
белая ткань | BELAYA | фото | нет
ткань с рисунком (клетка / полоска) | RISUNOK | Фото | Нет
оверсайз | USLOZHNENNY_KROY | фото | Нет
сложный крой (асимметрия, нестандарт) | USLOZHNENNY_KROY | фото | Нет
рельефы / сложное членение | USLOZHNENNY_KROY | фото | Нет
сложный воротник (фигурный, дизайнерский) | SLOZHNY_VOROTNIK | фото | Нет
манжеты сложные (французские) | MANZHETY_SHLITSY | фото | Нет
реглан | REGLAN | фото | Нет
супатная застежка | SUPAT | фото | Нет
декоративная планка | DEKOR_ELEM | фото | Нет
доп карманы | DOP_KARMAN | фото | нет
сложные карманы | USLOZHNENNY_KROY | фото | Нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
вышивка / аппликация | DEKOR_ELEM | фото | Нет
рюши / воланы | USLOZHNENNY_KROY | фото | Нет
размер >56 | RAZMER56 | вопрос | да

=== ПРИМЕНИМОСТЬ_ПЛАТЬЯ ===
Элемент | Код | Источник | Вопрос
шелк | SLOZHNAYA_TKAN | фото | да
шифон / органза | SLOZHNAYA_TKAN | фото | да
кружево | SLOZHNAYA_TKAN | фото | да
бархат / велюр | SLOZHNAYA_TKAN | фото | да
белая ткань | BELAYA | фото | нет
ткань с рисунком | RISUNOK | Фото | Нет
оверсайз | USLOZHNENNY_KROY | фото | Нет
сложный крой (асимметрия, драпировки) | USLOZHNENNY_KROY | фото | Нет
корсетная конструкция | USLOZHNENNY_KROY | фото | нет
макси / длинное | DLINNOE | фото | да
сложный лиф (драпировки, запах) | USLOZHNENNY_KROY | фото | Нет
открытые плечи / сложный верх | USLOZHNENNY_KROY | фото | Нет
объемные рукава | USLOZHNENNY_KROY | фото | Нет
реглан | REGLAN | фото | Нет
клеш / солнце | USLOZHNENNY_KROY | фото | Нет
многоярусная юбка | USLOZHNENNY_KROY | фото | нет
сложные разрезы | USLOZHNENNY_KROY | фото | Нет
пуговицы | USLOZHNENNY_KROY | фото | Нет
супат | SUPAT | фото | Нет
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
вышивка | DEKOR_ELEM | фото | Нет
пайетки / бисер | PAYETKI | фото | да
драпировки | USLOZHNENNY_KROY | фото | Нет
воланы / рюши | USLOZHNENNY_KROY | фото | Нет
подкладка | PODKLADKA | вопрос | да
размер >56 | RAZMER56 | вопрос | да
кожа / замша | KOZHA_MEH | фото | нет

=== ПРИМЕНИМОСТЬ_ЮБКИ ===
Элемент | Код | Источник | Вопрос
кожа / замша | KOZHA_MEH | фото | нет
шелк | SLOZHNAYA_TKAN | фото | да
шифон / органза | SLOZHNAYA_TKAN | фото | да
кружево | SLOZHNAYA_TKAN | фото | да
белая ткань | BELAYA | фото | нет
ткань с рисунком (клетка / полоска) | RISUNOK | Фото | Нет
макси / длинная | DLINNOE | фото | Нет
клеш / солнце | USLOZHNENNY_KROY | фото | Нет
полусолнце | USLOZHNENNY_KROY | фото | Нет
многоярусная | USLOZHNENNY_KROY | фото | нет
асимметрия | USLOZHNENNY_KROY | фото | Нет
запах | USLOZHNENNY_KROY | фото | Нет
широкий пояс | USLOZHNENNY_KROY | фото | Нет
пояс декоративный | POYAS | фото | нет
разрез 1 | USLOZHNENNY_KROY | фото | Нет
несколько разрезов | USLOZHNENNY_KROY | фото | нет
пуговицы | USLOZHNENNY_KROY | фото | Нет
супат | SUPAT | фото | да
отделочные строчки | OTDELOCHNYE_STROCHKI | фото | нет
вышивка | DEKOR_ELEM | фото | да
пайетки / бисер | PAYETKI | фото | нет
воланы / рюши | USLOZHNENNY_KROY | фото | Нет
складки (плиссе, сложные) | USLOZHNENNY_KROY | фото | нет
подкладка | PODKLADKA | вопрос | да
размер >56 | RAZMER56 | вопрос | да

=== ПРИМЕНИМОСТЬ_ТРИКОТАЖ ===
Элемент | Код | Источник | Вопрос
белая ткань | BELAYA | фото | нет
ткань с рисунком | RISUNOK | Фото | Нет
оверсайз | USLOZHNENNY_KROY | фото | Нет
сложный крой (асимметрия, сложная форма) | USLOZHNENNY_KROY | фото | Нет
рельефы / сложное членение | USLOZHNENNY_KROY | фото | Нет
реглан | REGLAN | фото | Нет
объемные рукава | USLOZHNENNY_KROY | фото | Нет
удлиненное изделие | DLINNOE | фото | Нет
сложный ворот | SLOZHNY_VOROTNIK | фото | Нет
вышивка / принт | DEKOR_ELEM | фото | Нет
пайетки / элементы | DEKOR_ELEM | фото | нет
размер >56 | RAZMER56 | вопрос | да

=== СКРИПТ_БОТА ===
Категория | Шаг | Действие
КУРТКА | 1 | Определи по фото материал, длину и базовую форму.
КУРТКА | 2 | Спроси только то, что неочевидно по фото: подкладка, капюшон, размер одежды.
БОМБЕР | 1 | Определи по фото материал, длину и базовую форму.
БОМБЕР | 2 | Спроси только то, что неочевидно по фото: подкладка, реглан, размер одежды.
ПАРКА | 1 | Определи по фото материал, длину, капюшон и карманы.
ПАРКА | 2 | Спроси только то, что неочевидно по фото: утепление, размер одежды, рисунок ткани.
ЖИЛЕТ_ПУХОВОЙ | 1 | Определи по фото базовую форму, длину и наличие капюшона.
ЖИЛЕТ_ПУХОВОЙ | 2 | Спроси только то, что неочевидно по фото: размер одежды.
ПУХОВИК | 1 | Определи по фото длину, мех, карманы и базовую форму.
ПУХОВИК | 2 | Спроси только то, что неочевидно по фото: размер одежды.
ПАЛЬТО | 1 | Определи по фото материал, длину, воротник, пояс и базовую форму.
ПАЛЬТО | 2 | Спроси только то, что неочевидно по фото: утепление, размер одежды, рисунок ткани.
ПЛАЩ | 1 | Определи по фото длину, пояс, реглан, супат и базовую форму.
ПЛАЩ | 2 | Спроси только то, что неочевидно по фото: рисунок ткани, размер одежды.
ДУБЛЕНКА | 1 | Определи по фото длину, материал, меховые элементы и базовую форму.
ДУБЛЕНКА | 2 | Спроси только то, что неочевидно по фото: размер одежды.
ЖАКЕТЫ | 1 | Определи тип пиджака (кежуал или классический) — если ещё не определён, спроси.
ЖАКЕТЫ | 2 | Для кежуал: спроси подкладку и размер одежды. Для классического: спроси только размер одежды. Подкладка в классическом включена в базу.
ЖАКЕТЫ | 3 | Все остальные драйверы (карманы, шлицы, ткань, воротник, декор) — определи по фото и сразу считай.
БРЮКИ | 1 | Определи по фото длину, карманы, манжеты, защипы и базовую форму.
БРЮКИ | 2 | Спроси только то, что неочевидно по фото: размер одежды, рисунок ткани, застежка на пуговицах.
РУБАШКИ | 1 | Определи по фото воротник, манжеты, карманы, базовую форму.
РУБАШКИ | 2 | Спроси только то, что неочевидно по фото: рисунок ткани, размер одежды, супатная застежка.
ПЛАТЬЯ | 1 | Определи по фото длину, сложность лифа, юбки, рукавов и базовую форму.
ПЛАТЬЯ | 2 | Спроси только то, что неочевидно по фото: подкладка, рисунок ткани, размер одежды.
ЮБКИ | 1 | Определи по фото длину, конструкцию, пояс, разрезы и базовую форму.
ЮБКИ | 2 | Спроси только то, что неочевидно по фото: подкладка, рисунок ткани, размер одежды.
ТРИКОТАЖ | 1 | Определи по фото материал, форму, длину, рукава и базовую форму.
ТРИКОТАЖ | 2 | Спроси только то, что неочевидно по фото: рисунок ткани, размер одежды.
ТОПЫ | 1 | Определи по фото материал, верх, рукава, форму и базовую форму.
ТОПЫ | 2 | Спроси только то, что неочевидно по фото: подкладка, рисунок ткани, размер одежды.
`;

const ALTERATION_PRICE_DATA = `
=== КОРРЕКТИРОВКА ИЗДЕЛИЙ ===
(Указаны минимальные цены. На подкладке +50%.)

--- Пиджак ---
Длина рукава через шлицу, с переносом петель — от 4 500 ₽
Длина рукава через низ без переноса петель со шлицей — от 2 500 ₽
Длина рукава через окат с плечевыми накладками — от 5 500 ₽
Длина рукава через окат, облегчённый вариант — от 3 500 ₽
Корректировка проймы, длина плеча — от 5 000 ₽
Ушить / расставить по среднему шву без шлицы — от 1 200 ₽
Ушить / расставить по среднему шву со шлицей — от 2 500 ₽
Ушить / расставить по рельефам без шлиц — от 3 000 ₽
Ушить / расставить по рельефам со шлицей — от 4 500 ₽
Корректировка линии ростка без плечевых — от 2 700 ₽
Корректировка линии ростка с плечевыми — от 4 500 ₽
Изменение длины изделия — от 2 500 ₽
Изменение длины изделия с одной шлицей — от 3 500 ₽
Изменение длины изделия с 2 шлицами — от 4 500 ₽
Ушить рукава по переднему шву с корректировкой низа — от 2 200 ₽
Ушить рукава по локтевому до шлицы — от 2 200 ₽
Замена подкладки частичная — от 3 000 ₽
Замена подкладки полная с изготовлением карманов — от 14 000 ₽
Восстановление ручного стяжка (10 см) — от 200 ₽

--- Брюки ---
Ушить / расшить средний шов пояса — от 1 500 ₽
Ушить / расшить по боковым без затрагивания пояса — от 1 800 ₽
Ушить / расшить по боковым с затрагиванием пояса — от 3 000 ₽
Ушить / расшить по шаговым — от 1 500 ₽
Коррекция переднезаднего баланса — от 3 000 ₽
Изменение длины с тесьмой — от 1 800 ₽
Изменение длины под строчку (чиносы) — от 1 500 ₽
Изменение длины с манжетой (с тесьмой) — от 2 000 ₽
Изменение длины с манжетой без тесьмы — от 1 800 ₽
Восстановить мешковину кармана — от 2 500 ₽
Перекрой задней половинки — от 3 500 ₽
Перенос окантовки (10 см) — от 200 ₽
Углубить шов сиденья — от 1 000 ₽

--- Джинсы ---
Изменение длины с сохранением вара — от 2 300 ₽
Изменение длины без сохранения вара — от 1 800 ₽
Изменить объём талии (ушить пояс, отформовать кокетку) — от 2 700 ₽
Ушить по боковым или шаговым без отделочной строчки — от 2 300 ₽
Ушить по боковым или шаговым с отделочной строчкой — от 2 500 ₽
Штопка (1 кв. см) — от 500 ₽
Штопка под карманами с восстановлением строчек (1 карман) — от 1 200 ₽
Замена молнии с вмешательством в пояс — от 2 500 ₽
Изменение баланса (перенос шлевок) — от 3 000 ₽
Замена мешковины кармана — от 2 500 ₽

--- Сорочка / Блузка ---
Изменение длины рукава с переносом планки — от 3 000 ₽
Изменение длины рукава без переноса планки — от 2 000 ₽
Изменение длины изделия с восст. уголков по боковым — от 2 250 ₽
Изменение длины изделия — от 1 500 ₽
Ушить по вытачкам — от 1 000 ₽
Ушить по боковым (запаковочный шов) — от 2 500 ₽
Ушить по боковым под оверлок — от 1 500 ₽
Ушить рукава (запаковочный шов) до манжеты — от 2 500 ₽
Ушить рукава под оверлок — от 1 500 ₽
Корректировка проймы (запаковочный шов) — от 3 000 ₽
Корректировка проймы под оверлок — от 2 000 ₽
Корректировка баланса (кокетка) — от 2 500 ₽

--- Юбка ---
Изменение длины прямого силуэта без шлицы — от 2 000 ₽
Изменение длины прямого силуэта со шлицей — от 2 500 ₽
Ушить по боковым — от 1 500 ₽
Ушить по среднему с переносом молнии — от 2 000 ₽
Корректировка баланса — от 2 000 ₽
Шов «американка» (10 см) — от 150 ₽
Ролевый шов (10 см) — от 100 ₽

--- Платье ---
Изменение длины бретелей — от 1 500 ₽
Изменение баланса с перекроем плечевого пояса — от 3 000 ₽
Коррекция пройм — от 3 000 ₽
Корректировка линии талии с переносом молнии — от 3 000 ₽
Ушить по боковым или рельефам — от 2 500 ₽
Ушить по вытачкам по спинке или переду — от 1 500 ₽
Перенос / замена молнии — от 2 000 ₽
Ушить длинные рукава без корректировки низа — от 1 900 ₽
Ушить рукава с корректировкой низа — от 2 200 ₽
Изменение длины подкладки (прямой крой) — от 1 300 ₽
Изготовить подкладку (прямой крой, без ткани) — от 15 000 ₽

--- Пуховики ---
Укоротить рукава по низу — от 5 000 ₽
Укоротить рукава через окат — от 9 000 ₽
Укоротить длину — от 5 000 ₽
Ушить по боковым или рельефам — от 9 000 ₽
Ушить по среднему шву — от 4 500 ₽

--- Дополнительно ---
Изготовление глазковой петли — 350 ₽
Пришить пуговицу — 150 ₽
Поставить кнопку — 250 ₽
Замена молнии на ветрозащитном клапане — от 5 000 ₽
Замена молнии с кантами на ветрозащитном клапане — от 6 500 ₽
Ремонт кармана (1 ед.) — от 2 500 ₽
Замена молнии без ветрозащитного клапана — от 4 000 ₽

--- Трикотаж ---
Укоротить футболку на распошиве — от 1 200 ₽
Укоротить футболку с разрезами по бокам — от 1 500 ₽
Укоротить рукава на футболке — от 1 200 ₽
Укоротить низ трикотаж 7–10 класс (петля в петлю) — от 8 000 ₽
Укоротить низ трикотаж 10–14 класс (петля в петлю) — от 12 000 ₽

--- Галантерея ---
Пробивка отверстия в ремне — 140 ₽
Укорачивание ремня с винтовым отверстием — 170 ₽
`;

// === Parse PRICE_DATA into named sections ===
function parseSections(text) {
  const sections = {};
  const regex = /===\s*([A-ZА-ЯЁ_0-9]+)\s*===/g;
  let match;
  const markers = [];
  while ((match = regex.exec(text)) !== null) {
    markers.push({ name: match[1], start: match.index, headerEnd: match.index + match[0].length });
  }
  for (let i = 0; i < markers.length; i++) {
    const contentStart = markers[i].headerEnd;
    const contentEnd = i + 1 < markers.length ? markers[i + 1].start : text.length;
    sections[markers[i].name] = `=== ${markers[i].name} ===\n${text.slice(contentStart, contentEnd).trim()}`;
  }
  return sections;
}

const SECTIONS = parseSections(PRICE_DATA);
console.log('[Init] Parsed sections:', Object.keys(SECTIONS).length, 'keys:', Object.keys(SECTIONS).join(', '));
console.log('[Init] БАЗА_ИЗДЕЛИЙ length:', (SECTIONS['БАЗА_ИЗДЕЛИЙ'] || 'MISSING').length);
console.log('[Init] ДРАЙВЕРЫ length:', (SECTIONS['ДРАЙВЕРЫ'] || 'MISSING').length);

function normalizeRuText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMessageText(message = {}) {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join(' ');
  }
  return '';
}

function parseRubPrice(value = '') {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : null;
}

function parseAlterationPriceData(text) {
  const sections = {};
  const sectionRegex = /---\s*([^-]+?)\s*---/g;
  const markers = [];
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    markers.push({ name: match[1].trim(), start: match.index, headerEnd: match.index + match[0].length });
  }

  for (let i = 0; i < markers.length; i += 1) {
    const category = markers[i].name;
    const contentStart = markers[i].headerEnd;
    const contentEnd = i + 1 < markers.length ? markers[i + 1].start : text.length;
    const lines = text.slice(contentStart, contentEnd).split('\n').map((line) => line.trim()).filter(Boolean);

    sections[category] = lines
      .map((line) => {
        const priceMatch = line.match(/^(.+?)\s+—\s+(от\s+)?([\d\s]+)\s*₽/i);
        if (!priceMatch) return null;
        return {
          category,
          name: priceMatch[1].trim(),
          price: parseRubPrice(priceMatch[3]),
          from: Boolean(priceMatch[2]),
        };
      })
      .filter((item) => item && item.price);
  }

  return sections;
}

const BLOCKED_ALTERATION_ENTRY_PATTERNS = [
  /полусолн/i,
  /клин/i,
];

function isApprovedAlterationEntry(entry) {
  const normalizedName = normalizeRuText(entry?.name || '');
  return !BLOCKED_ALTERATION_ENTRY_PATTERNS.some((pattern) => pattern.test(normalizedName));
}

function buildApprovedAlterationCatalog(sections) {
  const approved = {};
  for (const [category, entries] of Object.entries(sections)) {
    approved[category] = entries.filter(isApprovedAlterationEntry);
  }
  return approved;
}

function formatAlterationCatalogForPrompt(sections) {
  return Object.entries(sections)
    .map(([category, entries]) => [
      `--- ${category} ---`,
      ...entries.map((entry) => `${entry.name} — ${entry.from ? 'от ' : ''}${formatRub(entry.price)} ₽`),
    ].join('\n'))
    .join('\n\n');
}

const RAW_ALTERATION_SECTIONS = parseAlterationPriceData(ALTERATION_PRICE_DATA);
const APPROVED_ALTERATION_CATALOG = buildApprovedAlterationCatalog(RAW_ALTERATION_SECTIONS);
const ALTERATION_SECTIONS = APPROVED_ALTERATION_CATALOG;
const ALTERATION_APPROVED_PRICE_DATA = formatAlterationCatalogForPrompt(APPROVED_ALTERATION_CATALOG);
const ALTERATION_LINING_CATEGORIES = new Set(['Пиджак', 'Брюки', 'Юбка', 'Платье']);

function findAlterationEntry(category, matcher) {
  const entries = ALTERATION_SECTIONS[category] || [];
  if (typeof matcher === 'string') {
    const normalizedNeedle = normalizeRuText(matcher);
    return entries.find((entry) => normalizeRuText(entry.name).includes(normalizedNeedle)) || null;
  }
  return entries.find((entry) => matcher(normalizeRuText(entry.name), entry)) || null;
}

function dedupeAlterationEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry) return false;
    const key = `${entry.category}|${entry.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasTailoringIntent(userText = '') {
  const text = normalizeRuText(userText);
  return /(^|\s)(пошив|сшить|пошить|шить|сшиваем|шьем|шьём)(\s|$)|с нуля|на заказ|индивидуальн/.test(text)
    && !/перешить|подшить|ушить|расшить/.test(text);
}

function hasAlterationIntent(userText = '', assistantText = '', assistantContext = null) {
  const text = normalizeRuText(userText);
  const assistant = normalizeRuText(assistantText);
  const route = normalizeAssistantRoute(assistantContext?.route || '');

  if (route.includes('/services/alterations')) return true;
  if (/стоимость корректировки|корректировк[аи]\s+по прайсу|прайс[а-я\s]+корректиров/.test(assistant)) return true;
  if (hasTailoringIntent(text) && !/коррект|укорот|подшить|ушить|расшить|замен|ремонт|подгон|перешить/.test(text)) return false;

  return /корректиров|скоррект|подгон|подогнать|укорот|подшить|ушить|расшить|сузить|расширить|уменьшить|увеличить|перешить|заменить|поменять|ремонт|штопк|молни|пуговиц|кнопк|петл|подкладк|шлиц|манжет|сохранени[ея]\s+(?:шва|вара)|фабричн[а-я\s]+шв|готов[а-я\s]+издел/.test(text);
}

const ALTERATION_GARMENT_CATEGORY_RULES = [
  { category: 'Джинсы', pattern: /джинс|деним/ },
  { category: 'Пуховики', pattern: /пуховик|пуховк|пухов|стеган[а-я]*\s+куртк|стеган[а-я]*\s+жилет/ },
  { category: 'Пиджак', pattern: /пиджак|жакет|блейзер/ },
  { category: 'Брюки', pattern: /брюк|брюч|штан|чинос/ },
  { category: 'Сорочка / Блузка', pattern: /сорочк|рубашк|блуз/ },
  { category: 'Юбка', pattern: /юбк/ },
  { category: 'Платье', pattern: /плать/ },
  { category: 'Трикотаж', pattern: /трикотаж|футболк|лонгслив|свитер|джемпер|кофт|худи|свитшот|поло/ },
  { category: 'Галантерея', pattern: /ремен|ремня|ремне|отверсти[ея]/ },
];

function getAlterationCategoryPattern(category) {
  return ALTERATION_GARMENT_CATEGORY_RULES.find((rule) => rule.category === category)?.pattern || null;
}

function getAlterationCategoryMentions(userText = '', assistantText = '') {
  const text = normalizeRuText(`${userText} ${assistantText}`);
  return Array.from(new Set(
    ALTERATION_GARMENT_CATEGORY_RULES
      .filter((rule) => rule.pattern.test(text))
      .map((rule) => rule.category)
  ));
}

function detectAlterationCategory(userText = '', assistantText = '', photoCategory = '') {
  if (photoCategory && ALTERATION_SECTIONS[photoCategory]) return photoCategory;

  const text = normalizeRuText(`${userText} ${assistantText}`);
  const unique = getAlterationCategoryMentions(userText, assistantText);

  if (unique.length === 1) return unique[0];
  if (unique.length > 1) return { ambiguous: unique };
  if (/пуговиц|кнопк|молни|карман|глазков|ветрозащитн|клапан|петл/.test(text)) return 'Дополнительно';
  return null;
}

function resolveAlterationCategorySelection(ambiguousCategories = [], latestUserText = '', options = {}) {
  const text = normalizeRuText(latestUserText);
  if (!Array.isArray(ambiguousCategories) || ambiguousCategories.length === 0 || !text) return null;
  const allowExclusion = options.allowExclusion !== false;

  const mentioned = getAlterationCategoryMentions(text, '')
    .filter((category) => ambiguousCategories.includes(category));
  const isExclusion = /без|убер|убира|исключ|отмен|не\s+над|не\s+нуж/.test(text)
    && !/остав|оставим|оставля|берем|берём|выбира|счита|посчита|нужен|нужно/.test(text);

  if (mentioned.length === 1) {
    if (allowExclusion && isExclusion && ambiguousCategories.length === 2) {
      return ambiguousCategories.find((category) => category !== mentioned[0]) || null;
    }
    return mentioned[0];
  }

  if (/перв/.test(text)) return ambiguousCategories[0] || null;
  if (/втор/.test(text)) return ambiguousCategories[1] || null;
  if (/трет|треть/.test(text)) return ambiguousCategories[2] || null;
  return null;
}

function extractAlterationWorkTextForCategory(category, allUserTexts = '', latestUserText = '', userTextParts = []) {
  const normalizedParts = (Array.isArray(userTextParts) && userTextParts.length > 0 ? userTextParts : [allUserTexts])
    .map((part) => normalizeRuText(part))
    .filter(Boolean);
  const normalized = normalizedParts.join(' ');
  const categoryPattern = getAlterationCategoryPattern(category);
  if (!categoryPattern) return allUserTexts;

  const mentionedCategories = getAlterationCategoryMentions(normalized, '');
  if (mentionedCategories.length <= 1) return allUserTexts;

  const fragments = normalizedParts
    .flatMap((part) => part.split(/(?:[.!?;,\n]+|\s+(?:и|а)\s+)/))
    .map((fragment) => fragment.trim())
    .filter(Boolean);
  const categoryFragments = fragments.filter((fragment) => categoryPattern.test(fragment));

  if (categoryFragments.length === 0) return allUserTexts;
  return normalizeRuText(`${categoryFragments.join(' ')} ${latestUserText}`);
}

function getAlterationLiningState(text = '') {
  const normalized = normalizeRuText(text);
  if (/без\s+подкладк|подкладк[а-я\s]*(?:нет|не\s+нужн)|не\s+на\s+подкладк/.test(normalized)) return 'no';
  if (/с\s+подкладк|на\s+подкладк|есть\s+подкладк|подкладк[а-я\s]*(?:есть|нужн)/.test(normalized)) return 'yes';
  return 'unknown';
}

function getAlterationLiningStateFromContext(workText = '', latestUserText = '', latestAssistantText = '') {
  const directState = getAlterationLiningState(workText);
  if (directState !== 'unknown') return directState;

  const assistant = normalizeRuText(latestAssistantText);
  const latest = normalizeRuText(latestUserText);
  if (!/подкладк/.test(assistant) || !latest) return 'unknown';

  if (/^(да|с|на|есть|нужн)/.test(latest) || /\bда\b/.test(latest)) return 'yes';
  if (/^(нет|без|не\s+нужн|не\s+надо)/.test(latest) || /\bнет\b/.test(latest)) return 'no';
  return 'unknown';
}

function isAlterationLiningApplicable(entry) {
  if (!entry || !ALTERATION_LINING_CATEGORIES.has(entry.category)) return false;
  return !/подкладк/.test(normalizeRuText(entry.name));
}

function getAlterationKnownWorkSignal(text = '') {
  const normalized = normalizeRuText(text);
  return /укорот|длин|подшить|ушить|расшить|сузить|расширить|замен|помен|перенос|штоп|молни|пуговиц|кнопк|петл|карман|баланс|пройм|плеч|ростк|тал|пояс|бретел|манжет|шлиц|дыр|отверст|окантов|стяж|сидень|кокетк|вытачк|рельеф|планк|оверлок|распошив|футболк/.test(normalized);
}

function addAlterationMatch(matches, category, matcher) {
  const entry = findAlterationEntry(category, matcher);
  if (entry) matches.push(entry);
  return entry;
}

function matchPantsAlterations(text, matches, questions) {
  if (/(тал|пояс|средн)/.test(text) && /(уш|расш|суз|расшир|уменьш|увелич|измен)/.test(text)) {
    addAlterationMatch(matches, 'Брюки', 'Ушить / расшить средний шов пояса');
  }
  if (/бок/.test(text) && /(уш|расш|суз|расшир)/.test(text)) {
    if (/без\s+(?:затраг|пояс)|не\s+трог/.test(text)) addAlterationMatch(matches, 'Брюки', 'Ушить / расшить по боковым без затрагивания пояса');
    else if (/с\s+(?:затраг|пояс)|затрагиванием\s+пояса/.test(text)) addAlterationMatch(matches, 'Брюки', 'Ушить / расшить по боковым с затрагиванием пояса');
    else questions.push('Скажите, нужно затрагивать пояс или не трогать его?');
  }
  if (/шагов/.test(text) && /(уш|расш|суз|расшир)/.test(text)) addAlterationMatch(matches, 'Брюки', 'Ушить / расшить по шаговым');
  if (/баланс|переднезад/.test(text)) addAlterationMatch(matches, 'Брюки', 'Коррекция переднезаднего баланса');
  if (/(длин|укорот|подшить)/.test(text)) {
    if (/манжет/.test(text) && /без\s+тесьм/.test(text)) addAlterationMatch(matches, 'Брюки', 'Изменение длины с манжетой без тесьмы');
    else if (/манжет/.test(text)) addAlterationMatch(matches, 'Брюки', 'Изменение длины с манжетой (с тесьмой)');
    else if (/чинос|строч/.test(text)) addAlterationMatch(matches, 'Брюки', 'Изменение длины под строчку (чиносы)');
    else if (/тесьм/.test(text)) addAlterationMatch(matches, 'Брюки', 'Изменение длины с тесьмой');
    else questions.push('Скажите, обработка низа брюк с тесьмой, под строчку или с манжетой?');
  }
  if (/мешковин|карман/.test(text)) addAlterationMatch(matches, 'Брюки', 'Восстановить мешковину кармана');
  if (/задн[а-я\s]+полов|перекрой/.test(text)) addAlterationMatch(matches, 'Брюки', 'Перекрой задней половинки');
  if (/окантов/.test(text)) addAlterationMatch(matches, 'Брюки', 'Перенос окантовки');
  if (/сидень/.test(text)) addAlterationMatch(matches, 'Брюки', 'Углубить шов сиденья');
}

function matchAlterationWorks(category, userText = '', photoWorkNames = []) {
  const text = normalizeRuText(userText);
  const matches = [];
  const questions = [];
  const unavailable = [];

  for (const workName of photoWorkNames || []) {
    const exact = findAlterationEntry(category, (_name, entry) => normalizeRuText(entry.name) === normalizeRuText(workName));
    if (exact) matches.push(exact);
  }

  if (category === 'Пиджак') {
    if (/подкладк/.test(text) && /(замен|помен|нов|изготов)/.test(text)) {
      if (/полн|целик|вся|карман/.test(text)) addAlterationMatch(matches, category, 'Замена подкладки полная');
      else if (/частич/.test(text)) addAlterationMatch(matches, category, 'Замена подкладки частичная');
      else questions.push('Скажите, нужна частичная или полная замена подкладки?');
    }
    if (/ручн|стяж/.test(text)) addAlterationMatch(matches, category, 'Восстановление ручного стяжка');
    if (/рукав/.test(text) && /(укорот|длин|измен)/.test(text)) {
      if (/окат/.test(text)) {
        if (/плечев|наклад/.test(text)) addAlterationMatch(matches, category, 'Длина рукава через окат с плечевыми накладками');
        else if (/облег/.test(text)) addAlterationMatch(matches, category, 'Длина рукава через окат, облегчённый вариант');
        else questions.push('Скажите, рукав через окат с плечевыми накладками или облегченный вариант?');
      } else if (/шлиц/.test(text)) {
        if (/без\s+перенос/.test(text)) addAlterationMatch(matches, category, 'Длина рукава через низ без переноса петель со шлицей');
        else if (/перенос|петел|петель/.test(text)) addAlterationMatch(matches, category, 'Длина рукава через шлицу, с переносом петель');
        else questions.push('Скажите, нужен перенос петель или без переноса?');
      } else {
        questions.push('Скажите, рукав пиджака укорачиваем через шлицу, через низ без переноса петель или через окат?');
      }
    }
    if (/пройм|длин[а-я\s]+плеч/.test(text)) addAlterationMatch(matches, category, 'Корректировка проймы, длина плеча');
    if (/ростк/.test(text)) {
      if (/с\s+плечев|плечев/.test(text)) addAlterationMatch(matches, category, 'Корректировка линии ростка с плечевыми');
      else if (/без\s+плечев/.test(text)) addAlterationMatch(matches, category, 'Корректировка линии ростка без плечевых');
      else questions.push('Скажите, пиджак с плечевыми накладками или без?');
    }
    if (/средн/.test(text) && /(уш|расстав|расш)/.test(text)) {
      if (/со\s+шлиц|с\s+шлиц/.test(text)) addAlterationMatch(matches, category, 'Ушить / расставить по среднему шву со шлицей');
      else if (/без\s+шлиц/.test(text)) addAlterationMatch(matches, category, 'Ушить / расставить по среднему шву без шлицы');
      else questions.push('Скажите, по среднему шву пиджака есть шлица или без шлицы?');
    }
    if (/рельеф/.test(text) && /(уш|расстав|расш)/.test(text)) {
      if (/со\s+шлиц|с\s+шлиц/.test(text)) addAlterationMatch(matches, category, 'Ушить / расставить по рельефам со шлицей');
      else if (/без\s+шлиц/.test(text)) addAlterationMatch(matches, category, 'Ушить / расставить по рельефам без шлиц');
      else questions.push('Скажите, по рельефам пиджака есть шлица или без шлиц?');
    }
    if (/(длин|укорот|подшить|низ)/.test(text) && !/рукав/.test(text)) {
      if (/2\s+шлиц|дв[ае]\s+шлиц/.test(text)) addAlterationMatch(matches, category, 'Изменение длины изделия с 2 шлицами');
      else if (/без\s+шлиц/.test(text)) addAlterationMatch(matches, category, 'Изменение длины изделия');
      else if (/шлиц/.test(text)) addAlterationMatch(matches, category, 'Изменение длины изделия с одной шлицей');
      else addAlterationMatch(matches, category, 'Изменение длины изделия');
    }
    if (/(уш|суз).{0,20}рукав/.test(text)) {
      if (/локт/.test(text)) addAlterationMatch(matches, category, 'Ушить рукава по локтевому до шлицы');
      else addAlterationMatch(matches, category, 'Ушить рукава по переднему шву с корректировкой низа');
    }
  }

  if (category === 'Брюки') matchPantsAlterations(text, matches, questions);

  if (category === 'Джинсы') {
    if (/(длин|укорот|подшить)/.test(text)) {
      if (/сохран|фабрич|родн|вар|шов/.test(text)) addAlterationMatch(matches, category, 'Изменение длины с сохранением вара');
      else if (/без\s+сохран|обыч/.test(text)) addAlterationMatch(matches, category, 'Изменение длины без сохранения вара');
      else questions.push('Скажите, джинсы подшиваем с сохранением фабричного низа или без сохранения?');
    }
    if (/(тал|пояс|кокет)/.test(text) && /(уш|измен|суз|уменьш|увелич)/.test(text)) addAlterationMatch(matches, category, 'Изменить объём талии');
    if (/(бок|шагов)/.test(text) && /(уш|суз|расш)/.test(text)) {
      if (/отделочн|строч/.test(text)) addAlterationMatch(matches, category, 'Ушить по боковым или шаговым с отделочной строчкой');
      else addAlterationMatch(matches, category, 'Ушить по боковым или шаговым без отделочной строчки');
    }
    if (/штоп/.test(text)) {
      if (/карман/.test(text)) addAlterationMatch(matches, category, 'Штопка под карманами');
      else addAlterationMatch(matches, category, 'Штопка (1 кв. см)');
    }
    if (/молни/.test(text)) addAlterationMatch(matches, category, 'Замена молнии с вмешательством в пояс');
    if (/баланс|шлев/.test(text)) addAlterationMatch(matches, category, 'Изменение баланса');
    if (/мешковин|карман/.test(text) && !/штоп/.test(text)) addAlterationMatch(matches, category, 'Замена мешковины кармана');
  }

  if (category === 'Сорочка / Блузка') {
    if (/рукав/.test(text) && /(длин|укорот|измен)/.test(text)) {
      if (/без\s+перенос|без\s+планк/.test(text)) addAlterationMatch(matches, category, 'Изменение длины рукава без переноса планки');
      else if (/перенос|планк/.test(text)) addAlterationMatch(matches, category, 'Изменение длины рукава с переносом планки');
      else questions.push('Скажите, рукав укорачиваем с переносом планки или без переноса?');
    }
    if (/(длин|укорот|подшить)/.test(text) && !/рукав/.test(text)) {
      if (/угол|боков/.test(text)) addAlterationMatch(matches, category, 'Изменение длины изделия с восст. уголков по боковым');
      else addAlterationMatch(matches, category, 'Изменение длины изделия');
    }
    if (/вытач/.test(text)) addAlterationMatch(matches, category, 'Ушить по вытачкам');
    if (/бок/.test(text) && /(уш|суз)/.test(text)) {
      if (/запаков/.test(text)) addAlterationMatch(matches, category, 'Ушить по боковым (запаковочный шов)');
      else if (/оверлок/.test(text)) addAlterationMatch(matches, category, 'Ушить по боковым под оверлок');
      else questions.push('Скажите, по боковым нужен запаковочный шов или обработка под оверлок?');
    }
    if (/рукав/.test(text) && /(уш|суз)/.test(text)) {
      if (/запаков|манжет/.test(text)) addAlterationMatch(matches, category, 'Ушить рукава (запаковочный шов) до манжеты');
      else if (/оверлок/.test(text)) addAlterationMatch(matches, category, 'Ушить рукава под оверлок');
      else questions.push('Скажите, рукава ушиваем запаковочным швом до манжеты или под оверлок?');
    }
    if (/пройм/.test(text)) {
      if (/запаков/.test(text)) addAlterationMatch(matches, category, 'Корректировка проймы (запаковочный шов)');
      else if (/оверлок/.test(text)) addAlterationMatch(matches, category, 'Корректировка проймы под оверлок');
      else questions.push('Скажите, пройму корректируем запаковочным швом или под оверлок?');
    }
    if (/баланс|кокет/.test(text)) addAlterationMatch(matches, category, 'Корректировка баланса');
  }

  if (category === 'Юбка') {
    if (/(длин|укорот|подшить)/.test(text)) {
      if (/полусолн|клин/.test(text)) unavailable.push('Стоимость этой работы нужно уточнить после осмотра.');
      else if (/без\s+шлиц/.test(text)) addAlterationMatch(matches, category, 'Изменение длины прямого силуэта без шлицы');
      else if (/со\s+шлиц|с\s+шлиц|шлиц/.test(text)) addAlterationMatch(matches, category, 'Изменение длины прямого силуэта со шлицей');
      else questions.push('Скажите, юбка со шлицей или без?');
    }
    if (/бок/.test(text) && /(уш|суз)/.test(text)) addAlterationMatch(matches, category, 'Ушить по боковым');
    if (/средн|молни/.test(text) && /(уш|суз|перенос)/.test(text)) addAlterationMatch(matches, category, 'Ушить по среднему с переносом молнии');
    if (/баланс/.test(text)) addAlterationMatch(matches, category, 'Корректировка баланса');
    if (/американ/.test(text)) addAlterationMatch(matches, category, 'Шов «американка»');
    if (/ролев/.test(text)) addAlterationMatch(matches, category, 'Ролевый шов');
  }

  if (category === 'Платье') {
    if (/бретел/.test(text) && /(длин|укорот|измен)/.test(text)) addAlterationMatch(matches, category, 'Изменение длины бретелей');
    if (/баланс|плечев/.test(text)) addAlterationMatch(matches, category, 'Изменение баланса с перекроем плечевого пояса');
    if (/пройм/.test(text)) addAlterationMatch(matches, category, 'Коррекция пройм');
    if (/тал/.test(text) && /молни|перенос|коррект/.test(text)) addAlterationMatch(matches, category, 'Корректировка линии талии с переносом молнии');
    if (/(бок|рельеф)/.test(text) && /(уш|суз)/.test(text)) addAlterationMatch(matches, category, 'Ушить по боковым или рельефам');
    if (/вытач/.test(text)) addAlterationMatch(matches, category, 'Ушить по вытачкам');
    if (/молни/.test(text)) addAlterationMatch(matches, category, 'Перенос / замена молнии');
    if (/рукав/.test(text) && /(уш|суз)/.test(text)) {
      if (/низ|длин|укорот/.test(text)) addAlterationMatch(matches, category, 'Ушить рукава с корректировкой низа');
      else addAlterationMatch(matches, category, 'Ушить длинные рукава без корректировки низа');
    }
    if (/подкладк/.test(text)) {
      if (/изготов|нов/.test(text)) addAlterationMatch(matches, category, 'Изготовить подкладку');
      else if (/длин|укорот|подшить/.test(text)) addAlterationMatch(matches, category, 'Изменение длины подкладки');
    }
    if (/(длин|укорот|подшить)/.test(text) && !/(бретел|подкладк|рукав)/.test(text)) {
      unavailable.push('Стоимость изменения длины платья нужно уточнить после осмотра.');
    }
  }

  if (category === 'Пуховики') {
    if (/рукав/.test(text) && /окат/.test(text)) addAlterationMatch(matches, category, 'Укоротить рукава через окат');
    else if (/рукав/.test(text) && /(укорот|длин|подшить)/.test(text)) addAlterationMatch(matches, category, 'Укоротить рукава по низу');
    if (/(длин|укорот|подшить|низ)/.test(text) && !/рукав/.test(text)) addAlterationMatch(matches, category, 'Укоротить длину');
    if (/(бок|рельеф)/.test(text) && /(уш|суз)/.test(text)) addAlterationMatch(matches, category, 'Ушить по боковым или рельефам');
    if (/средн/.test(text) && /(уш|суз)/.test(text)) addAlterationMatch(matches, category, 'Ушить по среднему шву');
  }

  if (category === 'Трикотаж') {
    if (/футболк/.test(text) && /(рукав|длин[а-я\s]+рукав)/.test(text)) addAlterationMatch(matches, category, 'Укоротить рукава на футболке');
    if (/футболк/.test(text) && /(укорот|длин|подшить)/.test(text)) {
      if (/разрез/.test(text)) addAlterationMatch(matches, category, 'Укоротить футболку с разрезами по бокам');
      else addAlterationMatch(matches, category, 'Укоротить футболку на распошиве');
    }
    if (/7\s*[–-]\s*10|7\s*10/.test(text)) addAlterationMatch(matches, category, 'Укоротить низ трикотаж 7–10 класс');
    if (/10\s*[–-]\s*14|10\s*14/.test(text)) addAlterationMatch(matches, category, 'Укоротить низ трикотаж 10–14 класс');
    if (/петля\s+в\s+петлю/.test(text) && !/7|10|14/.test(text)) questions.push('Скажите, класс вязки 7–10 или 10–14?');
  }

  if (category === 'Галантерея') {
    if (/отверсти|дыр|пробив/.test(text)) addAlterationMatch(matches, category, 'Пробивка отверстия в ремне');
    if (/укорот|укорачив|винтов/.test(text)) addAlterationMatch(matches, category, 'Укорачивание ремня с винтовым отверстием');
  }

  if (category === 'Дополнительно') {
    if (/глазков|петл/.test(text) && /изготов/.test(text)) addAlterationMatch(matches, category, 'Изготовление глазковой петли');
    if (/пуговиц/.test(text)) addAlterationMatch(matches, category, 'Пришить пуговицу');
    if (/кнопк/.test(text)) addAlterationMatch(matches, category, 'Поставить кнопку');
    if (/карман/.test(text)) addAlterationMatch(matches, category, 'Ремонт кармана');
    if (/молни/.test(text)) {
      if (/кант/.test(text) && /ветрозащит/.test(text)) addAlterationMatch(matches, category, 'Замена молнии с кантами на ветрозащитном клапане');
      else if (/без\s+ветрозащит/.test(text)) addAlterationMatch(matches, category, 'Замена молнии без ветрозащитного клапана');
      else if (/ветрозащит/.test(text)) addAlterationMatch(matches, category, 'Замена молнии на ветрозащитном клапане');
      else questions.push('Скажите, молния с ветрозащитным клапаном, с кантами на клапане или без клапана?');
    }
  }

  if (category !== 'Дополнительно' && /пуговиц|кнопк|глазков|ветрозащит|клапан/.test(text)) {
    const extra = matchAlterationWorks('Дополнительно', userText);
    matches.push(...extra.matches);
    questions.push(...extra.questions);
  }

  return {
    matches: dedupeAlterationEntries(matches),
    questions: Array.from(new Set(questions)),
    unavailable: Array.from(new Set(unavailable)),
  };
}

const ALTERATION_FINAL_MULTIPLIER = 1.1;

const ALTERATION_CATEGORY_NOMINATIVE = {
  'Пиджак': 'пиджак',
  'Брюки': 'брюки',
  'Джинсы': 'джинсы',
  'Сорочка / Блузка': 'сорочка или блузка',
  'Юбка': 'юбка',
  'Платье': 'платье',
  'Пуховики': 'пуховик',
  'Трикотаж': 'трикотажное изделие',
  'Галантерея': 'изделие',
  'Дополнительно': 'изделие',
};

const ALTERATION_CATEGORY_GENITIVE = {
  'Пиджак': 'пиджака',
  'Брюки': 'брюк',
  'Джинсы': 'джинсов',
  'Сорочка / Блузка': 'сорочки или блузки',
  'Юбка': 'юбки',
  'Платье': 'платья',
  'Пуховики': 'пуховика',
  'Трикотаж': 'трикотажного изделия',
  'Галантерея': 'изделия',
  'Дополнительно': 'изделия',
};

function formatRub(value) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function roundUpToHundred(value) {
  return Math.ceil(value / 100) * 100;
}

function calculateAlterationSubtotal(entries, liningState) {
  return entries.reduce((sum, entry) => {
    const liningAdd = liningState === 'yes' && isAlterationLiningApplicable(entry)
      ? entry.price * 0.5
      : 0;
    return sum + entry.price + liningAdd;
  }, 0);
}

function calculateAlterationTotal(entries, liningState) {
  return roundUpToHundred(calculateAlterationSubtotal(entries, liningState) * ALTERATION_FINAL_MULTIPLIER);
}

function getAlterationLiningQuestion(category) {
  const garment = ALTERATION_CATEGORY_NOMINATIVE[category] || 'изделие';
  return `Скажите, ${garment} с подкладкой или без?`;
}

function getAlterationLiningPhrase(entry, liningState) {
  if (!isAlterationLiningApplicable(entry)) return '';
  if (liningState === 'yes') return ' с подкладкой';
  if (liningState === 'no') return ' без подкладки';
  return '';
}

function getAlterationClientWorkName(entry, liningState) {
  const name = normalizeRuText(entry?.name || '');
  const genitive = ALTERATION_CATEGORY_GENITIVE[entry?.category] || 'изделия';
  const lining = getAlterationLiningPhrase(entry, liningState);

  if (/длина рукава|изменение длины рукава|укоротить рукава/.test(name)) return `Укорачивание рукава ${genitive}${lining}`;
  if (/изменение длины подкладки/.test(name)) return `Укорачивание подкладки ${genitive}`;
  if (/изменение длины|укоротить длину|укоротить футболку|укоротить низ/.test(name)) return `Укорачивание ${genitive}${lining}`;
  if (/ушить|расшить|расставить|изменить объем|изменить объём/.test(name)) return `Корректировка посадки ${genitive}${lining}`;
  if (/замена подкладки|изготовить подкладку/.test(name)) return `Замена подкладки ${genitive}`;
  if (/замена молнии|перенос \/ замена молнии/.test(name)) {
    return entry.category === 'Дополнительно' ? 'Замена молнии' : `Замена молнии ${genitive}`;
  }
  if (/ремонт кармана|мешковин/.test(name)) return `Ремонт кармана ${genitive}`;
  if (/штопка/.test(name)) return `Штопка ${genitive}`;
  if (/пробивка отверстия/.test(name)) return 'Пробивка отверстия';
  if (/укорачивание ремня/.test(name)) return 'Укорачивание ремня';
  if (/пришить пуговицу/.test(name)) return 'Пришивание пуговицы';
  if (/поставить кнопку/.test(name)) return 'Установка кнопки';
  if (/изготовление глазковой петли/.test(name)) return 'Изготовление глазковой петли';
  return `Корректировка ${genitive}${lining}`;
}

function renderAlterationQuote(category, entries, liningState, unavailable = []) {
  const total = calculateAlterationTotal(entries, liningState);
  const subject = entries.length === 1
    ? getAlterationClientWorkName(entries[0], liningState)
    : 'Выбранные работы';
  const lines = [
    `${subject} стоит от ${formatRub(total)} руб.`,
    'Запишитесь на консультацию для точной оценки.',
  ];
  if (unavailable.length > 0) {
    lines.push('По дополнительным работам стоимость нужно уточнить после осмотра изделия.');
  }
  return lines.join(' ');
}

function renderAlterationUnavailable() {
  return 'По этой работе стоимость нужно уточнить после осмотра изделия. Запишитесь на консультацию для точной оценки.';
}

function renderAlterationWorkQuestion(category) {
  const garment = ALTERATION_CATEGORY_GENITIVE[category] || 'изделия';
  return `Скажите, какую корректировку нужно выполнить для ${garment}?`;
}

function shouldAskIntentBeforeTailoring(userText, assistantText, hasAnyImage, lockedAssistantContext) {
  if (lockedAssistantContext || hasAnyImage) return false;
  if (hasTailoringIntent(userText) || hasAlterationIntent(userText, assistantText)) return false;
  const category = detectAlterationCategory(userText, '');
  return typeof category === 'string' && category !== 'Дополнительно';
}

function buildAlterationPhotoPrompt() {
  return `Ты — классификатор корректировок ателье. Работай только с утвержденным каталогом ниже.

${ALTERATION_APPROVED_PRICE_DATA}

Задача: по фото и тексту определить категорию изделия и возможные работы корректировки.
Не придумывай работы и цены вне утвержденного каталога.
Если важная деталь не видна или неясна (подкладка, шлица, манжета, перенос петель, фабричный шов, ветрозащитный клапан), верни вопрос в missing_questions.

Ответ строго JSON:
{
  "category": "Пиджак|Брюки|Джинсы|Сорочка / Блузка|Юбка|Платье|Пуховики|Дополнительно|Трикотаж|Галантерея|null",
  "work_names": ["точные названия работ из утвержденного каталога"],
  "missing_questions": ["короткий вопрос клиенту"],
  "analysis": "кратко что видно"
}`;
}

async function runAlterationPhotoAnalysis(provider, model, currentSessionMessages) {
  if (!provider || !model) return null;

  const options = {
    temperature: 0,
    max_tokens: 700,
  };
  if (provider === 'openai') options.response_format = { type: 'json_object' };

  const result = await callLLM(provider, model, [
    { role: 'system', content: buildAlterationPhotoPrompt() },
    ...currentSessionMessages,
  ], options);

  if (result.error || !result.content) return null;

  try {
    return JSON.parse(result.content);
  } catch (err) {
    console.error('[AlterationPhoto] Failed to parse JSON:', result.content);
    return null;
  }
}

async function handleAlterationFlow({
  allUserTexts,
  userTextParts,
  latestUserText,
  latestAssistantText,
  allAssistantTexts,
  assistantContext,
  hasAnyImage,
  currentSessionMessages,
  provider,
  model,
}) {
  if (!hasAlterationIntent(allUserTexts, allAssistantTexts, assistantContext)) return null;

  let photoAnalysis = null;
  if (hasAnyImage) {
    photoAnalysis = await runAlterationPhotoAnalysis(provider, model, currentSessionMessages);
  }

  let categoryResult = detectAlterationCategory(
    allUserTexts,
    '',
    photoAnalysis?.category || ''
  );

  if (categoryResult && typeof categoryResult === 'object' && categoryResult.ambiguous) {
    const selectedCategory = resolveAlterationCategorySelection(categoryResult.ambiguous, latestUserText)
      || resolveAlterationCategorySelection(categoryResult.ambiguous, latestAssistantText, { allowExclusion: false });
    if (selectedCategory) {
      categoryResult = selectedCategory;
    } else {
      const garmentList = categoryResult.ambiguous
        .map((item) => ALTERATION_CATEGORY_NOMINATIVE[item] || item.toLowerCase())
        .join(', ');
      return {
        reply: `Вы указали несколько изделий: ${garmentList}. Скажите, по какому изделию рассчитать корректировку?`,
      };
    }
  }

  const category = categoryResult;
  if (!category) {
    if (hasAnyImage && !photoAnalysis) {
      return {
        reply: 'Скажите, какое это изделие и какую корректировку нужно выполнить?',
      };
    }
    return {
      reply: 'Скажите, какое изделие нужно скорректировать?',
    };
  }

  const photoWorkNames = Array.isArray(photoAnalysis?.work_names) ? photoAnalysis.work_names : [];
  const workText = extractAlterationWorkTextForCategory(category, allUserTexts, latestUserText, userTextParts);
  const matched = matchAlterationWorks(category, workText, photoWorkNames);
  if (photoAnalysis?.missing_questions?.length && matched.matches.length === 0) {
    return { reply: photoAnalysis.missing_questions[0] };
  }

  if (matched.questions.length > 0 && matched.matches.length === 0) {
    return { reply: matched.questions[0] };
  }

  if (matched.matches.length === 0) {
    if (getAlterationKnownWorkSignal(workText) || matched.unavailable.length > 0) {
      return { reply: renderAlterationUnavailable(category, workText, matched.unavailable) };
    }
    return { reply: renderAlterationWorkQuestion(category) };
  }

  if (matched.questions.length > 0) {
    return { reply: matched.questions[0] };
  }

  const liningState = getAlterationLiningStateFromContext(workText, latestUserText, latestAssistantText);
  const needsLiningAnswer = matched.matches.some(isAlterationLiningApplicable);
  if (needsLiningAnswer && liningState === 'unknown') {
    return { reply: getAlterationLiningQuestion(category) };
  }

  return {
    reply: renderAlterationQuote(category, matched.matches, liningState, matched.unavailable),
  };
}

const SPEC_LOOKUP = {
  'топ': 'СПЕЦ_ТОП',
  'корсет': 'СПЕЦ_КОРСЕТ',
  'полукорсет (бельевой)': 'СПЕЦ_ПОЛУКОРСЕТ',
  'блуза': 'СПЕЦ_БЛУЗА',
  'сорочка (рубашка)': 'СПЕЦ_РУБАШКА',
  'сорочка мужская': 'СПЕЦ_СОРОЧКА_МУЖСКАЯ',
  'платье футляр без рукава': 'СПЕЦ_ПЛАТЬЕ_ФУТЛЯР',
  'платье прямое с рукавом': 'СПЕЦ_ПЛАТЬЕ_ПРЯМОЕ',
  'платье с отрезной талией': 'СПЕЦ_ПЛАТЬЕ_ОТРЕЗНОЕ',
  'платье вечернее(свадебное)': 'СПЕЦ_ПЛАТЬЕ_ВЕЧЕРНЕЕ',
  'юбка прямая до колена': 'СПЕЦ_ЮБКА_ПРЯМАЯ',
  'юбка по косой': 'СПЕЦ_ЮБКА_ПО_КОСОЙ',
  'брюки женские два кармана': 'СПЕЦ_БРЮКИ_ЖЕНСКИЕ',
  'классические брюки': 'СПЕЦ_БРЮКИ_КЛАССИЧЕСКИЕ',
  'брюки спорт': 'СПЕЦ_БРЮКИ_СПОРТ',
  'джинсы': 'СПЕЦ_ДЖИНСЫ',
  'жилет': 'СПЕЦ_ЖИЛЕТ',
  'жакет шанель на органзе': 'СПЕЦ_ЖАКЕТ_ШАНЕЛЬ',
  'жакет': 'СПЕЦ_ЖАКЕТ',
  'пиджак мужской кежуал': 'СПЕЦ_ПИДЖАК_КЕЖУАЛ',
  'пиджак мужской классический': 'СПЕЦ_ПИДЖАК_BESPOKE',
  'пальто': 'СПЕЦ_ПАЛЬТО',
  'пальто зимнее': 'СПЕЦ_ПАЛЬТО_ЗИМНЕЕ',
  'плащ': 'СПЕЦ_ПЛАЩ',
  'куртка без подкладки': 'СПЕЦ_КУРТКА',
  'куртка на меховой подкладке короткая': 'СПЕЦ_КУРТКА',
  'бомбер мужской без подкладки': 'СПЕЦ_БОМБЕР',
  'парка без подкладки': 'СПЕЦ_ПАРКА',
  'жилет пуховой (короткий)': 'СПЕЦ_ЖИЛЕТ_ПУХОВОЙ',
  'пуховик короткий': 'СПЕЦ_ПУХОВИК',
  'пуховик длинный': 'СПЕЦ_ПУХОВИК',
  'дубленка короткая': 'СПЕЦ_ДУБЛЕНКА',
  'лонгслив трикотажный': 'СПЕЦ_ЛОНГСЛИВ',
  'худи с капюшеном': 'СПЕЦ_ХУДИ',
  'свитшот трикотажный': 'СПЕЦ_СВИТШОТ',
  'футболка': 'СПЕЦ_ФУТБОЛКА',
  'бейсболка': 'СПЕЦ_БЕЙСБОЛКА',
};

function getScriptForCategory(scriptCategory) {
  const scriptSection = SECTIONS['СКРИПТ_БОТА'] || '';
  const lines = scriptSection.split('\n');
  const header = lines.find(l => /Категория\s*\|\s*Шаг/i.test(l));
  const filtered = lines.filter(l => {
    const trimmed = l.trim();
    if (!trimmed || trimmed.startsWith('===') || /Категория\s*\|\s*Шаг/i.test(trimmed)) return false;
    return trimmed.startsWith(scriptCategory + ' |') || trimmed.startsWith(scriptCategory + '|');
  });
  if (filtered.length === 0) return '';
  return `=== СКРИПТ_БОТА ===\n${header ? header + '\n' : ''}${filtered.join('\n')}`;
}

const SCRIPT_CATEGORY_LOOKUP = {
  'топ': 'ТОПЫ',
  'корсет': null,
  'полукорсет (бельевой)': null,
  'блуза': 'РУБАШКИ',
  'сорочка (рубашка)': 'РУБАШКИ',
  'сорочка мужская': 'РУБАШКИ',
  'платье футляр без рукава': 'ПЛАТЬЯ',
  'платье прямое с рукавом': 'ПЛАТЬЯ',
  'платье с отрезной талией': 'ПЛАТЬЯ',
  'платье вечернее(свадебное)': 'ПЛАТЬЯ',
  'юбка прямая до колена': 'ЮБКИ',
  'юбка по косой': 'ЮБКИ',
  'брюки женские два кармана': 'БРЮКИ',
  'классические брюки': 'БРЮКИ',
  'брюки спорт': 'БРЮКИ',
  'джинсы': 'БРЮКИ',
  'жилет': 'ЖАКЕТЫ',
  'жакет шанель на органзе': 'ЖАКЕТЫ',
  'жакет': 'ЖАКЕТЫ',
  'пиджак мужской кежуал': 'ЖАКЕТЫ',
  'пиджак мужской классический': 'ЖАКЕТЫ',
  'куртка без подкладки': 'КУРТКА',
  'куртка на меховой подкладке короткая': 'КУРТКА',
  'бомбер мужской без подкладки': 'БОМБЕР',
  'парка без подкладки': 'ПАРКА',
  'пальто': 'ПАЛЬТО',
  'пальто зимнее': 'ПАЛЬТО',
  'плащ': 'ПЛАЩ',
  'жилет пуховой (короткий)': 'ЖИЛЕТ_ПУХОВОЙ',
  'пуховик короткий': 'ПУХОВИК',
  'пуховик длинный': 'ПУХОВИК',
  'дубленка короткая': 'ДУБЛЕНКА',
  'лонгслив трикотажный': 'ТРИКОТАЖ',
  'худи с капюшеном': 'ТРИКОТАЖ',
  'свитшот трикотажный': 'ТРИКОТАЖ',
  'футболка': 'ТРИКОТАЖ',
  'бейсболка': null,
};

const FINAL_ASSISTANT_PAGE_CONTEXTS = new Map([
  ...womenFinalPagesMatrix.flatMap((group) =>
    group.pages.map((page) => [page.route, {
      route: page.route,
      title: page.title,
      baseName: page.baseName,
      basePrice: page.priceFrom,
      category: SCRIPT_CATEGORY_LOOKUP[page.baseName.toLowerCase().trim()] || null,
      lockBase: true,
    }])
  ),
  ...menFinalPagesMatrix.map((page) => [page.route, {
    route: page.route,
    title: page.title,
    baseName: page.baseName,
    basePrice: page.priceFrom,
    category: SCRIPT_CATEGORY_LOOKUP[page.baseName.toLowerCase().trim()] || null,
    lockBase: true,
  }]),
]);

function normalizeAssistantRoute(route) {
  if (typeof route !== 'string') return '';
  try {
    const parsed = new URL(route, 'http://localhost');
    return parsed.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return route.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  }
}

function resolveLockedAssistantContext(assistantContext) {
  if (!assistantContext || assistantContext.lockBase !== true) return null;
  const route = normalizeAssistantRoute(assistantContext.route);
  const pageContext = FINAL_ASSISTANT_PAGE_CONTEXTS.get(route);
  if (!pageContext || !pageContext.baseName || !pageContext.basePrice || !pageContext.category) return null;

  return {
    ...pageContext,
    classification: {
      base_determined: true,
      base_name: pageContext.baseName,
      base_price: pageContext.basePrice,
      category: pageContext.category,
      question: null,
      analysis: `Основа зафиксирована серверным контекстом страницы "${pageContext.title}". Не выбирать основу заново.`,
    },
  };
}

const APPLICABILITY_LOOKUP = {
  'топ': 'ПРИМЕНИМОСТЬ_ТОПЫ',
  'корсет': null,
  'полукорсет (бельевой)': null,
  'блуза': 'ПРИМЕНИМОСТЬ_РУБАШКИ',
  'сорочка (рубашка)': 'ПРИМЕНИМОСТЬ_РУБАШКИ',
  'сорочка мужская': 'ПРИМЕНИМОСТЬ_РУБАШКИ',
  'платье футляр без рукава': 'ПРИМЕНИМОСТЬ_ПЛАТЬЯ',
  'платье прямое с рукавом': 'ПРИМЕНИМОСТЬ_ПЛАТЬЯ',
  'платье с отрезной талией': 'ПРИМЕНИМОСТЬ_ПЛАТЬЯ',
  'платье вечернее(свадебное)': 'ПРИМЕНИМОСТЬ_ПЛАТЬЯ',
  'юбка прямая до колена': 'ПРИМЕНИМОСТЬ_ЮБКИ',
  'юбка по косой': 'ПРИМЕНИМОСТЬ_ЮБКИ',
  'брюки женские два кармана': 'ПРИМЕНИМОСТЬ_БРЮКИ',
  'классические брюки': 'ПРИМЕНИМОСТЬ_БРЮКИ',
  'брюки спорт': 'ПРИМЕНИМОСТЬ_БРЮКИ',
  'джинсы': 'ПРИМЕНИМОСТЬ_БРЮКИ',
  'жилет': 'ПРИМЕНИМОСТЬ_ЖАКЕТЫ',
  'жакет шанель на органзе': 'ПРИМЕНИМОСТЬ_ЖАКЕТЫ',
  'жакет': 'ПРИМЕНИМОСТЬ_ЖАКЕТЫ',
  'пиджак мужской кежуал': 'ПРИМЕНИМОСТЬ_ЖАКЕТЫ',
  'пиджак мужской классический': 'ПРИМЕНИМОСТЬ_ЖАКЕТЫ',
  'куртка без подкладки': 'ПРИМЕНИМОСТЬ_КУРТКА',
  'куртка на меховой подкладке короткая': 'ПРИМЕНИМОСТЬ_КУРТКА',
  'бомбер мужской без подкладки': 'ПРИМЕНИМОСТЬ_БОМБЕР',
  'парка без подкладки': 'ПРИМЕНИМОСТЬ_ПАРКА',
  'пальто': 'ПРИМЕНИМОСТЬ_ПАЛЬТО',
  'пальто зимнее': 'ПРИМЕНИМОСТЬ_ПАЛЬТО',
  'плащ': 'ПРИМЕНИМОСТЬ_ПЛАЩ',
  'жилет пуховой (короткий)': 'ПРИМЕНИМОСТЬ_ЖИЛЕТ_ПУХОВОЙ',
  'пуховик короткий': 'ПРИМЕНИМОСТЬ_ПУХОВИК',
  'пуховик длинный': 'ПРИМЕНИМОСТЬ_ПУХОВИК',
  'дубленка короткая': 'ПРИМЕНИМОСТЬ_ДУБЛЕНКА',
  'лонгслив трикотажный': 'ПРИМЕНИМОСТЬ_ТРИКОТАЖ',
  'худи с капюшеном': 'ПРИМЕНИМОСТЬ_ТРИКОТАЖ',
  'свитшот трикотажный': 'ПРИМЕНИМОСТЬ_ТРИКОТАЖ',
  'футболка': 'ПРИМЕНИМОСТЬ_ТРИКОТАЖ',
  'бейсболка': null,
};

function buildPhase2PriceData(baseName, category, applicableCodes) {
  const parts = [];
  if (SECTIONS['ДРАЙВЕРЫ']) {
    if (applicableCodes && applicableCodes.size > 0) {
      // Фильтруем ДРАЙВЕРЫ — оставляем только применимые к данной основе
      const driverLines = SECTIONS['ДРАЙВЕРЫ'].split('\n');
      const filtered = driverLines.filter(line => {
        const code = line.split('|')[0]?.trim();
        if (!code || code === 'Код') return true; // header
        return applicableCodes.has(code);
      });
      parts.push(filtered.join('\n'));
    } else {
      parts.push(SECTIONS['ДРАЙВЕРЫ']);
    }
  }
  const specKey = SPEC_LOOKUP[baseName.toLowerCase().trim()];
  if (specKey && SECTIONS[specKey]) parts.push(SECTIONS[specKey]);
  const appKey = APPLICABILITY_LOOKUP[baseName.toLowerCase().trim()];
  if (appKey && SECTIONS[appKey]) parts.push(SECTIONS[appKey]);
  const scriptCat = SCRIPT_CATEGORY_LOOKUP[baseName.toLowerCase().trim()] || category;
  if (scriptCat) {
    const script = getScriptForCategory(scriptCat);
    if (script) parts.push(script);
  }
  return parts.join('\n\n');
}

// === Phase 1: Base Detection Prompt ===
const BASE_DETECTION_PROMPT = `Ты — классификатор изделий «Ателье 15/13».

КРИТИЧЕСКОЕ ПРАВИЛО: Если изделие — ПИДЖАК (любой), и клиент НЕ написал в тексте слова «кежуал», «повседневный», «под джинсы», «классический» или «костюмный» — ты ОБЯЗАН вернуть base_determined = false и спросить тип. НЕ определяй тип пиджака по фото. Только явное текстовое указание клиента считается.

${SECTIONS['БАЗА_ИЗДЕЛИЙ']}

ТВОЯ ЗАДАЧА: определи, какая ОДНА строка из таблицы БАЗА_ИЗДЕЛИЙ соответствует изделию клиента.
Анализируй ВСЮ историю переписки (фото + текст + предыдущие ответы клиента).

ВАЖНО: тебя интересует ТОЛЬКО выбор строки из БАЗА_ИЗДЕЛИЙ. НЕ задавай вопросы про подкладку (кроме правила дублёнки ниже), силуэт, стиль, детали, фасон, карманы, материал — это НЕ влияет на выбор базовой основы. Подкладка, карманы, ткань и прочее — это ДРАЙВЕРЫ, они учитываются позже на этапе расчёта.

ПРАВИЛО КОЖАНОЙ КУРТКИ С МЕХОМ (только для куртки, НЕ для бомбера/парки/пальто/пиджака):
Если на фото или в тексте кожаная/замшевая КУРТКА с мехом — нужно определить ТИП конструкции:

А) ДУБЛЁНКА КОРОТКАЯ (80 000, category = ДУБЛЕНКА) — shearling:
   ВИЗУАЛЬНЫЕ ПРИЗНАКИ:
   - Внешний слой — ЗАМША или наппа (матовая, бархатистая поверхность)
   - Мех — ЧАСТЬ материала (не отдельная подкладка), виден на воротнике, манжетах, швах, по краям
   - Видны срезы меха по краям изделия (не закрыты тканью)
   - Толщина и плотность выше → изделие выглядит «тяжелее», массивнее
   - Натуральная, слегка «грубая» эстетика
   БЫСТРЫЙ ТЕСТ: замша + открытый мех по краям → ДУБЛЁНКА

Б) КУРТКА НА МЕХОВОЙ ПОДКЛАДКЕ (150 000, category = ДУБЛЕНКА):
   ВИЗУАЛЬНЫЕ ПРИЗНАКИ:
   - Внешний слой — ТКАНЬ или ГЛАДКАЯ КОЖА (плотная, но НЕ замшевая)
   - Мех ВНУТРИ как отдельная подкладка (часто съемная)
   - Снаружи мех почти НЕ виден (иногда только в капюшоне/вороте)
   - Конструкция легче и тоньше, чем дублёнка
   - Более «городской», функциональный вид
   БЫСТРЫЙ ТЕСТ: обычная куртка снаружи, мех только внутри → КУРТКА НА МЕХЕ

КАК ОПРЕДЕЛЯТЬ:
- По ФОТО: применяй «быстрый тест» выше.
  → Видишь замшу/наппу + открытый мех по краям/воротнику/манжетам → ДУБЛЁНКА (80 000). base_determined = true.
  → Видишь гладкую кожу или ткань снаружи, мех не виден или только в вороте → КУРТКА НА МЕХЕ (150 000). base_determined = true.
  → Если маркеры неоднозначны (фото нечёткое, виден только один ракурс, непонятно замша или гладкая кожа) → base_determined = false, спроси: «Подскажите, это классическая дублёнка из овчины (замша снаружи, мех внутри — часть той же шкуры) или кожаная куртка с отдельной меховой подкладкой?»
- По ТЕКСТУ (без фото): если клиент говорит про кожаную куртку + мех без уточнения → base_determined = false, спроси тот же вопрос.
- Если клиент сказал «дублёнка» → дублёнка короткая (80 000). Если клиент сказал «куртка с меховой подкладкой» или «кожаная куртка с мехом» → куртка на меховой подкладке (150 000).
- Если подкладка обычная (не мех) → куртка без подкладки (40 000), category = КУРТКА.
Для бомбера, парки, пальто, пуховика и других изделий подкладка НЕ влияет на выбор основы (это драйвер, решается на этапе расчёта).

ПРАВИЛА ОПРЕДЕЛЕНИЯ ОСНОВЫ:
- «куртка» без уточнений → куртка без подкладки (40 000), category = КУРТКА. base_determined = true.
- «бомбер» → бомбер мужской без подкладки (35 000), category = БОМБЕР. base_determined = true.
- «парка» → парка без подкладки (48 000), category = ПАРКА. base_determined = true.
- ЖАКЕТ (НЕ пиджак) → жакет (48 000), category = ЖАКЕТЫ. base_determined = true. Жакет — это отдельная позиция. НЕ спрашивай тип (кежуал/классический) — это правило ТОЛЬКО для пиджаков. Если клиент написал «жакет» или на фото женский жакет — сразу определяй как «жакет» (48 000).
- ПИДЖАК — ОСОБОЕ ПРАВИЛО: если на фото или в запросе пиджак, ты ОБЯЗАН спросить у клиента тип, даже если по фото тебе кажется очевидным. НЕ определяй тип пиджака самостоятельно по фото. Только если клиент САМ ЯВНО НАПИСАЛ в тексте сообщения «кежуал», «повседневный», «под джинсы», «классический», «костюмный» — тогда используй его ответ. Если клиент просто прислал фото пиджака или написал «пиджак» / «посчитай пиджак» без указания типа → base_determined = false, задай вопрос: «Подскажите, вы хотите костюмный классический пиджак или кежуал — повседневный, под джинсы и т.д.?»
- «пиджак кежуал» или «повседневный пиджак» или «пиджак под джинсы» (клиент сам написал) → пиджак мужской кежуал (65 000), category = ЖАКЕТЫ. base_determined = true.
- «пиджак классический» или «костюмный пиджак» или «классический мужской костюм» (клиент сам написал) → пиджак мужской классический (120 000), category = ЖАКЕТЫ. base_determined = true.
- «пальто» без указания на зимнее → пальто (52 000), category = ПАЛЬТО. base_determined = true.
- «пальто зимнее» или «тёплое пальто» → пальто зимнее (125 000), category = ПАЛЬТО. base_determined = true.

ПРАВИЛА ОПРЕДЕЛЕНИЯ ВЕРХНЕЙ ОДЕЖДЫ (обязательно проверяй по этим признакам):
  Если на фото или в тексте верхняя одежда — определи тип по ключевым признакам:
  1) ЖИЛЕТ ПУХОВОЙ (40 000, ЖИЛЕТ_ПУХОВОЙ) — БЕЗ рукавов, утеплённый/стёганый, дутый. Ключевой признак: отсутствие рукавов + утепление (стёжка, объём от наполнителя). НЕ путай с обычным жилетом (24 000, ЖАКЕТЫ) — тот тонкий, костюмный, без утепления.
  2) ПУХОВИК КОРОТКИЙ (65 000, ПУХОВИК) — С рукавами, утеплённый/стёганый, длина до бедра. Ключевой признак: рукава + утепление + короткая длина.
  3) ПУХОВИК ДЛИННЫЙ (85 000, ПУХОВИК) — С рукавами, утеплённый/стёганый, длина ниже колена или в пол.
  4) КУРТКА (40 000, КУРТКА) — С рукавами, НЕ утеплённая (нет стёжки/наполнителя), лёгкая. Тонкая ткань, ветровка, джинсовка.
  5) БОМБЕР (35 000, БОМБЕР) — Характерный крой: резинка на поясе и манжетах, круглый вырез/воротник-стойка, застёжка на молнии.
  6) ПАРКА (48 000, ПАРКА) — Удлинённая куртка с капюшоном, карманами, часто с кулиской на талии.
  7) ПАЛЬТО (52 000, ПАЛЬТО) — Из плотной ткани (шерсть, кашемир, драп), НЕ утеплённое стёжкой. Классический крой.
  8) ПАЛЬТО ЗИМНЕЕ (125 000, ПАЛЬТО) — Пальто с явным утеплением, зимнее.
  9) ПЛАЩ (45 000, ПЛАЩ) — Лёгкое изделие из водоотталкивающей/тонкой ткани, длина до колена или ниже, часто с поясом. Тренч.
  10) ДУБЛЕНКА (80 000, ДУБЛЕНКА) — Shearling. Внешний слой — ЗАМША/наппа (матовая, бархатистая). Мех — часть материала, виден по краям, на воротнике, манжетах. Изделие массивное, «тяжёлое». Быстрый тест: замша + открытый мех по краям → дублёнка.
  11) КУРТКА НА МЕХОВОЙ ПОДКЛАДКЕ (150 000, ДУБЛЕНКА) — Внешний слой — ТКАНЬ или ГЛАДКАЯ КОЖА (не замша). Мех внутри как отдельная подкладка, снаружи почти не виден. Конструкция легче. Быстрый тест: обычная куртка снаружи, мех только внутри → куртка на мехе.
  ВАЖНО для п.10 и п.11: Если по фото визуальные маркеры неоднозначны (непонятно замша или гладкая кожа, нечёткое фото) → спроси клиента (base_determined = false). Если маркеры чёткие — определяй по «быстрому тесту».
  
  КРИТИЧНО: НЕ путай плащ и жилет. Плащ — это ТОНКОЕ изделие С РУКАВАМИ. Жилет — БЕЗ рукавов. Если на фото нет рукавов и есть утепление — это ЖИЛЕТ ПУХОВОЙ, НЕ плащ.

- «платье» → определи тип по признакам ниже. Если тип ясен → base_determined = true. Если сомневаешься между двумя — задай вопрос ТОЛЬКО между этими двумя вариантами, не перечисляй все четыре.

ПРАВИЛА ОПРЕДЕЛЕНИЯ ТИПА ПЛАТЬЯ (проверяй в этом порядке):
  А) «платье вечернее(свадебное)» (80 000, ПЛАТЬЯ) — платье ИСКЛЮЧИТЕЛЬНО для мероприятий (свадьба, выпускной, гала, торжество), непригодное для повседневной носки.
     ОБЯЗАТЕЛЬНО 3+ признака из списка: корсетный верх; шлейф; многослойность (2+ слоя ткани); открытая спина / глубокое декольте; ОБИЛЬНЫЙ декор (стразы, пайетки по всему изделию, сплошная вышивка — НЕ считай частичную вышивку на рукавах или подоле); нарядные ткани (атлас, органза, тюль — но НЕ просто шёлк сам по себе); свадебное платье.
     АНТИ-ПРИЗНАКИ (если хотя бы один → НЕ вечернее, проверяй Б/В/Г):
       — повседневная ткань: хлопок, лён, вискоза, трикотаж, деним
       — прямой/свободный силуэт без корсета
       — отсутствие декора или минимальный декор
       — рубашечный/воротник-стойка
     Длина макси САМА ПО СЕБЕ — НЕ признак вечернего платья. Макси бывает и у повседневных платьев.
     Если НЕ набралось 3 признака ИЛИ есть анти-признак → это НЕ вечернее, проверяй правила Б/В/Г.
  Б) «платье с отрезной талией» (35 000, ПЛАТЬЯ) — виден ГОРИЗОНТАЛЬНЫЙ ШОВ на линии талии, платье чётко делится на лиф (верх) и юбку (низ). Также: пояс на талии, визуальное разделение верха и низа.
     Ключевой признак: отчётливая линия соединения лифа и юбки на талии. base_determined = true.
  В) «платье прямое с рукавом» (30 000, ПЛАТЬЯ) — прямой свободный силуэт (не облегает фигуру), ЕСТЬ рукава (любой длины).
     Ключевой признак: рукава + свободный/прямой крой. base_determined = true.
  Г) «платье футляр без рукава» (25 000, ПЛАТЬЯ) — облегающий/полуприлегающий силуэт, БЕЗ рукавов, длина до колена.
     Ключевой признак: нет рукавов + облегает фигуру. base_determined = true.
  Приоритет проверки: сначала А, потом Б, потом В, потом Г.
  Если сомневаешься — спроси КОНКРЕТНО между 2 вариантами, например: «Подскажите, это платье для особых мероприятий или для повседневной носки?»

- Если описание клиента однозначно соответствует одной строке → base_determined = true.
- Если есть два возможных варианта — задай ОДИН вопрос, который разрешит неоднозначность между ними.

ОТВЕТЬ строго в формате JSON (и ТОЛЬКО JSON, без текста вне JSON):
{
  "base_determined": true или false,
  "base_name": "точное название из столбца Изделие в БАЗА_ИЗДЕЛИЙ" или null,
  "base_price": число БЕЗ пробелов (например 80000, не "80 000") или null,
  "category": "КУРТКА|БОМБЕР|ПАРКА|ЖИЛЕТ_ПУХОВОЙ|ПУХОВИК|ПАЛЬТО|ПЛАЩ|ДУБЛЕНКА|ЖАКЕТЫ|БРЮКИ|РУБАШКИ|ПЛАТЬЯ|ЮБКИ|ТРИКОТАЖ|ТОПЫ" или null,
  "question": "вопрос клиенту (прямое обращение на «вы», как в диалоге, БЕЗ описания от третьего лица)" или null,
  "analysis": "краткий внутренний анализ (НЕ показывается клиенту)"
}

КРИТИЧНО для question: формулируй вопрос как ПРЯМОЕ обращение к клиенту в диалоге. 
НЕЛЬЗЯ: «Клиент хочет пошить жакет, но не указал тип».
ПРАВИЛЬНО: «Подскажите, вы хотите костюмный классический пиджак или кежуал — повседневный, под джинсы и т.д.?»
Обращение на «вы», вежливо, лаконично. Только русский язык.`;

// === СПРАВОЧНИК ДРАЙВЕРОВ для серверного расчёта ===
const DRIVERS_TABLE = {
  PODKLADKA:           { type: 'percent', value: 50, label: 'подкладка' },
  RISUNOK:             { type: 'percent', value: 20, label: 'ткань клетка/полоска/крупный рисунок' },
  BELAYA:              { type: 'percent', value: 20, label: 'белая ткань' },
  PAYETKI:             { type: 'percent', value: 50, label: 'пайетки/бисер' },
  SLOZHNAYA_TKAN:      { type: 'percent', value: 30, label: 'шифон/бархат/велюр/кружево' },
  KOZHA_MEH:           { type: 'percent', value: 100, label: 'кожа/мех' },
  RELYEFY:             { type: 'percent', value: 15, label: 'дополнительные рельефы' },
  REGLAN:              { type: 'percent', value: 20, label: 'рукав реглан' },
  OTREZNAYA_TALIYA:    { type: 'percent', value: 10, label: 'отрезная талия' },
  KAPYUSHON:           { type: 'fixed', value: 5000, label: 'капюшон' },
  SLOZHNY_VOROTNIK:    { type: 'fixed', value: 7000, label: 'сложный воротник' },
  SUPAT:               { type: 'fixed', value: 4000, label: 'супатная застежка' },
  DOP_KARMAN:          { type: 'per_unit', value: 2000, label: 'дополнительные карманы' },
  OTDELOCHNYE_STROCHKI:{ type: 'percent', value: 5, label: 'отделочные строчки' },
  DABL:                { type: 'percent', value: 50, label: 'ткань дабл' },
  MANZHETY_SHLITSY:    { type: 'fixed', value: 3000, label: 'манжеты/шлицы' },
  POYAS:               { type: 'fixed', value: 4000, label: 'пояс' },
  DEKOR_ELEM:          { type: 'fixed', value: 1000, label: 'декоративные элементы' },
  RAZMER56:            { type: 'percent', value: 20, label: 'размер свыше 56' },
  POGONY_PATY:         { type: 'per_unit', value: 500, label: 'погоны/паты' },
  DLINNOE:             { type: 'percent', value: 25, label: 'длинное изделие' },
  MEH_VOROT_OTL:       { type: 'fixed', value: 8000, label: 'меховой воротник отложной' },
  MEH_VOROT_ANGL:      { type: 'fixed', value: 15000, label: 'меховой воротник английский' },
  MEH_MANZHETY:        { type: 'fixed', value: 10000, label: 'манжеты меховые' },
  USLOZHNENNY_KROY:    { type: 'percent', value: 50, label: 'усложненный крой' },
  SHLITSA:             { type: 'fixed', value: 3000, label: 'шлица/разрез' },
};

// === Универсальная функция: какие драйверы УЖЕ включены в базовую цену ===
function getBaseExcludedDrivers(baseName) {
  const excluded = new Set();
  const lower = baseName.toLowerCase();

  // Дублёнка: кожа + мех + подкладка — всё в одной шкуре
  if (lower.includes('дубленк') || lower.includes('дублёнк')) {
    excluded.add('KOZHA_MEH');
    excluded.add('PODKLADKA');
    excluded.add('MEH_VOROT_OTL'); // воротник из той же овчины
  }

  // Куртка на меховой подкладке: кожа + подкладка в базе
  if (lower.includes('меховой подкладке')) {
    excluded.add('KOZHA_MEH');
    excluded.add('PODKLADKA');
  }

  // Классические изделия — подкладка уже в базе
  if (lower.includes('классическ')) {
    excluded.add('PODKLADKA');
  }

  // Жакет Шанель на органзе — подкладка в базе
  if (lower.includes('шанель')) {
    excluded.add('PODKLADKA');
  }

  // Длина в названии → DLINNOE уже в базе
  if (lower.includes('длинн') || lower.includes('макси')) {
    excluded.add('DLINNOE');
  }

  // Капюшон в названии → KAPYUSHON уже в базе
  if (lower.includes('капюшон') || lower.includes('капюшен')) {
    excluded.add('KAPYUSHON');
  }

  // Отрезная талия в названии → OTREZNAYA_TALIYA уже в базе
  if (lower.includes('отрезн')) {
    excluded.add('OTREZNAYA_TALIYA');
  }

  return excluded;
}

// === Серверный расчёт цены по списку драйверов ===
const FINAL_PRICE_MULTIPLIER = 1.1;

function calculatePrice(basePrice, appliedDrivers) {
  let total = basePrice;
  const details = [];

  for (const d of appliedDrivers) {
    const driver = DRIVERS_TABLE[d.code];
    if (!driver) continue;

    if (driver.type === 'percent') {
      const add = Math.round(basePrice * driver.value / 100);
      total += add;
      details.push({ code: d.code, label: driver.label, add });
    } else if (driver.type === 'fixed') {
      const add = d.value || driver.value;
      total += add;
      details.push({ code: d.code, label: driver.label, add });
    } else if (driver.type === 'per_unit') {
      const qty = d.quantity || 1;
      const add = driver.value * qty;
      total += add;
      details.push({ code: d.code, label: driver.label, add, quantity: qty });
    }
  }

  const finalTotal = Math.ceil((total * 110) / 100);

  return { total: finalTotal, details, basePrice };
}

// Карта влияния драйверов на цену (для динамического приоритета вопросов)
const DRIVER_IMPACT = {
  'KOZHA_MEH': { pct: 100, label: 'кожа/мех', priority: 'ВЫСШИЙ' },
  'DABL': { pct: 50, label: 'ткань дабл', priority: 'высокий' },
  'USLOZHNENNY_KROY': { pct: 50, label: 'усложнённый крой', priority: 'высокий' },
  'PAYETKI': { pct: 50, label: 'пайетки/бисер', priority: 'высокий' },
  'PODKLADKA': { pct: 50, label: 'подкладка', priority: 'высокий' },
  'SLOZHNAYA_TKAN': { pct: 30, label: 'шёлк, бархат, кружево', priority: 'высокий' },
  'DLINNOE': { pct: 25, label: 'длинное изделие', priority: 'средний' },
  'RAZMER56': { pct: 20, label: 'размер >56', priority: 'средний' },
  'RISUNOK': { pct: 20, label: 'ткань с рисунком', priority: 'средний' },
  'BELAYA': { pct: 20, label: 'белая ткань', priority: 'средний' },
  'REGLAN': { pct: 20, label: 'реглан', priority: 'средний' },
  'RELYEFY': { pct: 15, label: 'рельефы', priority: 'низкий' },
  'OTREZNAYA_TALIYA': { pct: 10, label: 'отрезная талия', priority: 'низкий' },
};

// === Phase 2A: Prompt для детекции драйверов (AI возвращает JSON-чеклист) ===
function DRIVER_DETECTION_PROMPT(baseName, basePrice, category, hasPhoto) {
  const appSheetName = APPLICABILITY_LOOKUP[baseName.toLowerCase().trim()] || '';
  const appSheetRaw = appSheetName ? (SECTIONS[appSheetName] || '') : '';

  // Парсим лист применимости в структурированный чеклист
  const checklistItems = [];
  if (appSheetRaw) {
    const lines = appSheetRaw.split('\n');
    for (const line of lines) {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 4 && parts[0] !== 'Элемент') {
        checklistItems.push({
          element: parts[0],
          code: parts[1],
          source: parts[2],
          hasQuestion: parts[3].toLowerCase() === 'да',
        });
      }
    }
  }

  // Фильтруем данные: AI видит только драйверы, применимые к данной основе
  const applicableCodes = new Set(checklistItems.map(i => i.code));
  const targetedPriceData = buildPhase2PriceData(baseName, category, applicableCodes);

  // Динамический список приоритетов — только применимые к основе
  const seenCodes = new Set();
  const priorityLines = checklistItems
    .filter(i => {
      if (seenCodes.has(i.code)) return false;
      seenCodes.add(i.code);
      return DRIVER_IMPACT[i.code] && DRIVER_IMPACT[i.code].pct >= 25;
    })
    .sort((a, b) => (DRIVER_IMPACT[b.code].pct) - (DRIVER_IMPACT[a.code].pct))
    .map(i => {
      const d = DRIVER_IMPACT[i.code];
      return `   - ${i.code} (${d.label}, +${d.pct}%) — ${d.priority} приоритет`;
    })
    .join('\n');

  // Формируем нумерованный чеклист для промпта
  let checklistText = '';
  if (checklistItems.length > 0) {
    checklistText = checklistItems.map((item, i) =>
      `  ${i + 1}. "${item.element}" → код ${item.code} (источник: ${item.source}, спорный: ${item.hasQuestion ? 'да' : 'нет'})`
    ).join('\n');
  }

  // Динамические исключения двойного учёта
  const baseExcluded = getBaseExcludedDrivers(baseName);
  let excludedText = '';
  if (baseExcluded.size > 0) {
    excludedText = `\n\n========== ДВОЙНОЙ УЧЁТ (коды УЖЕ в базовой цене) ==========\nДля основы «${baseName}» следующие коды УЖЕ ВКЛЮЧЕНЫ в базовую цену ${basePrice} руб.\nОБЯЗАТЕЛЬНО ставь false для этих кодов: ${Array.from(baseExcluded).join(', ')}\nНЕ считай их как надбавку — это приведёт к двойному учёту!`;
    // Для «без подкладки» в названии — инвертируем PODKLADKA: она НЕ в базе
    const lowerBase = baseName.toLowerCase();
    if (lowerBase.includes('без подкладк') && baseExcluded.has('PODKLADKA')) {
      baseExcluded.delete('PODKLADKA');
      excludedText = `\n\n========== ДВОЙНОЙ УЧЁТ (коды УЖЕ в базовой цене) ==========\nДля основы «${baseName}» следующие коды УЖЕ ВКЛЮЧЕНЫ в базовую цену ${basePrice} руб.\n${baseExcluded.size > 0 ? `ОБЯЗАТЕЛЬНО ставь false для этих кодов: ${Array.from(baseExcluded).join(', ')}` : '(нет исключений)'}\nВАЖНО: «без подкладки» в названии = подкладка НЕ в базе. Если клиент хочет подкладку — PODKLADKA = true.`;
    }
  }

  return `Ты — аналитик «Ателье 15/13». Твоя задача — пройти по КАЖДОМУ элементу чеклиста и определить, применим ли он к изделию клиента.

${targetedPriceData}

========== ПОДТВЕРЖДЁННАЯ ОСНОВА ==========
Изделие: ${baseName}
Базовая цена: ${basePrice} руб.${appSheetName ? `\nЛист применимости: ${appSheetName}` : ''}${excludedText}

========== ЧЕКЛИСТ (проверь КАЖДЫЙ пункт) ==========${checklistText ? '\n' + checklistText : '\nЛист применимости не найден. Определи драйверы самостоятельно из таблицы ДРАЙВЕРЫ.'}

========== ИНСТРУКЦИЯ ==========

Основа ПОДТВЕРЖДЕНА программой. НЕ меняй основу.

КРИТИЧЕСКОЕ ПРАВИЛО: Работай ТОЛЬКО с элементами из чеклиста выше. Если кода драйвера НЕТ в чеклисте — он НЕ применим к этой основе. НЕ добавляй и НЕ спрашивай про коды, отсутствующие в чеклисте.

РЕЖИМ РАБОТЫ: ${hasPhoto ? 'ФОТО' : 'ТЕКСТ (без фото)'}

${hasPhoto ? `РЕЖИМ ФОТО:

========== ШАГ 1: ДЕТАЛЬНЫЙ ОСМОТР ФОТО ==========
ПРЕЖДЕ чем заполнять чеклист, внимательно изучи фото и опиши в поле "description" ВСЁ, что видишь:
- Какие МАТЕРИАЛЫ? (кожа гладкая/зернистая, замша, нубук, мех, ткань — где именно на изделии?)
- Сколько РАЗНЫХ материалов/фактур/цветов? Где СТЫКИ и швы между ними?
- Какая ФУРНИТУРА? (молнии — сколько и где, пряжки, клёпки, люверсы, кнопки)
- КОНСТРУКЦИЯ: симметричная или нет? Диагональные линии? Сколько отдельных панелей?
- ВОРОТНИК: тип, материал, форма (отложной, стойка, шалевый, меховой?)
- МАНЖЕТЫ и НИЗ: чем отделаны? Мех? Резинка? Открытый край?
- КАРМАНЫ: сколько видно, какого типа (накладные, прорезные, с клапанами)?
- ДЛИНА изделия относительно тела
- ДЕКОР: ремешки, пряжки, погоны, паты, вышивка

========== ШАГ 2: ЗАПОЛНЕНИЕ ЧЕКЛИСТА ==========
Теперь, используя своё описание из Шага 1, пройди по КАЖДОМУ ПУНКТУ чеклиста (все ${checklistItems.length} шт.) и ответь:
- true — элемент виден на фото ИЛИ ЯВНО упомянут клиентом. ПРАВИЛО: цена МИНИМАЛЬНАЯ (от). Если ВИДНЫ ПРИЗНАКИ элемента — ставь true. При сомнении → true.
- false — элемент ТОЧНО отсутствует на фото и НЕ упомянут клиентом. Ставь false ТОЛЬКО при полной уверенности.
- "ask" — ТОЛЬКО если: пункт помечен «спорный: да» И клиент ещё НЕ ответил. Если уже ответил — ставь true/false.
Не более 2 вопросов (пунктов с "ask") одновременно.

========== ВИЗУАЛЬНОЕ РУКОВОДСТВО (что искать на фото) ==========
Используй это руководство для КАЖДОГО пункта чеклиста. Внимательно изучи фото и проверь наличие каждого признака.

МАТЕРИАЛЫ:
• SLOZHNAYA_TKAN — шёлк (характерный блеск, текучесть, мягкие складки), бархат/велюр (ворсистая мягкая поверхность, глубина цвета), кружево (ажурное полотно, просвечивающая сетчатая структура), шифон/органза (прозрачная тонкая ткань)
• KOZHA_MEH — кожа (гладкая/зернистая поверхность, характерные поры, жёсткая форма), замша (матовая бархатистая поверхность), мех (ворс, пушистая объёмная текстура)
• DABL — ткань дабл: объёмная двухслойная (видно на срезах и краях — два слоя без подкладки)
• BELAYA — белая, кремовая, молочная или светло-бежевая ткань
• RISUNOK — клетка, полоска, принт, рисунок на ткани (требует совмещения при крое)
• PAYETKI — мелкие блестящие плоские диски, нашитые на ткань (точечный блеск, каждый диск виден отдельно). НЕ путай с блеском шёлка или люрексом!

КОНСТРУКЦИЯ:
• RELYEFY — дополнительные конструктивные швы на полочках/спинке (вертикальные, горизонтальные, фигурные); вставки из другого материала; панели разных фактур/цветов, соединённые швами
• OTREZNAYA_TALIYA — горизонтальный шов на уровне талии, разделяющий верхнюю и нижнюю части изделия; баска; комбинация разных фактур сверху и снизу
• USLOZHNENNY_KROY — асимметрия (неравные полы, косой крой), диагональная/косая застёжка, объёмные рукава, драпировки, воланы/рюши, корсетная конструкция, многоярусность, нестандартные разрезы, сложный лиф, широкий конструктивный пояс
• REGLAN — рукав реглан: шов идёт ОТ ГОРЛОВИНЫ к подмышке по диагонали (НЕ обычный плечевой шов)
• KAPYUSHON — капюшон (пришитый или отстёгивающийся)
• SUPAT — скрытая застёжка: ткань полностью закрывает пуговицы или молнию (застёжка не видна снаружи)

ДЕТАЛИ:
• DOP_KARMAN — считай ВСЕ видимые карманы: накладные, прорезные, с клапанами. Если их >2 — true + quantity
• POYAS — пояс (тканевый/кожаный), кулиска, завязки на талии
• MANZHETY_SHLITSY — манжеты на рукавах (отворот/застёжка), шлицы на спинке или рукавах (разрезы с подгибкой)
• POGONY_PATY — погоны на плечах (полоски ткани с пуговицей), паты (ремешки с пряжками на рукавах/поясе/спинке)
• SLOZHNY_VOROTNIK — нестандартный воротник: стойка с лацканами, фигурный, асимметричный, двойной, шалевый со сложной формой, воротник-трансформер

МЕХ:
• MEH_VOROT_OTL — меховой воротник отложной: лежит на плечах, мех виден сверху
• MEH_VOROT_ANGL — меховой воротник английский: стоячий с лацканами, объёмный
• MEH_MANZHETY — мех на манжетах рукавов или по низу изделия

ОТДЕЛКА:
• OTDELOCHNYE_STROCHKI — видимые декоративные строчки (параллельно швам, вдоль краёв, по деталям — не технические внутренние швы)
• DEKOR_ELEM — пряжки, металлические элементы, вышивка, аппликации, декоративные молнии, клёпки, стразы

ДЛИНА:
• DLINNOE — изделие ниже колена, в пол, макси

ВАЖНО ПО RAZMER56:
• RAZMER56 определяется СЕРВЕРОМ автоматически по ответу клиента. Ты ВСЕГДА ставишь RAZMER56 = false.
• НЕ задавай вопросов о размере. НЕ ставь "ask" для RAZMER56.
• Сервер сам спросит размер и решит, нужна ли надбавка.` : `РЕЖИМ ТЕКСТ (фото НЕТ):
Клиент описал изделие ТОЛЬКО словами. Фото нет.

ПРОЙДИ ПО КАЖДОМУ ПУНКТУ чеклиста выше (все ${checklistItems.length} шт.) и ответь:
- true — клиент ЯВНО УПОМЯНУЛ этот элемент (например, «из шёлка» → SLOZHNAYA_TKAN = true, «кожаная» → KOZHA_MEH = true)
- false — ВСЁ ОСТАЛЬНОЕ. Если клиент не упоминал элемент — ставь false.

АБСОЛЮТНЫЙ ЗАПРЕТ: НЕ используй "ask" ни для одного пункта. В текстовом режиме допустимы ТОЛЬКО true и false.
Бот уже задал клиенту все нужные вопросы (материал, длину, фасон). Твоя задача — ТОЛЬКО проанализировать текст и определить драйверы.

ПРАВИЛА для текстового режима:
1. Если клиент ЯВНО написал материал (шёлк, бархат, кожа и т.д.) — ОБЯЗАТЕЛЬНО ставь true для соответствующего драйвера.
2. Если клиент ЯВНО написал длину (длинное, в пол, макси) — ОБЯЗАТЕЛЬНО ставь true для DLINNOE.
3. Если клиент ЯВНО описал сложный крой (асимметрия, драпировка, воланы, корсетная конструкция) — ставь true для USLOZHNENNY_KROY. Если НЕ описывал — ставь false. НЕ ДОДУМЫВАЙ сложность.
4. Если клиент НЕ упомянул ткань дабл — ставь false для DABL. Никогда не предполагай дабл.
5. Для мелких драйверов (карманы, пояс, манжеты, строчки, погоны, декор, рельефы) — если клиент ЯВНО упомянул → true, иначе → false.
6. RAZMER56: ВСЕГДА false. Размер определяется сервером.
7. PODKLADKA: если клиент явно сказал про подкладку → true/false по ответу. Если не упоминал — false (сервер спросит отдельно).
8. ПРИНЦИП: в текстовом режиме НЕТ «может быть». Есть только «клиент сказал» (true) или «не сказал» (false).`}

ПРАВИЛА:
1. НЕ ПРОПУСКАЙ ни одного пункта. Каждый элемент из чеклиста ОБЯЗАН быть в ответе.
2. РАЗЛИЧАЙ МАТЕРИАЛЫ: кружево — это тканое ажурное полотно с узорами (просвечивает, видна сетчатая структура). Пайетки — это мелкие блестящие плоские диски, нашитые на ткань (каждый диск виден отдельно, поверхность мерцает точечно). Кружево → SLOZHNAYA_TKAN. Пайетки → PAYETKI. Это РАЗНЫЕ материалы, не путай.
3. ДВОЙНОЙ УЧЁТ: если в секции «ДВОЙНОЙ УЧЁТ» выше перечислены коды — ставь для них false. REGLAN/RELYEFY → не дублируй через USLOZHNENNY_KROY.
4. Для DOP_KARMAN — добавь "quantity": число карманов.
   Для POGONY_PATY — добавь "quantity": число единиц.
   Для DEKOR_ELEM — добавь "value": оценочная стоимость (минимум 1000).
5. ПРИНЦИП МИНИМАЛЬНОЙ ЦЕНЫ: цена у нас «от» (ориентировочная). Лучше учесть элемент, чем пропустить. При сомнении → true.

Верни СТРОГО JSON без комментариев:
{
  "description": "краткое описание изделия (2-3 предложения)",
  "checklist": [
    {"element": "шелк", "code": "SLOZHNAYA_TKAN", "applies": true, "reason": "видно блеск шёлковой ткани"},
    {"element": "белая ткань", "code": "BELAYA", "applies": false, "reason": "ткань тёмного цвета"},
    {"element": "подкладка", "code": "PODKLADKA", "applies": "ask", "question": "Подскажите, нужна ли подкладка?"}
  ]
}

checklist ОБЯЗАН содержать ВСЕ ${checklistItems.length} пунктов — ни больше, ни меньше.
Для пунктов с applies = "ask" — добавь поле "question" с вопросом клиенту.
Для остальных — добавь поле "reason" с кратким обоснованием.`;
}

// === Phase 2B: Prompt для форматирования ответа клиенту ===
function FORMAT_RESPONSE_PROMPT(baseName, totalPrice, description, hasClientDescription) {
  return `Ты — вежливый помощник «Ателье 15/13» (Москва, ул. Петровка 15/13, стр. 3, только по записи, тел. +7 (915) 371-50-41).

Сформируй ответ клиенту. Данные УЖЕ рассчитаны программой, менять их ЗАПРЕЩЕНО.

Изделие: ${baseName}
Описание: ${description}
Итоговая стоимость: ${totalPrice} руб.

ПРАВИЛА ОТВЕТА:
1. Простой текст, без Markdown.
2. ${hasClientDescription ? 'НЕ пересказывай описание изделия — клиент сам его предоставил. Сразу переходи к стоимости.' : 'Кратко (1-2 предложения) опиши изделие по фото.'}
3. Напиши: «Ориентировочная стоимость пошива: от ${totalPrice.toLocaleString('ru-RU')} руб.»
4. Предложи записаться в ателье для уточнения деталей.
5. НЕ показывай базовую цену, НЕ перечисляй драйверы/надбавки, НЕ объясняй расчёт.
6. Обращение на «вы», вежливо, лаконично. Только русский язык.
7. Цена минимальная (от), итог ориентировочный.
8. НЕ меняй сумму. Пиши РОВНО ${totalPrice.toLocaleString('ru-RU')} руб.
9. НЕ начинай ответ с приветствия («Здравствуйте», «Привет», «Добрый день»). Клиент уже в диалоге, приветствие было раньше. Сразу переходи к сути.`;
}

// === Ключевые вопросы для текстового режима (без фото) ===
// Покрывают высокоударные драйверы, которые без фото невозможно определить
const TEXT_MODE_ESSENTIALS = {
  'ПЛАТЬЯ': [
    {
      key: 'style',
      question: 'Какой фасон платья — прямое, приталенное (футляр) или с отрезной талией?',
      retryQuestion: 'Уточните фасон: прямое, футляр, с отрезной талией или раздельный верх с юбкой?',
      answerPattern: /прямо|футляр|приталенн|облегающ|отрезн|талия|свободн|трапеци|а-силуэт|необычн[а-яёa-z]*\s+форм|нестандартн[а-яёa-z]*\s+форм|сложн[а-яёa-z]*\s+форм|отдельн[а-яёa-z]*.*(юбк|низ).*(верх|топ|лиф)|отдельн[а-яёa-z]*.*(верх|топ|лиф).*(юбк|низ)|верх[а-яёa-z]*\s+и\s+(юбк|низ)|юбк[а-яёa-z]*\s+и\s+верх|лиф[а-яёa-z]*\s+и\s+юбк|топ[а-яёa-z]*\s+и\s+юбк/i,
    },
    {
      key: 'sleeve',
      question: 'Верх планируется с рукавами, на бретелях или без рукавов?',
      retryQuestion: 'Подскажите верх: с рукавами, на бретелях или без рукавов?',
      answerPattern: /с рукав|без рукав|рукав|руков|бретел|без бретел|открыт\w*\s+плеч|длинн\S{0,3}\s*рукав|коротк\S{0,3}\s*рукав|3\/4/i,
    },
    {
      key: 'material',
      question: 'Из чего шьём платье — хлопок, шёлк или может кружево?',
      retryQuestion: 'Подскажите точнее по материалу — это важно для расчёта.',
      answerPattern: /хлопок|шёлк|шелк|шифон|кружев|бархат|велюр|кож[аеуой]|замш|органза|атлас|трикотаж|(?:^|\s)(?:лён|лен)(?:\s|$)|костюмн|вискоз|обычн|стандартн|простой|шерст/i,
    },
    {
      key: 'length',
      question: 'Какой длины — до колена, миди или в пол?',
      retryQuestion: 'Подскажите длину: до колена, миди или в пол?',
      answerPattern: /мини|коротк|до колена|выше колена|ниже колена|миди|макси|в пол|до пола|длинн|удлинённ/i,
    },
  ],
  'ЮБКИ': [
    {
      key: 'material',
      question: 'Из чего шьём юбку — хлопок, шерсть или может кожу?',
      retryQuestion: 'Уточните материал — это влияет на стоимость.',
      answerPattern: /хлопок|шёлк|шелк|шифон|кружев|бархат|велюр|кож[аеуой]|замш|атлас|трикотаж|лён|лен|костюмн|вискоз|обычн|шерст/i,
    },
    {
      key: 'length',
      question: 'Какой длины — мини, до колена или макси?',
      retryQuestion: 'Подскажите длину: мини, до колена или макси?',
      answerPattern: /мини|коротк|до колена|ниже колена|выше колена|миди|макси|в пол|до пола|длинн|удлинённ/i,
    },
  ],
  'ЖАКЕТЫ': [
    {
      key: 'material',
      question: 'Из чего шьём жакет — шерсть, лён или может кожу?',
      retryQuestion: 'Подскажите материал — шерсть, хлопок, кожа?',
      answerPattern: /шерст|лён|лен|хлопок|хлопк|кож[аеуой]|замш|твид|кашемир|габардин|вельвет|костюмн|обычн|стандартн/i,
    },
    {
      key: 'pockets',
      question: 'Сколько карманов планируете — два, три или больше?',
      retryQuestion: 'Уточните количество карманов.',
      answerPattern: /карман|без карман|два|три|четыре|2|3|4|не нужн/i,
    },
  ],
  'БРЮКИ': [
    {
      key: 'material',
      question: 'Из чего шьём брюки — шерсть, хлопок или может кожу?',
      retryQuestion: 'Уточните материал — это влияет на стоимость.',
      answerPattern: /шерст|хлопок|кож[аеуой]|замш|твид|костюмн|вельвет|джинс|деним|лён|лен|обычн/i,
    },
    {
      key: 'pockets',
      question: 'Сколько карманов — два или больше?',
      retryQuestion: 'Уточните количество карманов.',
      answerPattern: /карман|без карман|два|три|четыре|2|3|4|не нужн/i,
    },
  ],
  'РУБАШКИ': [
    {
      key: 'material',
      question: 'Из чего шьём рубашку — хлопок, лён или может шёлк?',
      retryQuestion: 'Подскажите материал — хлопок, лён, шёлк?',
      answerPattern: /хлопок|шёлк|шелк|шифон|кружев|лён|лен|поплин|оксфорд|обычн|вискоз|атлас|сатин/i,
    },
  ],
  'КУРТКА': [
    {
      key: 'material',
      question: 'Из чего шьём курточку — плащёвка, шерсть или может кожу?',
      retryQuestion: 'Подскажите материал — плащёвка, шерсть, кожа?',
      answerPattern: /плащёвк|плащевк|нейлон|полиэстер|шерст|кож[аеуой]|замш|хлопок|габардин|дабл|обычн|болонь|стандартн/i,
    },
    {
      key: 'length',
      question: 'Какой длины — короткая (до бедра) или удлинённая?',
      retryQuestion: 'Уточните длину: короткая или удлинённая?',
      answerPattern: /корот|до бедра|до колена|удлинённ|удлинен|длинн|стандартн|обычн/i,
    },
  ],
  'БОМБЕР': [
    {
      key: 'material',
      question: 'Из чего шьём бомбер — плащёвка, шерсть или может кожу?',
      retryQuestion: 'Подскажите материал — плащёвка, шерсть, кожа?',
      answerPattern: /плащёвк|плащевк|нейлон|полиэстер|шерст|кож[аеуой]|замш|хлопок|обычн|болонь|стандартн/i,
    },
  ],
  'ПАРКА': [
    {
      key: 'material',
      question: 'Из чего шьём парку — плащёвка, хлопок или может кожу?',
      retryQuestion: 'Подскажите материал — плащёвка, хлопок, кожа?',
      answerPattern: /плащёвк|плащевк|нейлон|полиэстер|хлопок|кож[аеуой]|замш|шерст|обычн|болонь|стандартн/i,
    },
    {
      key: 'length',
      question: 'По длине — до бедра, до колена или удлинённая?',
      retryQuestion: 'Уточните длину: до бедра, до колена, удлинённая?',
      answerPattern: /корот|до бедра|до колена|удлинённ|удлинен|длинн|стандартн|обычн/i,
    },
  ],
  'ЖИЛЕТ_ПУХОВОЙ': [
    {
      key: 'material',
      question: 'Из чего шьём жилет — плащёвка, шерсть или может кашемир?',
      retryQuestion: 'Подскажите материал — плащёвка, шерсть, кашемир?',
      answerPattern: /плащёвк|плащевк|нейлон|полиэстер|шерст|кашемир|кож[аеуой]|замш|хлопок|обычн|болонь|стандартн/i,
    },
    {
      key: 'length',
      question: 'Какой длины — короткий или удлинённый?',
      retryQuestion: 'Уточните длину: короткий или удлинённый?',
      answerPattern: /корот|удлинённ|удлинен|длинн|стандартн|обычн|до бедра|до колена/i,
    },
  ],
  'ПУХОВИК': [
    {
      key: 'material',
      question: 'Из чего шьём пуховик — плащёвка, нейлон или может кожу?',
      retryQuestion: 'Подскажите материал — плащёвка, нейлон, кожа?',
      answerPattern: /плащёвк|плащевк|нейлон|полиэстер|кож[аеуой]|замш|обычн|болонь|стандартн/i,
    },
    {
      key: 'length',
      question: 'По длине — короткий (до бедра) или длинный?',
      retryQuestion: 'Уточните длину: короткий или длинный?',
      answerPattern: /корот|до бедра|до колена|удлинённ|удлинен|длинн|стандартн|обычн/i,
    },
  ],
  'ПАЛЬТО': [
    {
      key: 'material',
      question: 'Из чего планируете пальто — шерсть, кашемир или может замшу?',
      retryQuestion: 'Подскажите материал — шерсть, кашемир, замша?',
      answerPattern: /шерст|кашемир|кож[аеуой]|замш|твид|дабл|обычн|стандартн|драп/i,
    },
    {
      key: 'length',
      question: 'Какой длины — до бедра, до колена или длинное?',
      retryQuestion: 'Уточните длину: до бедра, до колена или длинное?',
      answerPattern: /корот|до бедра|до колена|удлинённ|удлинен|длинн|стандартн|обычн|макси/i,
    },
  ],
  'ПЛАЩ': [
    {
      key: 'material',
      question: 'Из чего шьём плащ — хлопок, плащёвка или может кожу?',
      retryQuestion: 'Подскажите материал — хлопок, плащёвка, кожа?',
      answerPattern: /хлопок|плащёвк|плащевк|нейлон|кож[аеуой]|замш|обычн|стандартн|габардин/i,
    },
    {
      key: 'length',
      question: 'Какой длины — до колена или удлинённый?',
      retryQuestion: 'Уточните длину: до колена или удлинённый?',
      answerPattern: /корот|до бедра|до колена|удлинённ|удлинен|длинн|стандартн|обычн/i,
    },
  ],
  'ДУБЛЕНКА': [
    {
      key: 'material',
      question: 'Из чего шьём — натуральная овчина, экомех или может кожу с мехом?',
      retryQuestion: 'Подскажите материал — овчина, экомех, кожа с мехом?',
      answerPattern: /овчин|экомех|эко-мех|кож[аеуой]|замш|мех|искусственн|натуральн|обычн|стандартн/i,
    },
    {
      key: 'length',
      question: 'Какой длины — короткая или удлинённая?',
      retryQuestion: 'Уточните длину: короткая или удлинённая?',
      answerPattern: /корот|удлинённ|удлинен|длинн|стандартн|обычн|до бедра|до колена/i,
    },
  ],
  'ТРИКОТАЖ': [],
  'ТОПЫ': [
    {
      key: 'material',
      question: 'Из чего шьём топ — хлопок, шёлк или может кружево?',
      retryQuestion: 'Подскажите материал — хлопок, шёлк, кружево?',
      answerPattern: /хлопок|шёлк|шелк|шифон|кружев|обычн|трикотаж|вискоз/i,
    },
  ],
  'АКСЕССУАРЫ': [],
};

// === Обязательные вопросы по листам применимости (Источник = "вопрос") ===
const SIZE_QUESTION = 'Подскажите ваш размер одежды';
const SIZE_ANSWER_PATTERN = /размер|size|\b(3[6-9]|[4-6]\d|70)\b|\b(xxxl|xxl|xxs|3xl|2xl|4xl|5xl|6xl|xl|xs)\b|\b[sml]\b/i;

const MANDATORY_QUESTIONS = {
  'ПРИМЕНИМОСТЬ_ПЛАТЬЯ': [
    { code: 'PODKLADKA', question: 'Подскажите, нужна ли подкладка?', answerPattern: /подкладк|без подкладк|с подкладк|не нужн|нужна|\bда\b|\bнет\b/ },
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
  'ПРИМЕНИМОСТЬ_ЮБКИ': [
    { code: 'PODKLADKA', question: 'Подскажите, нужна ли подкладка?', answerPattern: /подкладк|не нужн|нужна|\bда\b|\bнет\b/ },
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
  'ПРИМЕНИМОСТЬ_ЖАКЕТЫ': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
  'ПРИМЕНИМОСТЬ_ТОПЫ': [
    { code: 'PODKLADKA', question: 'Подскажите, нужна ли подкладка?', answerPattern: /подкладк|не нужн|нужна|\bда\b|\bнет\b/ },
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
  'ПРИМЕНИМОСТЬ_КУРТКА': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
    { code: 'PODKLADKA', question: 'Нужна ли подкладка?', answerPattern: /подкладк|не нужн|нужна|\bда\b|\bнет\b/ },
  ],
  'ПРИМЕНИМОСТЬ_БОМБЕР': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
    { code: 'PODKLADKA', question: 'Нужна ли подкладка?', answerPattern: /подкладк|не нужн|нужна|\bда\b|\bнет\b/ },
  ],
  'ПРИМЕНИМОСТЬ_ПАРКА': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
    { code: 'PODKLADKA', question: 'Нужна ли подкладка?', answerPattern: /подкладк|не нужн|нужна|\bда\b|\bнет\b/ },
  ],
  'ПРИМЕНИМОСТЬ_ПАЛЬТО': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
    { code: 'PODKLADKA', question: 'Нужна ли подкладка?', answerPattern: /подкладк|не нужн|нужна|\bда\b|\bнет\b/ },
  ],
  'ПРИМЕНИМОСТЬ_ПЛАЩ': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
    { code: 'PODKLADKA', question: 'Нужна ли подкладка?', answerPattern: /подкладк|не нужн|нужна|\bда\b|\bнет\b/ },
  ],
  'ПРИМЕНИМОСТЬ_ЖИЛЕТ_ПУХОВОЙ': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
  'ПРИМЕНИМОСТЬ_ПУХОВИК': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
  'ПРИМЕНИМОСТЬ_ДУБЛЕНКА': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
  'ПРИМЕНИМОСТЬ_БРЮКИ': [
    { code: 'PODKLADKA', question: 'Нужна ли подкладка?', answerPattern: /подкладк|не нужн|нужна|\bда\b|\bнет\b/ },
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
  'ПРИМЕНИМОСТЬ_РУБАШКИ': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
  'ПРИМЕНИМОСТЬ_ТРИКОТАЖ': [
    { code: 'RAZMER56', question: SIZE_QUESTION, answerPattern: SIZE_ANSWER_PATTERN },
  ],
};

// === Серверная детекция драйверов по ключевым словам (forcedDrivers) ===
const KEYWORD_DRIVERS = [
  { pattern: /кружев/i, code: 'SLOZHNAYA_TKAN' },
  { pattern: /шёлк|шелк|атлас/i, code: 'SLOZHNAYA_TKAN' },
  { pattern: /шифон|органз/i, code: 'SLOZHNAYA_TKAN' },
  { pattern: /бархат|велюр/i, code: 'SLOZHNAYA_TKAN' },
  { pattern: /пайет|бисер/i, code: 'PAYETKI' },
  { pattern: /длинн|макси|в пол|до пола|до пят/i, code: 'DLINNOE' },
  { pattern: /кож|замш/i, code: 'KOZHA_MEH' },
  { pattern: /мех\b|меховой|меховая/i, code: 'KOZHA_MEH' },
  { pattern: /открыт\S{0,5}\s+спин|глубок\S{0,5}\s+декольте/i, code: 'USLOZHNENNY_KROY' },
  { pattern: /корсет/i, code: 'USLOZHNENNY_KROY' },
  { pattern: /драпировк/i, code: 'USLOZHNENNY_KROY' },
  { pattern: /асимметри/i, code: 'USLOZHNENNY_KROY' },
  { pattern: /бел\S{0,3}\s+ткан|белое\s+платье|белого\s+цвета/i, code: 'BELAYA' },
  { pattern: /клетк|полоск|рисунок/i, code: 'RISUNOK' },
  { pattern: /реглан/i, code: 'REGLAN' },
  { pattern: /капюшон/i, code: 'KAPYUSHON' },
  { pattern: /карман/i, code: 'DOP_KARMAN' },
  { pattern: /манжет|шлиц/i, code: 'MANZHETY_SHLITSY' },
  { pattern: /пояс/i, code: 'POYAS' },
  { pattern: /отделочн\S{0,5}\s+строчк/i, code: 'OTDELOCHNYE_STROCHKI' },
  { pattern: /вышивк/i, code: 'DEKOR_ELEM' },
  { pattern: /погон|паты/i, code: 'POGONY_PATY' },
  { pattern: /супат/i, code: 'SUPAT' },
];

function detectForcedDrivers(text) {
  const found = new Set();
  for (const kw of KEYWORD_DRIVERS) {
    if (kw.pattern.test(text)) {
      found.add(kw.code);
    }
  }
  const lower = String(text || '').toLowerCase();
  const mentionsNoLining = /без\s+подкладк|подкладк[а-яё\s]*(?:не\s+нужн|не\s+надо)|не\s+нужн[а-яё\s]*подкладк/i.test(lower);
  const mentionsPositiveLining = /с\s+подкладк|на\s+подкладк|подкладк(?:ой|а|у|и|е)\b|ш[её]лков[а-яё\s]+подкладк/i.test(lower);
  if (mentionsPositiveLining && !mentionsNoLining) {
    found.add('PODKLADKA');
  }
  return found;
}

// === Серверная детекция уже указанной клиентом фактуры ===
// Используется только для выбора вопросов: если факт уже есть в тексте,
// бот не должен переспрашивать его повторно.
const FACT_PATTERNS = {
  material: /хлопк|шерст|ш[её]лк|шифон|кружев|бархат|велюр|кож|замш|органз|атлас|трикотаж|л[её]н|костюмн|вискоз|плащ[её]в|нейлон|полиэстер|болонь|габардин|дабл|драп|твид|кашемир|деним|джинс|вельвет|поплин|оксфорд|сатин|мембран|овчин|эко-?мех|мех|пух|утепл/i,
  lining: /подкладк|без\s+подкладк|с\s+подкладк|на\s+подкладк/i,
  pockets: /карман|без\s+карман|накладн|прорезн|листочк|клапан|два|двумя|две|три|четыре|\b[234]\b/i,
  length: /мини|коротк|до\s+бедра|до\s+колена|выше\s+колена|ниже\s+колена|миди|макси|в\s+пол|до\s+пола|до\s+пят|длинн|удлин[её]н/i,
  sleeve: /с\s+рукав|без\s+рукав|рукав|бретел|без\s+бретел|открыт\w*\s+плеч|3\/4/i,
  style: /прямо|футляр|приталенн|облегающ|отрезн|талия|свободн|трапеци|а-силу[эе]т|необычн[а-яёa-z]*\s+форм|нестандартн[а-яёa-z]*\s+форм|сложн[а-яёa-z]*\s+форм|отдельн[а-яёa-z]*.*(юбк|низ).*(верх|топ|лиф)|отдельн[а-яёa-z]*.*(верх|топ|лиф).*(юбк|низ)|верх[а-яёa-z]*\s+и\s+(юбк|низ)|юбк[а-яёa-z]*\s+и\s+верх|лиф[а-яёa-z]*\s+и\s+юбк|топ[а-яёa-z]*\s+и\s+юбк/i,
};

function detectClientFacts(text) {
  const facts = new Set();
  const lower = String(text || '').toLowerCase();

  for (const [key, pattern] of Object.entries(FACT_PATTERNS)) {
    if (pattern.test(lower)) facts.add(key);
  }

  if (parseSizeFromText(lower) !== null) facts.add('size');

  return facts;
}

function isQuestionAnsweredByFacts(question, facts, text) {
  if (!question) return false;
  if (question.answerPattern?.test(text)) return true;
  if (question.key && facts.has(question.key)) return true;

  if (question.code === 'PODKLADKA' && facts.has('lining')) return true;
  if (question.code === 'RAZMER56' && facts.has('size')) return true;
  if (question.code === 'DOP_KARMAN' && facts.has('pockets')) return true;
  if (['SLOZHNAYA_TKAN', 'KOZHA_MEH', 'DABL', 'BELAYA', 'RISUNOK'].includes(question.code) && facts.has('material')) return true;
  if (['DLINNOE'].includes(question.code) && facts.has('length')) return true;

  return false;
}

// === Серверный парсинг размера одежды (числовой + буквенный) ===
function parseSizeFromText(text) {
  const lower = text.toLowerCase();

  // Буквенные размеры (проверяем многосимвольные первыми)
  const letterMap = {
    'xxxl': 58, '3xl': 58, 'xxl': 56, '2xl': 56,
    '4xl': 62, '5xl': 64, '6xl': 66,
    'xl': 54, 'xxs': 40, 'xs': 42,
  };
  const multiMatch = lower.match(/\b(xxxl|3xl|xxl|2xl|4xl|5xl|6xl|xl|xxs|xs)\b/i);
  if (multiMatch) return letterMap[multiMatch[1].toLowerCase()];

  // Односимвольные S/M/L — только рядом с контекстом «размер» или как отдельный ответ
  const singleMap = { 's': 46, 'm': 48, 'l': 50 };
  const singleCtx = lower.match(/(?:размер|size|р\.?\s*)([sml])\b/i);
  if (singleCtx) return singleMap[singleCtx[1].toLowerCase()];
  // Отдельный короткий ответ: только буква (возможно с пробелами)
  if (/^\s*[sml]\s*$/i.test(lower)) return singleMap[lower.trim().toLowerCase()];

  // Числовой размер (российские: 36-70, только чётные)
  const numMatch = lower.match(/\b(3[6-9]|[4-6]\d|70)\b/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 36 && num <= 70) return num;
  }

  return null;
}

// === Серверный кэш классификации (для addon-mode) ===
const classificationCache = new Map();
const CLASSIFICATION_CACHE_TTL = 60 * 60 * 1000; // 60 минут

function getClassificationCacheKey(messages) {
  // Ключ = хэш первого фото или текста первого сообщения сессии
  for (const m of messages) {
    if (m.role === 'user') {
      const imgs = m.images || (m.image ? [m.image] : []);
      if (imgs.length > 0 && typeof imgs[0] === 'string') {
        return imgs[0].substring(0, 200);
      }
      const text = typeof m.content === 'string' ? m.content : '';
      if (text.length > 0) return text.substring(0, 300);
    }
  }
  return 'unknown';
}

function saveClassificationToCache(sessionMessages, classification) {
  const key = getClassificationCacheKey(sessionMessages);
  classificationCache.set(key, { classification, timestamp: Date.now() });
  for (const [k, v] of classificationCache) {
    if (Date.now() - v.timestamp > CLASSIFICATION_CACHE_TTL) classificationCache.delete(k);
  }
}

function getClassificationFromCache(sessionMessages) {
  const key = getClassificationCacheKey(sessionMessages);
  const entry = classificationCache.get(key);
  if (entry && Date.now() - entry.timestamp < CLASSIFICATION_CACHE_TTL) return entry.classification;
  return null;
}

// === Серверный кэш драйверов (сохраняет между проходами Phase 2A) ===
const driverCache = new Map();
const DRIVER_CACHE_TTL = 30 * 60 * 1000; // 30 минут

const chatSessionCache = new Map();
const CHAT_SESSION_TTL = 2 * 60 * 60 * 1000; // 2 часа

function isSafeSessionId(sessionId) {
  return typeof sessionId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(sessionId);
}

function sameChatMessage(a, b) {
  if (!a || !b) return false;
  const aImages = a.images && Array.isArray(a.images) ? a.images : a.image ? [a.image] : [];
  const bImages = b.images && Array.isArray(b.images) ? b.images : b.image ? [b.image] : [];
  return a.role === b.role
    && (a.content || '') === (b.content || '')
    && aImages.length === bImages.length
    && aImages.every((img, index) => img === bImages[index]);
}

function cleanupChatSessions() {
  const now = Date.now();
  for (const [key, entry] of chatSessionCache) {
    if (now - entry.timestamp > CHAT_SESSION_TTL) chatSessionCache.delete(key);
  }
}

function mergeChatSessionMessages(sessionId, incomingMessages) {
  if (!isSafeSessionId(sessionId)) return incomingMessages;

  cleanupChatSessions();
  const entry = chatSessionCache.get(sessionId);
  const existing = entry?.messages || [];
  let merged = incomingMessages;

  if (existing.length > 0) {
    const incomingLast = incomingMessages[incomingMessages.length - 1];
    const existingLast = existing[existing.length - 1];

    if (incomingMessages.length < existing.length) {
      merged = sameChatMessage(incomingLast, existingLast)
        ? existing
        : existing.concat(incomingLast);
    } else if (incomingMessages.length === existing.length && sameChatMessage(incomingLast, existingLast)) {
      merged = existing;
    }
  }

  chatSessionCache.set(sessionId, { messages: merged, timestamp: Date.now() });
  return merged;
}

function saveChatSessionMessages(sessionId, messages) {
  if (!isSafeSessionId(sessionId)) return;
  chatSessionCache.set(sessionId, { messages, timestamp: Date.now() });
}

function getDriverCacheKey(messages) {
  // Ключ = первые 200 символов первого изображения текущей сессии
  for (const m of messages) {
    if (m.role === 'user') {
      const imgs = m.images || (m.image ? [m.image] : []);
      if (imgs.length > 0 && typeof imgs[0] === 'string') {
        return imgs[0].substring(0, 200);
      }
    }
  }
  // Fallback: текст первых сообщений
  const text = messages.filter(m => m.role === 'user').map(m => m.content || '').join('|');
  return text.substring(0, 500);
}

function saveDriversToCache(messages, drivers) {
  const key = getDriverCacheKey(messages);
  driverCache.set(key, { drivers, timestamp: Date.now() });
  // Чистим старые записи
  for (const [k, v] of driverCache) {
    if (Date.now() - v.timestamp > DRIVER_CACHE_TTL) driverCache.delete(k);
  }
}

function getDriversFromCache(messages) {
  const key = getDriverCacheKey(messages);
  const entry = driverCache.get(key);
  if (entry && Date.now() - entry.timestamp < DRIVER_CACHE_TTL) return entry.drivers;
  return null;
}

// === Полный цикл Phase 2: детекция + серверный расчёт + форматирование ===
async function runPhase2(provider, model, baseName, basePrice, category, conversationMessages, hasPhoto) {
  // === Восстанавливаем ранее сохранённые драйверы из кэша ===
  const cachedDrivers = getDriversFromCache(conversationMessages);
  const savedDrivers = new Map();
  if (cachedDrivers) {
    for (const d of cachedDrivers) {
      savedDrivers.set(d.code, d);
    }
    console.log('[Phase2A] Restored cached drivers:', Array.from(savedDrivers.keys()).join(', '));
  }

  const p2aPrompt = DRIVER_DETECTION_PROMPT(baseName, basePrice, category, hasPhoto !== false);
  const p2aMessages = [
    { role: 'system', content: p2aPrompt },
    ...conversationMessages,
  ];

  // Phase 2A ВСЕГДА использует сильную модель (gpt-4o), даже если фото нет
  const p2aModel = provider === 'openai' ? OPENAI_MODEL_VISION : GROQ_MODEL_VISION;
  console.log(`[Phase2A] Detecting drivers for: ${baseName} (${basePrice}), model: ${p2aModel}`);
  const p2aResult = await callLLM(provider, p2aModel, p2aMessages, {
    temperature: 0.0,
    max_tokens: 4096,
    response_format: provider === 'openai' ? { type: 'json_object' } : undefined,
  });

  if (p2aResult.error) {
    return { error: p2aResult.error };
  }

  let parsed;
  try {
    parsed = JSON.parse(p2aResult.content);
  } catch {
    console.error('[Phase2A] Failed to parse JSON:', p2aResult.content?.substring(0, 500));
    return { content: p2aResult.content };
  }

  // === Преобразование чеклиста в drivers/questions ===
  const checklist = parsed.checklist || [];
  console.log(`[Phase2A] Checklist received: ${checklist.length} items`);

  // Собираем текст клиента для серверной детекции forcedDrivers
  const sessionUserText = conversationMessages
    .filter(m => m.role === 'user')
    .map(m => typeof m.content === 'string' ? m.content :
      Array.isArray(m.content) ? m.content.filter(p => p.type === 'text').map(p => p.text).join(' ') : '')
    .join(' ');
  // forcedDrivers работают ТОЛЬКО по тексту клиента (не по AI-описанию)
  const forcedCodes = detectForcedDrivers(sessionUserText);
  const clientFacts = detectClientFacts(sessionUserText);
  console.log('[Phase2A] ForcedDrivers from client text:', Array.from(forcedCodes).join(', ') || 'none');
  console.log('[Phase2A] Client facts from text:', Array.from(clientFacts).join(', ') || 'none');

  // AI-чеклист — главный авторитет для каждого конкретного изделия
  const driverMap = new Map(); // code → {code, quantity?, value?, reason}
  const questions = []; // applies==="ask"

  // === Серверная защита: в текстовом режиме AI НЕ должен генерировать вопросы ===
  // Все вопросы клиенту задаются через TEXT_MODE_ESSENTIALS и MANDATORY_QUESTIONS.
  // Если AI всё же вернул "ask" — принудительно игнорируем.
  const blockAskInTextMode = (hasPhoto === false);

  // Серверная защита от двойного учёта: коды, уже включённые в базовую цену
  const baseExcludedCodes = getBaseExcludedDrivers(baseName);
  if (baseExcludedCodes.size > 0) {
    console.log(`[Phase2A] Base excluded codes for "${baseName}":`, Array.from(baseExcludedCodes).join(', '));
  }

  // Шаг 1: обрабатываем чеклист AI (он анализировал конкретное фото/описание)
  for (const item of checklist) {
    if (item.applies === true) {
      // Серверная защита: если AI ошибочно поставил true для кода, включённого в базу — игнорируем
      if (baseExcludedCodes.has(item.code)) {
        console.log(`[Phase2A] Blocked double-count: AI set ${item.code}=true, but it's included in base price for "${baseName}"`);
        continue;
      }
      if (!driverMap.has(item.code)) {
        const entry = { code: item.code, reason: item.reason };
        if (item.quantity != null) entry.quantity = item.quantity;
        if (item.value != null) entry.value = item.value;
        driverMap.set(item.code, entry);
      }
    } else if (item.applies === 'ask' && item.question) {
      // В текстовом режиме AI не должен задавать вопросы —
      // все вопросы идут через TEXT_MODE_ESSENTIALS/MANDATORY_QUESTIONS
      if (blockAskInTextMode) {
        console.log(`[Phase2A] Blocked AI question in text mode: ${item.code} — "${item.question}"`);
        // Драйвер остаётся неопределённым (false по умолчанию)
      } else {
        // Фото-режим: дедупликация — один вопрос на один код драйвера
        if (!questions.some(q => q.code === item.code)) {
          questions.push({ code: item.code, question: item.question });
        }
      }
    }
  }

  // Шаг 2: восстанавливаем сохранённые драйверы из предыдущего прохода
  for (const [code, saved] of savedDrivers) {
    if (!driverMap.has(code)) {
      driverMap.set(code, saved);
      console.log(`[Phase2A] Restored driver from previous pass: ${code}`);
    }
  }

  // Шаг 3: forcedDrivers — страховка: если клиент ЯВНО упомянул ключевое слово,
  // а AI поставил false — принудительно добавляем драйвер.
  // Фильтр 1: только коды из листа применимости данной основы.
  // Фильтр 2: исключения для двойного учёта (код применим, но уже в базе).
  const appSheetForForced = APPLICABILITY_LOOKUP[baseName.toLowerCase().trim()];
  const appRawForForced = appSheetForForced ? (SECTIONS[appSheetForForced] || '') : '';
  const applicableCodesForForced = new Set();
  if (appRawForForced) {
    for (const line of appRawForForced.split('\n')) {
      const fParts = line.split('|').map(s => s.trim());
      if (fParts.length >= 2 && fParts[0] !== 'Элемент') {
        applicableCodesForForced.add(fParts[1]);
      }
    }
  }
  const doubleCountExclusions = getBaseExcludedDrivers(baseName);
  for (const code of forcedCodes) {
    if (!driverMap.has(code) && !doubleCountExclusions.has(code) &&
        (applicableCodesForForced.size === 0 || applicableCodesForForced.has(code))) {
      driverMap.set(code, { code, reason: 'обнаружено в тексте клиента' });
      console.log(`[Phase2A] ForcedDriver override: ${code} (client explicitly mentioned)`);
    }
  }

  const drivers = Array.from(driverMap.values());
  console.log('[Phase2A] Drivers:', drivers.map(d => d.code).join(', '), '| Questions:', questions.map(q => q.code).join(', '));

  // === Принудительные обязательные вопросы из листа применимости ===
  const appSheetName = APPLICABILITY_LOOKUP[baseName.toLowerCase().trim()];
  const mandatoryQs = MANDATORY_QUESTIONS[appSheetName] || [];

  if (mandatoryQs.length > 0) {
    const sessionUserTextLower = sessionUserText.toLowerCase();

    const unanswered = mandatoryQs.filter(q => {
      if (drivers.some(d => d.code === q.code)) return false;
      if (isQuestionAnsweredByFacts(q, clientFacts, sessionUserTextLower)) return false;
      return true;
    });

    if (unanswered.length > 0) {
      for (const uq of unanswered) {
        const existingIdx = questions.findIndex(q => q.code === uq.code);
        if (existingIdx !== -1) {
          // Заменяем AI-вопрос на правильный обязательный (например, вместо "больше 56?" → "какой размер?")
          questions[existingIdx].question = uq.question;
        } else {
          questions.push({ code: uq.code, question: uq.question });
        }
      }
      console.log('[Phase2A] Mandatory questions added/replaced:', unanswered.map(q => q.code).join(', '));
    }
  }

  // === Серверное определение RAZMER56 по ответу клиента ===
  const parsedSize = parseSizeFromText(sessionUserText);
  if (parsedSize !== null) {
    // Размер найден — убираем RAZMER56 из вопросов и решаем программно
    const qIdx = questions.findIndex(q => q.code === 'RAZMER56');
    if (qIdx !== -1) questions.splice(qIdx, 1);

    if (parsedSize > 56) {
      if (!driverMap.has('RAZMER56')) {
        driverMap.set('RAZMER56', { code: 'RAZMER56', reason: `размер ${parsedSize} > 56` });
        console.log(`[Phase2A] RAZMER56 = true (parsed size: ${parsedSize})`);
      }
    } else {
      driverMap.delete('RAZMER56');
      console.log(`[Phase2A] RAZMER56 = false (parsed size: ${parsedSize})`);
    }
  }

  // Если есть вопросы (AI или обязательные) — вернуть их клиенту, расчёт НЕ делать
  if (questions.length > 0) {
    const filteredQuestions = questions.filter(q => !isQuestionAnsweredByFacts(q, clientFacts, sessionUserText.toLowerCase()));
    if (filteredQuestions.length !== questions.length) {
      console.log('[Phase2A] Removed already answered questions:', questions
        .filter(q => isQuestionAnsweredByFacts(q, clientFacts, sessionUserText.toLowerCase()))
        .map(q => q.code || q.key || q.question)
        .join(', '));
    }
    if (filteredQuestions.length === 0) {
      console.log('[Phase2A] All pending questions were already answered by client facts');
    } else {
    // Ограничиваем до 3 вопросов за раз (приоритет: mandatory, потом AI)
    const limitedQs = filteredQuestions.slice(0, 3);
    const qs = limitedQs.length > 1
      ? 'Подскажите, пожалуйста:\n' + limitedQs.map((q, i) => `${i + 1}. ${q.question}`).join('\n')
      : limitedQs[0].question;
    // Сохраняем найденные драйверы в серверном кэше, чтобы не потерять при повторном проходе
    const driverData = drivers.map(d => ({ code: d.code, quantity: d.quantity, value: d.value }));
    saveDriversToCache(conversationMessages, driverData);
    console.log('[Phase2A] Saved drivers to cache:', drivers.map(d => d.code).join(', '));
    return { content: qs };
    }
  }

  // Все драйверы определены — серверный расчёт
  const appliedDrivers = drivers.map(d => ({
    code: d.code,
    quantity: d.quantity,
    value: d.value,
  }));

  const calc = calculatePrice(basePrice, appliedDrivers);
  console.log(`[Phase2-Calc] Base: ${basePrice}, drivers: ${appliedDrivers.map(d => d.code).join(', ')}, total: ${calc.total}`);

  // Phase 2B: форматирование ответа (используем text-модель — фото не нужны)
  const textModel = provider === 'openai' ? OPENAI_MODEL_TEXT : GROQ_MODEL_TEXT;
  // Определяем, описал ли клиент изделие сам (текстом без фото, или текст + фото)
  const hasClientDescription = sessionUserText.trim().length > 30;
  const formatPrompt = FORMAT_RESPONSE_PROMPT(baseName, calc.total, parsed.description || '', hasClientDescription);
  const p2bMessages = [
    { role: 'system', content: formatPrompt },
  ];

  const p2bResult = await callLLM(provider, textModel, p2bMessages, {
    temperature: 0.3,
    max_tokens: 1024,
  });

  if (p2bResult.error) {
    // Fallback: простой ответ без AI-форматирования
    const desc = parsed.description || `Изделие: ${baseName}`;
    return { content: `${desc}\n\nОриентировочная стоимость пошива: от ${calc.total.toLocaleString('ru-RU')} руб.\n\nДля уточнения деталей и записи в ателье: +7 (915) 371-50-41.` };
  }

  return { content: p2bResult.content };
}

// === LLM API helper ===
async function callLLM(provider, model, messages, options = {}) {
  const apiUrl = provider === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';
  const apiKey = provider === 'openai' ? OPENAI_API_KEY : GROQ_API_KEY;

  const body = {
    model,
    messages,
    max_tokens: options.max_tokens || 1024,
    temperature: options.temperature ?? 0.2,
  };
  // Deterministic output: seed for OpenAI reproducibility
  if (provider === 'openai') {
    body.seed = 42;
  }
  if (options.response_format) {
    body.response_format = options.response_format;
  }

  const jsonBody = JSON.stringify(body);
  console.log(`[callLLM] model: ${model}, body size: ${jsonBody.length} bytes, msgs: ${messages.length}`);

  let response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: jsonBody,
    });
  } catch (fetchErr) {
    console.error(`[callLLM] Fetch error:`, fetchErr.message);
    return { error: 500, body: fetchErr.message };
  }

  if (!response.ok) {
    const errBody = await response.text();
    console.error(`[AI API Error][${provider}]`, response.status, errBody);
    return { error: response.status, body: errBody };
  }

  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content || '' };
}

function mskNow() {
  return DateTime.now().setZone('Europe/Moscow');
}

function buildFormParams(params) {
  const search = new URLSearchParams();

  const append = (key, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${key}[${index}]`, item));
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([childKey, childVal]) => {
        append(`${key}[${childKey}]`, childVal);
      });
      return;
    }
    search.append(key, String(value));
  };

  Object.entries(params).forEach(([key, value]) => append(key, value));
  return search;
}

async function bitrixRequest(method, params = {}, retries = 2) {
  if (!BITRIX_WEBHOOK_URL) {
    console.error('[Bitrix] BITRIX_WEBHOOK_URL not configured');
    return null;
  }

  const url = `${BITRIX_WEBHOOK_URL}${method}.json`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const body = buildFormParams(params);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('[Bitrix] invalid JSON', text.slice(0, 200));
        throw new Error('Invalid JSON');
      }

      if (data && data.error) {
        console.error('[Bitrix] API error', data.error, data.error_description || '');
        return null;
      }

      return data;
    } catch (err) {
      console.error('[Bitrix] request failed', err.message);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  return null;
}

async function sendCrmSiteRequest(payload, retries = 2) {
  if (!CRM_WEBHOOK_SECRET) {
    console.error('[CRM] CRM_WEBHOOK_SECRET not configured');
    return null;
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(CRM_REQUEST_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Webhook-Secret': CRM_WEBHOOK_SECRET,
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        console.error('[CRM] invalid JSON', text.slice(0, 200));
        throw new Error('Invalid JSON');
      }

      if (!response.ok || data?.error) {
        console.error('[CRM] API error', response.status, data?.error || text.slice(0, 200));
        return null;
      }

      return data;
    } catch (err) {
      console.error('[CRM] request failed', err.message);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  return null;
}

async function getBookedSlotsFromBitrix(startDate, endDate) {
  const booked = [];
  let start = 0;

  while (true) {
    const result = await bitrixRequest('crm.lead.list', {
      filter: {
        '%TITLE': '[ATELIER]',
        '!STATUS_ID': ['JUNK', 'CONVERTED'],
      },
      select: ['ID', 'TITLE', 'COMMENTS'],
      order: { ID: 'DESC' },
      start,
    });

    if (!result || !Array.isArray(result.result)) break;
    if (result.result.length === 0) break;

    for (const lead of result.result) {
      const comments = lead.COMMENTS || '';
      const match = comments.match(/SLOT_DATE:(\d{4}-\d{2}-\d{2})\|SLOT_TIME:(\d{2}:\d{2})/);
      if (match) {
        const slotDate = match[1];
        const slotTime = match[2];
        if (slotDate >= startDate && slotDate <= endDate) {
          booked.push(`${slotDate}|${slotTime}`);
        }
      }
    }

    start = result.next || 0;
    if (!start) break;
  }

  return booked;
}

function isValidSlot(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:00$/.test(time)) {
    return false;
  }

  const hour = parseInt(time.slice(0, 2), 10);
  if (hour < SLOT_START_HOUR || hour >= SLOT_END_HOUR) return false;
  if ((hour - SLOT_START_HOUR) % SLOT_DURATION_HOURS !== 0) return false;

  const now = mskNow();
  const slotDt = DateTime.fromISO(`${date}T${time}`, { zone: 'Europe/Moscow' });
  if (slotDt <= now) return false;

  const maxDate = now.plus({ days: SCHEDULE_DAYS });
  if (slotDt > maxDate) return false;

  return true;
}

function generateConfirmationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --- API Routes ---
app.post('/api/contact', async (req, res) => {
  const { name, phone, email, message, service, website } = req.body;
  if (website) {
    console.log('[Contact Form] Honeypot triggered, silently ignored');
    return res.json({ success: true });
  }
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  try {
    const fields = {
      TITLE: `Заявка с сайта: ${name}`,
      NAME: name,
      PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
      SOURCE_ID: 'WEB',
      COMMENTS: message || '',
    };
    if (email) {
      fields.EMAIL = [{ VALUE: email, VALUE_TYPE: 'WORK' }];
    }

    const bitrixData = await bitrixRequest('crm.lead.add', { fields });
    if (bitrixData?.result) {
      console.log(`[Contact Form] Lead created in Bitrix24, ID: ${bitrixData.result}`);
    } else {
      console.error('[Contact Form] Bitrix24 error:', JSON.stringify(bitrixData));
    }

    const crmData = await sendCrmSiteRequest({
      name,
      phone,
      email,
      contact: email || '',
      service: service || 'Заявка с контактной формы',
      message: message || '',
      source: 'site_contact',
    });
    if (crmData?.request?.id) {
      console.log(`[Contact Form] Request created in Atelier CRM, ID: ${crmData.request.id}`);
    }

    if (mailTransporter && NOTIFICATION_EMAIL) {
      try {
        await mailTransporter.sendMail({
          from: SMTP_USER,
          to: NOTIFICATION_EMAIL,
          subject: `Заявка с сайта: ${name}`,
          text: `Имя: ${name}\nТелефон: ${phone}\nEmail: ${email || '—'}\nСообщение: ${message || '—'}\nУслуга: ${service || '—'}`,
          html: `<h2>Заявка с сайта</h2><table style="border-collapse:collapse;width:100%;max-width:500px"><tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Имя</td><td style="padding:8px;border:1px solid #ddd">${name}</td></tr><tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Телефон</td><td style="padding:8px;border:1px solid #ddd">${phone}</td></tr><tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Email</td><td style="padding:8px;border:1px solid #ddd">${email || '—'}</td></tr><tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Сообщение</td><td style="padding:8px;border:1px solid #ddd">${(message || '—').replace(/\n/g, '<br>')}</td></tr><tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Услуга</td><td style="padding:8px;border:1px solid #ddd">${service || '—'}</td></tr></table>`,
        });
        console.log(`[Contact Form] Email sent to ${NOTIFICATION_EMAIL}`);
      } catch (mailErr) {
        console.error('[Contact Form] Email send error:', mailErr.message);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Contact Form] Failed to create Bitrix24 lead:', err);
    return res.json({ success: true });
  }
});

app.post('/api/transcribe', async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio) return res.status(400).json({ error: 'No audio' });
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'API key not configured' });

    const buffer = Buffer.from(audio, 'base64');
    if (buffer.length > 25 * 1024 * 1024) return res.status(400).json({ error: 'Audio too large' });

    const ext = (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
    const form = new FormData();
    form.append('file', blob, `voice.${ext}`);
    form.append('model', 'whisper-1');
    form.append('language', 'ru');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    const data = await response.json();
    if (data.text) return res.json({ text: data.text });
    return res.status(500).json({ error: 'Transcription failed' });
  } catch (err) {
    console.error('[Transcribe]', err);
    return res.status(500).json({ error: 'Transcription error' });
  }
});

app.post('/api/chat', async (req, res) => {
  let { messages, sessionId, assistantContext } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }
  if (messages.length > 50) {
    return res.status(400).json({ error: 'Слишком длинная переписка. Начните новый диалог.' });
  }
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg?.content && !(lastMsg?.images?.length > 0) && !lastMsg?.image) {
    return res.status(400).json({ error: 'Сообщение пустое.' });
  }
  if (lastMsg?.content && (typeof lastMsg.content !== 'string' || lastMsg.content.length > 2000)) {
    return res.status(400).json({ error: 'Сообщение слишком длинное.' });
  }

  messages = mergeChatSessionMessages(sessionId, messages);
  if (messages.length > 50) {
    return res.status(400).json({ error: 'Слишком длинная переписка. Начните новый диалог.' });
  }
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (payload?.reply && Array.isArray(messages)) {
      saveChatSessionMessages(sessionId, messages.concat({ role: 'assistant', content: payload.reply }));
    }
    return originalJson(payload);
  };

  // Найти границу последнего завершённого расчёта (ответ с ценой)
  let lastCalcIndex = -1;
  for (let idx = messages.length - 1; idx >= 0; idx--) {
    if (messages[idx].role === 'assistant' && typeof messages[idx].content === 'string' &&
        /ориентировочная стоимость|стоимость пошива|стоимость корректировки|стоит от/i.test(messages[idx].content)) {
      lastCalcIndex = idx;
      break;
    }
  }

  // Считаем фото только в текущей сессии расчёта (после последнего завершённого)
  let currentSessionImageCount = 0;
  for (let idx = lastCalcIndex + 1; idx < messages.length; idx++) {
    const m = messages[idx];
    if (m.images && Array.isArray(m.images)) currentSessionImageCount += m.images.length;
    else if (m.image) currentSessionImageCount += 1;
  }
  if (currentSessionImageCount > 10) {
    return res.status(400).json({ error: 'Слишком много фото для одного изделия (макс. 10). Начните новый расчёт.' });
  }

  // Валидация формата — только фото текущей сессии
  for (let idx = lastCalcIndex + 1; idx < messages.length; idx++) {
    const m = messages[idx];
    const imgs = m.images && Array.isArray(m.images) ? m.images : m.image ? [m.image] : [];
    for (const img of imgs) {
      if (typeof img !== 'string' || !img.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Неверный формат изображения.' });
      }
      if (img.length > 6 * 1024 * 1024) {
        return res.status(400).json({ error: 'Изображение слишком большое. Максимум 4 МБ.' });
      }
    }
  }

  const provider = AI_PROVIDER === 'openai'
    ? 'openai'
    : AI_PROVIDER === 'groq'
      ? 'groq'
      : OPENAI_API_KEY
        ? 'openai'
        : GROQ_API_KEY
          ? 'groq'
          : null;

  try {
    const lockedAssistantContext = resolveLockedAssistantContext(assistantContext);

    // Build conversation messages — фото только из текущей сессии расчёта
    const conversationMessages = [];
    for (let idx = 0; idx < messages.length; idx++) {
      const m = messages[idx];
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const imgs = m.images && Array.isArray(m.images) ? m.images : m.image ? [m.image] : [];

      if (imgs.length > 0 && role === 'user') {
        if (idx > lastCalcIndex) {
          // Текущая сессия расчёта — фото отправляем в AI
          const contentParts = [];
          if (m.content) {
            contentParts.push({ type: 'text', text: m.content });
          }
          for (const img of imgs) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: img },
            });
          }
          conversationMessages.push({ role, content: contentParts });
        } else {
          // Прошлый завершённый расчёт — фото заменяем текстовой меткой
          const text = (m.content || '')
            + `\n[Клиент прикрепил ${imgs.length} фото — расчёт выполнен в ответе ассистента ниже]`;
          conversationMessages.push({ role, content: text });
        }
      } else {
        conversationMessages.push({ role, content: m.content || '' });
      }
    }

    // Проверяем наличие фото только в текущей сессии расчёта
    const hasAnyImage = messages.some((m, idx) => idx > lastCalcIndex && ((m.images && m.images.length > 0) || !!m.image));
    const model = provider
      ? (provider === 'openai'
        ? (hasAnyImage ? OPENAI_MODEL_VISION : OPENAI_MODEL_TEXT)
        : (hasAnyImage ? GROQ_MODEL_VISION : GROQ_MODEL_TEXT))
      : null;

    // === Сообщения только текущей сессии расчёта (после последнего завершённого) ===
    const currentSessionMessages = lastCalcIndex >= 0
      ? conversationMessages.slice(lastCalcIndex + 1)
      : conversationMessages;

    // === УТИЛИТА: собрать тексты только текущей сессии ===
    const userTextParts = currentSessionMessages
      .filter(m => m.role === 'user')
      .map(m => extractMessageText(m).toLowerCase());
    const allUserTexts = userTextParts.join(' ');

    const allAssistantTexts = currentSessionMessages
      .filter(m => m.role === 'assistant')
      .map(m => extractMessageText(m).toLowerCase())
      .join(' ');

    const latestUserMessage = [...currentSessionMessages].reverse().find(m => m.role === 'user');
    const latestUserText = extractMessageText(latestUserMessage || {}).toLowerCase();
    const latestAssistantMessage = [...currentSessionMessages].reverse().find(m => m.role === 'assistant');
    const latestAssistantText = extractMessageText(latestAssistantMessage || {}).toLowerCase();

    const alterationResult = await handleAlterationFlow({
      allUserTexts,
      userTextParts,
      latestUserText,
      latestAssistantText,
      allAssistantTexts,
      assistantContext,
      hasAnyImage,
      currentSessionMessages,
      provider,
      model,
    });
    if (alterationResult?.reply) {
      console.log('[Alteration] Deterministic branch');
      return res.json({ reply: alterationResult.reply });
    }

    if (shouldAskIntentBeforeTailoring(allUserTexts, allAssistantTexts, hasAnyImage, lockedAssistantContext)) {
      return res.json({ reply: 'Скажите, вы хотите сшить новое изделие или скорректировать готовое?' });
    }

    if (!provider) {
      return res.status(500).json({ error: 'AI provider/API key not configured' });
    }

    // === ADDON-MODE: после расчёта клиент добавляет элементы ===
    if (lastCalcIndex >= 0 && !hasAnyImage) {
      const newGarmentRe = /плать|юбк|брюк|жакет|пиджак|пальто|куртк|блуз|рубаш|сорочк|топ\b|корсет|бомбер|парк[аеуой]|пуховик|дублен|жилет|худи|свитшот|лонгслив|футболк|плащ|трикотаж/i;
      const addonRe = /карман|капюшон|подкладк|молни|пуговиц|пояс|манжет|погон|декор|строчк|вышивк|рельеф|реглан|супат|пайет|бисер|кружев|шёлк|шелк|бархат|кож[аеуой]|замш|мех|воротник|шлиц|клетк|полоск|длинн|макси|нужн|добав|ещё|еще|плюс|также|белая|рисунок|застёжк|застежк|накладн/i;
      const isNewGarment = newGarmentRe.test(allUserTexts);
      const isAddonRequest = addonRe.test(allUserTexts);

      if (!isNewGarment && isAddonRequest) {
        // Получаем сохранённую классификацию из предыдущего расчёта
        const prevSessionMessages = messages.slice(0, lastCalcIndex + 1);
        const prevConvMessages = [];
        for (let idx = 0; idx < lastCalcIndex + 1; idx++) {
          const m = messages[idx];
          const role = m.role === 'assistant' ? 'assistant' : 'user';
          prevConvMessages.push({ role, content: m.content || '' });
        }
        const cachedClassification = getClassificationFromCache(prevConvMessages);

        if (cachedClassification) {
          console.log(`[Addon-Mode] Клиент добавляет элементы к: ${cachedClassification.base_name}`);
          // Собираем полный контекст: предыдущая сессия + новые сообщения
          const fullContextMessages = [];
          // Предыдущая сессия (без фото — текстовые метки)
          for (let idx = 0; idx <= lastCalcIndex; idx++) {
            const m = messages[idx];
            const role = m.role === 'assistant' ? 'assistant' : 'user';
            const imgs = m.images && Array.isArray(m.images) ? m.images : m.image ? [m.image] : [];
            if (imgs.length > 0 && role === 'user') {
              fullContextMessages.push({ role, content: (m.content || '') + '\n[Фото из предыдущего расчёта]' });
            } else {
              fullContextMessages.push({ role, content: m.content || '' });
            }
          }
          // Новые сообщения (после расчёта)
          for (let idx = lastCalcIndex + 1; idx < messages.length; idx++) {
            const m = messages[idx];
            const role = m.role === 'assistant' ? 'assistant' : 'user';
            const rawContent = m.content;
            const content = typeof rawContent === 'string' ? rawContent
              : (rawContent && typeof rawContent === 'object' && rawContent.content) ? rawContent.content
              : typeof rawContent === 'object' ? JSON.stringify(rawContent)
              : '';
            fullContextMessages.push({ role, content });
          }

          const { base_name, base_price, category } = cachedClassification;
          console.log(`[Addon-Mode] Phase2 with base: ${base_name} (${base_price}), sheet: ${category}`);

          // Сохраняем классификацию снова (обновляем timestamp)
          saveClassificationToCache(currentSessionMessages, cachedClassification);

          const phase2Result = await runPhase2(provider, model, base_name, base_price, category, fullContextMessages, false);
          return res.json({ reply: phase2Result.content || phase2Result });
        } else {
          console.log('[Addon-Mode] Кэш классификации не найден — пропускаем в обычный поток');
        }
      }
    }

    // === ПРИВЕТСТВИЕ: первое текстовое обращение без фото ===
    const userMsgCount = currentSessionMessages.filter(m => m.role === 'user').length;
    const assistantMsgCount = currentSessionMessages.filter(m => m.role === 'assistant').length;
    if (!lockedAssistantContext && !hasAnyImage && userMsgCount === 1 && assistantMsgCount === 0) {
      // Первое сообщение без фото — приветствие + ключевые вопросы
      const userText = allUserTexts.trim();
      // Проверяем, упомянул ли клиент конкретное изделие
      const mentionsItem = /плать|юбк|брюк|жакет|пиджак|пальто|куртк|блуз|рубаш|сорочк|топ\b|корсет|бомбер|парк[аеуой]|пуховик|дублен|жилет|худи|свитшот|лонгслив|футболк|плащ|трикотаж/i.test(userText);
      if (!mentionsItem) {
        console.log('[Welcome] Первое текстовое обращение без конкретного изделия');
        return res.json({ reply: 'Здравствуйте! Это ателье «15/13». Я помогу рассчитать стоимость пошива.\n\nПодскажите, какое изделие вы хотели бы пошить? Можете прислать фото или описать словами.' });
      }
      console.log('[Welcome] Первое текстовое обращение с упоминанием изделия — пропускаем в Phase 1');
    }

    // === Проверка: последнее сообщение содержит новое фото? ===
    const lastUserMessage = messages[messages.length - 1];
    const lastMsgHasImage = lastUserMessage && (
      (lastUserMessage.images && lastUserMessage.images.length > 0) || !!lastUserMessage.image
    );

    // === ЖЁСТКАЯ МАШИНА СОСТОЯНИЙ: ПИДЖАК (работает ДО любого вызова AI) ===
    // Если в переписке уже фигурирует пиджак (бот спрашивал тип) — сразу входим в машину.
    // НО: если последнее сообщение содержит НОВОЕ фото — пропускаем машину, идём в Phase 1.
    const pidzhakInBotHistory = /пиджак/.test(allAssistantTexts);
    const pidzhakInUserText = /пиджак|пиджек/.test(allUserTexts);

    if (!lockedAssistantContext && pidzhakInBotHistory && !lastMsgHasImage) {
      // Бот уже говорил про пиджак — мы в машине состояний, AI НЕ вызываем
      const hasExplicitType = /кежуал|кэжуал|casual|повседневн|на каждый день|каждодневн|под джинс|классическ|костюмн|деловой|офисн|bespoke/i.test(allUserTexts);

      if (!hasExplicitType) {
        console.log('[Пиджак] ШАГ 1 (повтор): тип не указан — спрашиваем');
        return res.json({ reply: 'Подскажите, вы хотите костюмный классический пиджак или кежуал — повседневный, под джинсы и т.д.?' });
      }

      const isClassic = /классическ|костюмн|деловой|офисн|bespoke/i.test(allUserTexts);
      const pidzhakType = isClassic ? 'классический' : 'кежуал';

      if (pidzhakType === 'кежуал') {
        if (hasAnyImage) {
          // ФОТО-режим: подкладка + размер → Phase 2A (старая логика, не трогаем)
          const botAskedDrivers = /подкладк/.test(allAssistantTexts) && /размер/.test(allAssistantTexts);
          if (!botAskedDrivers) {
            console.log('[Пиджак] ШАГ 2 (кежуал/фото): спрашиваем подкладку и размер');
            return res.json({ reply: 'Отлично, пиджак кежуал!\n\nУточним пару деталей:\n1. Нужна ли подкладка?\n2. Ваш размер больше 56?' });
          }
          const lastUserMsg = conversationMessages.filter(m => m.role === 'user').pop();
          const lastUserText = lastUserMsg
            ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content.toLowerCase()
              : Array.isArray(lastUserMsg.content) ? lastUserMsg.content.filter(p => p.type === 'text').map(p => p.text.toLowerCase()).join(' ') : '')
            : '';
          const lastHasLining = /подкладк|без подкладк|с подкладк|не нужн|нужна/.test(lastUserText);
          const lastHasSize = /размер|больше 56|меньше 56|до 56|не больше|больше|меньше|56|54|52|50|48|58|60|62/.test(lastUserText);
          const simpleAnswer = /^\s*(да|нет|ага|нее|не нужн|нужн)\s*/i.test(lastUserText);
          if (!lastHasLining && !lastHasSize && !simpleAnswer) {
            return res.json({ reply: 'Подскажите, пожалуйста:\n1. Нужна ли подкладка?\n2. Ваш размер больше 56?' });
          }
          console.log('[Пиджак] ШАГ 3 (кежуал/фото): запускаем расчёт');
          const p2Result = await runPhase2(provider, model, 'пиджак мужской кежуал', 65000, 'ЖАКЕТЫ', currentSessionMessages, hasAnyImage);
          if (p2Result.error) return res.status(500).json({ error: 'Не удалось получить ответ.' });
          return res.json({ reply: p2Result.content });
        } else {
          // ТЕКСТ-режим: тип определён, выходим из машины пиджака —
          // Essential Check Loop сам спросит материал, потом подкладку/размер
          console.log('[Пиджак] Кежуал (текст): передаём в Essential Check Loop');
          // Fall through — не возвращаем здесь, переходим к Phase 1 → Essential Loop
        }

      } else {
        // Классический пиджак
        if (hasAnyImage) {
          // ФОТО-режим: только размер
          const botAskedSize = /размер.*56|больше 56/.test(allAssistantTexts);
          if (!botAskedSize) {
            console.log('[Пиджак] ШАГ 2 (классический/фото): спрашиваем размер');
            return res.json({ reply: 'Отлично, классический пиджак! Подкладка уже включена в стоимость.\n\nПодскажите, ваш размер больше 56?' });
          }
          console.log('[Пиджак] ШАГ 3 (классический/фото): запускаем расчёт');
          const p2Result = await runPhase2(provider, model, 'пиджак мужской классический', 120000, 'ЖАКЕТЫ', currentSessionMessages, hasAnyImage);
          if (p2Result.error) return res.status(500).json({ error: 'Не удалось получить ответ.' });
          return res.json({ reply: p2Result.content });
        } else {
          // ТЕКСТ-режим: передаём в Essential Check Loop
          console.log('[Пиджак] Классический (текст): передаём в Essential Check Loop');
          // Fall through
        }
      }
    }

    let isPidzhakDetected = false;
    let classification = lockedAssistantContext
      ? lockedAssistantContext.classification
      : getClassificationFromCache(currentSessionMessages);

    if (lockedAssistantContext) {
      console.log('[PageContext] Locked base:', JSON.stringify(lockedAssistantContext.classification));
    } else if (classification) {
      console.log('[Phase1] Reusing cached base classification:', JSON.stringify(classification));
    } else {
      // === PHASE 1: Base Detection (JSON classification) ===
      const phase1Messages = [
        { role: 'system', content: BASE_DETECTION_PROMPT },
        ...currentSessionMessages,
      ];

      const phase1Options = {
        temperature: 0.0,
        max_tokens: 1024,
      };
      if (provider === 'openai') {
        phase1Options.response_format = { type: 'json_object' };
      }

      console.log('[Phase1] Sending to model:', model, 'provider:', provider, 'msgs:', phase1Messages.length, 'hasImage:', hasAnyImage);
      const phase1Result = await callLLM(provider, model, phase1Messages, phase1Options);
      console.log('[Phase1] Raw response:', phase1Result.content?.substring(0, 500) || 'NO CONTENT', 'error:', phase1Result.error || 'none');
      if (phase1Result.error) {
        if (phase1Result.error === 429) {
          return res.status(429).json({ error: 'Превышен лимит запросов. Пожалуйста, попробуйте позже.' });
        }
        if (phase1Result.error === 401 || phase1Result.error === 403) {
          return res.status(500).json({ error: 'Неверный API-ключ AI-провайдера.' });
        }
        return res.status(500).json({ error: 'Не удалось получить ответ. Попробуйте позже.' });
      }

      // === ПЕРЕХВАТ ПИДЖАКА после Phase 1 (первое сообщение — только фото) ===
      try {
        classification = JSON.parse(phase1Result.content);
        if (classification.base_name && classification.base_name.toLowerCase().includes('пиджак')) {
          isPidzhakDetected = true;
        }
        if (classification.category === 'ЖАКЕТЫ' && classification.base_name && /пиджак/.test(classification.base_name.toLowerCase())) {
          isPidzhakDetected = true;
        }
      } catch {
        // JSON не распарсился — проверяем сырой текст
        const rawText = phase1Result.content.toLowerCase();
        if (/пиджак/.test(rawText)) {
          isPidzhakDetected = true;
        }
        if (!isPidzhakDetected) {
          console.error('[Phase1] Failed to parse JSON:', phase1Result.content);
          return res.json({ reply: phase1Result.content });
        }
      }
    }
    if (!lockedAssistantContext) {
      classification = forceEveningDressClassification(classification, allUserTexts);
    }

    // Если Phase 1 определила пиджак — входим в машину (ШАГ 1: спрашиваем тип)
    if (!lockedAssistantContext && isPidzhakDetected) {
      const hasExplicitType = /кежуал|кэжуал|casual|повседневн|на каждый день|каждодневн|под джинс|классическ|костюмн|деловой|офисн|bespoke/i.test(allUserTexts);
      if (!hasExplicitType) {
        const pidzhakQuestion = hasAnyImage
          ? 'На фотографиях представлен мужской пиджак. Подскажите, вы хотите костюмный классический пиджак или кежуал — повседневный, под джинсы и т.д.?'
          : 'Отлично, пиджак! Подскажите, вы хотите костюмный классический пиджак или кежуал — повседневный, под джинсы и т.д.?';
        console.log('[Пиджак] ШАГ 1: AI определил пиджак — спрашиваем тип');
        return res.json({ reply: pidzhakQuestion });
      }
    }

    console.log('[Phase1] Classification:', JSON.stringify(classification));

    // Validate/fix base_price using lookup table
    const PRICE_LOOKUP = {
      'топ': 14000,
      'корсет': 50000,
      'полукорсет (бельевой)': 35000,
      'платье футляр без рукава': 25000,
      'платье прямое с рукавом': 30000,
      'платье с отрезной талией': 35000,
      'платье вечернее(свадебное)': 80000,
      'юбка прямая до колена': 15000,
      'юбка по косой': 20000,
      'блуза': 27000,
      'брюки женские два кармана': 26000,
      'брюки спорт': 19000,
      'джинсы': 28000,
      'жилет': 24000,
      'жакет шанель на органзе': 55000,
      'жакет': 48000,
      'пальто': 52000,
      'плащ': 45000,
      'сорочка (рубашка)': 25000,
      'классические брюки': 30000,
      'лонгслив трикотажный': 14000,
      'худи с капюшеном': 20000,
      'свитшот трикотажный': 14000,
      'футболка': 8000,
      'куртка без подкладки': 40000,
      'пиджак мужской кежуал': 65000,
      'пиджак мужской классический': 120000,
      'бейсболка': 10000,
      'бомбер мужской без подкладки': 35000,
      'парка без подкладки': 48000,
      'сорочка мужская': 27000,
      'пальто зимнее': 125000,
      'жилет пуховой (короткий)': 40000,
      'пуховик короткий': 65000,
      'пуховик длинный': 85000,
      'дубленка короткая': 80000,
      'куртка на меховой подкладке короткая': 150000,
    };
    if (classification.base_determined && classification.base_name) {
      const lookupKey = classification.base_name.toLowerCase().trim();
      if (PRICE_LOOKUP[lookupKey]) {
        classification.base_price = PRICE_LOOKUP[lookupKey];
      }
    }

    // === GATE: Is base determined? ===
    if (!classification.base_determined) {
      // Base NOT determined → return ONLY the question to user (NO internal analysis)
      const question = classification.question
        || 'Подскажите, пожалуйста, детали изделия, чтобы я мог определить базовую основу для расчёта.';
      return res.json({ reply: question });
    }

    // Сохраняем классификацию в кэш для addon-mode
    saveClassificationToCache(currentSessionMessages, classification);

    // === PHASE 2: Calculation with confirmed base ===
    const { base_name, base_price, category } = classification;
    console.log(`[Phase2] Confirmed base: ${base_name} (${base_price}), sheet: ${category}`);
    const clientFacingBaseName = getClientFacingBaseName(base_name, allUserTexts);

    // === TEXT MODE ONLY: «Свободное описание» — один раз после определения базы ===
    const FREE_DESC_MARKER = 'расскажите, что для вас важно';
    const shouldAskForFreeDescription = !hasAnyImage
      && !allAssistantTexts.includes(FREE_DESC_MARKER)
      && !hasAnyGarmentDetail(allUserTexts)
      && !(category === 'ПЛАТЬЯ' && hasMeaningfulDressDescription(allUserTexts));
    if (shouldAskForFreeDescription) {
      const garmentLabel = clientFacingBaseName;
      const reply = `Отлично, ${garmentLabel}! Расскажите, что для вас важно — материал, длина, детали. Потом задам пару уточняющих вопросов и рассчитаю стоимость пошива.`;
      console.log(`[TextLoop] Free description step for ${category}`);
      return res.json({ reply });
    }

    // === TEXT MODE ONLY: Essential Check Loop (перед запуском Phase 2A) ===
    // Для фото-режима этот блок полностью пропускается — hasAnyImage === true
    if (!hasAnyImage) {
      const essentials = TEXT_MODE_ESSENTIALS[category] || [];
      const clientFacts = detectClientFacts(allUserTexts);
      const allUserTextsLower = allUserTexts.toLowerCase();

      // Проверяем каждый essential: был ли ответ клиента по answerPattern
      const unansweredEssentials = essentials.filter(e => !isQuestionAnsweredByFacts(e, clientFacts, allUserTextsLower));

      if (unansweredEssentials.length > 0) {
        // Спрашиваем не более 2 essential за раз, начиная с первого неотвеченного
        const toAsk = unansweredEssentials.slice(0, 2);
        // Если бот уже задавал этот вопрос, но ответ не распознан — retryQuestion
        const questions = toAsk.map(e => {
          const alreadyAsked = allAssistantTexts.toLowerCase().includes(e.question.toLowerCase().slice(0, 30));
          return alreadyAsked ? e.retryQuestion : e.question;
        }).join('\n\n');
        const knownDressDetails = category === 'ПЛАТЬЯ'
          ? getKnownDressDetailsSummary(allUserTexts).filter((detail) => {
            if (/выпускн/.test(clientFacingBaseName) && detail === 'для выпускного') return false;
            if (/свадебн/.test(clientFacingBaseName) && detail === 'для свадьбы') return false;
            return true;
          })
          : [];
        const knownPrefix = knownDressDetails.length
          ? `Понял: ${clientFacingBaseName}, ${knownDressDetails.join(', ')}.\n\n`
          : '';
        const reply = `${knownPrefix}${questions}`;
        console.log(`[TextLoop] Unanswered essentials: ${unansweredEssentials.map(e => e.key).join(', ')}`);
        return res.json({ reply });
      }

      // Essentials закрыты → проверяем MANDATORY (подкладка, размер)
      const appSheetNameForMandatory = APPLICABILITY_LOOKUP[base_name.toLowerCase().trim()];
      const mandatoryQs = MANDATORY_QUESTIONS[appSheetNameForMandatory] || [];
      const unansweredMandatory = mandatoryQs.filter(q => !isQuestionAnsweredByFacts(q, clientFacts, allUserTextsLower));

      if (unansweredMandatory.length > 0) {
        const qs = unansweredMandatory.map((q, i) => `${i + 1}. ${q.question}`).join('\n');
        const reply = unansweredMandatory.length === 1
          ? unansweredMandatory[0].question
          : `Подскажите, пожалуйста:\n${qs}`;
        console.log(`[TextLoop] Unanswered mandatory: ${unansweredMandatory.map(q => q.code).join(', ')}`);
        return res.json({ reply });
      }

      // Всё собрано — Phase 2A только считает, не задаёт вопросы
      console.log('[TextLoop] All essentials + mandatory answered → Phase 2A');
    }

    // Передаём реальное значение hasPhoto: true = есть фото, false = текстовый режим
    // Phase 2A в текстовом режиме определит драйверы по тексту клиента, а не по фото
    const phase2HasPhoto = hasAnyImage;
    const phase2Result = await runPhase2(provider, model, base_name, base_price, category, currentSessionMessages, phase2HasPhoto);

    if (phase2Result.error) {
      return res.status(500).json({ error: 'Не удалось получить ответ. Попробуйте позже.' });
    }

    return res.json({ reply: phase2Result.content });
  } catch (error) {
    console.error('[Chat Error]', error?.message || error);
    return res.status(500).json({ error: 'Не удалось получить ответ. Попробуйте позже.' });
  }
});

app.get('/api/schedule', async (req, res) => {
  const schedule = [];
  let booked = [];

  try {
    const now = mskNow();
    const today = now.startOf('day');
    const endDate = today.plus({ days: SCHEDULE_DAYS });

    booked = await getBookedSlotsFromBitrix(today.toISODate(), endDate.toISODate());
    if (!Array.isArray(booked)) booked = [];
  } catch (err) {
    console.error('[Schedule] Bitrix error', err?.message || err);
    booked = [];
  }

  const now = mskNow();
  const today = now.startOf('day');

  for (let i = 0; i < SCHEDULE_DAYS; i += 1) {
    const day = today.plus({ days: i });
    const dateStr = day.toISODate();

    const slots = [];
    let hour = SLOT_START_HOUR;
    while (hour < SLOT_END_HOUR) {
      const endHour = hour + SLOT_DURATION_HOURS;
      const timeStr = `${String(hour).padStart(2, '0')}:00`;
      const endTimeStr = `${String(endHour).padStart(2, '0')}:00`;

      let isPast = false;
      if (day.hasSame(now, 'day') && hour <= now.hour) {
        isPast = true;
      }

      const key = `${dateStr}|${timeStr}`;
      const available = !booked.includes(key) && !isPast;

      slots.push({
        id: `${dateStr}-${timeStr}`,
        time: timeStr,
        end_time: endTimeStr,
        available,
      });

      hour += SLOT_DURATION_HOURS;
    }

    schedule.push({ date: dateStr, slots });
  }

  return res.json(schedule);
});

app.post('/api/bookings', async (req, res) => {
  const { name = '', phone = '', email = '', date = '', time = '', format_type = '' } = req.body || {};

  if (!name || !phone || !date || !time || !format_type) {
    return res.status(400).json({
      status: 'error',
      detail: 'Пожалуйста, заполните все обязательные поля: имя, телефон, email, дату и время игры.',
      error_type: 'missing_fields',
    });
  }

  if (!isValidSlot(date, time)) {
    return res.status(400).json({
      status: 'error',
      detail: 'Выбранное время недоступно для бронирования. Пожалуйста, выберите другой слот.',
      error_type: 'invalid_time',
    });
  }

  if (!FORMAT_LABELS[format_type]) {
    return res.status(400).json({
      status: 'error',
      detail: 'Выбран неверный формат игры. Пожалуйста, выберите из доступных вариантов.',
      error_type: 'invalid_format',
    });
  }

  if (!BITRIX_WEBHOOK_URL) {
    return res.status(500).json({
      status: 'error',
      detail: 'CRM не настроена. Пожалуйста, попробуйте позже.',
      error_type: 'system_error',
    });
  }

  const formatLabel = FORMAT_LABELS[format_type];
  const startDt = DateTime.fromISO(`${date}T${time}`, { zone: 'Europe/Moscow' });
  const endDt = startDt.plus({ hours: SLOT_DURATION_HOURS });

  const today = mskNow();
  const endDate = today.plus({ days: SCHEDULE_DAYS });
  let booked = await getBookedSlotsFromBitrix(today.toISODate(), endDate.toISODate());
  if (!Array.isArray(booked)) booked = [];

  const key = `${date}|${time}`;
  if (booked.includes(key)) {
    return res.status(400).json({
      status: 'error',
      detail: 'Это время уже занято. Пожалуйста, выберите другой свободный слот.',
      error_type: 'slot_already_booked',
    });
  }

  const confirmationCode = generateConfirmationCode();
  const bookingId = randomUUID();

  const leadTitle = `[ATELIER] ${formatLabel} — ${name} (Kod: ${confirmationCode})`;
  const leadComments = `SLOT_DATE:${date}|SLOT_TIME:${time}\n\nKod: ${confirmationCode}\nName: ${name}\nPhone: ${phone}\nEmail: ${email}\nFormat: ${formatLabel}\nDate: ${date}\nTime: ${time} — ${endDt.toFormat('HH:mm')}`;

  const result = await bitrixRequest('crm.lead.add', {
    fields: {
      TITLE: leadTitle,
      NAME: name,
      PHONE: [{ VALUE: phone, VALUE_TYPE: 'MOBILE' }],
      EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
      COMMENTS: leadComments,
      SOURCE_ID: 'WEB',
      STATUS_ID: 'NEW',
    },
  });

  if (!result || !result.result) {
    return res.json({
      status: 'error',
      detail: 'Не удалось создать бронирование в системе. Пожалуйста, попробуйте еще раз или свяжитесь с администратором.',
      error_type: 'system_error',
    });
  }

  const crmData = await sendCrmSiteRequest({
    name,
    phone,
    email,
    contact: email || '',
    service: `Бронирование: ${formatLabel}`,
    message: `Дата: ${date}\nВремя: ${time} — ${endDt.toFormat('HH:mm')}\nФормат: ${formatLabel}\nКод: ${confirmationCode}`,
    source: 'site_booking',
  });
  if (crmData?.request?.id) {
    console.log(`[Bookings] Request created in Atelier CRM, ID: ${crmData.request.id}`);
  }

  return res.json({
    id: bookingId,
    confirmation_code: confirmationCode,
    name,
    phone,
    email,
    date,
    time,
    format_type,
    status: 'confirmed',
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    totalBookings: 0,
    services: {
      tailoring: 'Индивидуальный пошив',
      alterations: 'Корректировка изделий',
      restoration: 'Реставрация',
    },
    uptime: process.uptime(),
  });
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ателье 15/13 server running on port ${PORT}`);
});
