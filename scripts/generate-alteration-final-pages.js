import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { menAlterationPagesMatrix } from '../seo/menAlterationPagesMatrix.js';
import { womenAlterationPagesMatrix } from '../seo/womenAlterationPagesMatrix.js';

const TEMPLATE_FOLDER = 'women-jackets';
const FINAL_PAGES_DIR = join(process.cwd(), 'public', 'final-pages');
const TEMPLATE_DIR = join(FINAL_PAGES_DIR, TEMPLATE_FOLDER);

function formatPrice(price) {
  if (!price) return 'по прайс-листу';
  return `${new Intl.NumberFormat('ru-RU').format(price)} ₽`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function highlight(text, phrases) {
  let result = escapeHtml(text);
  for (const phrase of phrases) {
    result = result.replace(escapeHtml(phrase), `<strong>${escapeHtml(phrase)}</strong>`);
  }
  return result;
}

function seoTitle(page) {
  return `Корректировка ${page.genitive} в Москве — Ателье 15/13`;
}

function seoDescription(page) {
  return `Корректировка ${page.genitive} в Ателье 15/13: ${page.keywords.slice(0, 4).join(', ')}. Аккуратная подгонка изделия по фигуре.`;
}

function breadcrumbs(page) {
  const genderTitle = page.gender === 'women' ? 'Женщинам' : 'Мужчинам';
  const genderRoute = `/services/alterations/${page.gender}`;
  return [
    { name: 'Главная', item: '/' },
    { name: 'Услуги', item: '/services' },
    { name: 'Корректировка изделий', item: '/services/alterations' },
    { name: genderTitle, item: genderRoute },
    { name: page.title, item: page.route },
  ];
}

function breadcrumbHtml(page) {
  const items = breadcrumbs(page);
  return `<nav aria-label="Хлебные крошки" class="service-breadcrumbs bg-background border-b border-border/50">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <ol class="service-breadcrumbs__list">
${items.map((item, index) => {
  if (index === items.length - 1) {
    return `                        <li class="service-breadcrumbs__item" aria-current="page"><span class="service-breadcrumbs__current">${escapeHtml(item.name)}</span></li>`;
  }
  return `                        <li class="service-breadcrumbs__item"><a href="${item.item}" class="service-breadcrumbs__link">${escapeHtml(item.name)}</a></li>`;
}).join('\n')}
                    </ol>
                </div>
            </nav>`;
}

function breadcrumbJson(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${page.route}#breadcrumb`,
    itemListElement: breadcrumbs(page).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

function faq(page) {
  return [
    {
      question: `Что входит в корректировку ${page.genitive}?`,
      strongPhrases: [`корректировку ${page.genitive}`],
      answer: 'В работу может входить посадка по фигуре, изменение длины, подшив, ушивание, восстановление деталей и аккуратная обработка материала. Точный объём мастер определяет после осмотра изделия.',
    },
    {
      question: `Можно ли выполнить работу «${page.keywords[0]}»?`,
      strongPhrases: [page.keywords[0]],
      answer: `Да, такую задачу можно обсудить на примерке. Мастер смотрит ткань, конструкцию, подкладку, старые швы и предлагает безопасный способ корректировки.`,
    },
    {
      question: 'Когда можно назвать точную стоимость?',
      strongPhrases: ['точную стоимость'],
      answer: 'Точная стоимость зависит от материала, конструкции, количества участков и сложности обработки. Обычно её можно назвать после осмотра изделия и примерки.',
    },
    {
      question: `Какие запросы относятся к этой услуге?`,
      strongPhrases: ['запросы'],
      answer: `К странице относятся задачи: ${page.keywords.join(', ')}.`,
    },
  ];
}

function faqHtml(items) {
  return items.map((item) => `                        <details class="service-faq rounded-md border border-border bg-background p-6">
                            <summary class="cursor-pointer"><h3>${highlight(item.question, item.strongPhrases)}</h3></summary>
                            <p class="text-sm text-muted-foreground leading-relaxed mt-4">${escapeHtml(item.answer)}</p>
                        </details>`).join('\n\n');
}

function listHtml(items) {
  return items.map((item) => `                                <li>${escapeHtml(item)}</li>`).join('\n');
}

function pageData(page) {
  const faqItems = faq(page);
  return {
    title: page.title,
    path: page.route,
    canonical: page.route,
    seoTitle: seoTitle(page),
    seoDescription: seoDescription(page),
    h1: `Корректировка ${page.genitive}`,
    introText: page.intro,
    heroUsp: 'Подгоним готовое изделие по фигуре, длине и деталям с аккуратной обработкой.',
    works: page.works,
    keywords: page.keywords,
    accentTitle: page.accentTitle,
    accentText: page.accentText,
    priceNote: 'Стоимость корректировки рассчитывается после осмотра изделия и зависит от материала, конструкции, объёма работ и сложности обработки.',
    processSteps: [
      'Осмотр изделия и обсуждение задачи',
      'Примерка и фиксация нужных изменений',
      'Согласование объёма работ и стоимости',
      'Корректировка изделия мастером',
      'Финальная примерка и проверка посадки',
    ],
    faq: faqItems,
    parentPath: `/services/alterations/${page.gender}`,
  };
}

function renderPage(page) {
  const data = pageData(page);
  const faqItems = data.faq;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${page.route}#webpage`,
      url: page.route,
      name: data.seoTitle,
      description: data.seoDescription,
      inLanguage: 'ru-RU',
      isPartOf: { '@id': '/#website' },
      breadcrumb: { '@id': `${page.route}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: '/images/hero-atelier.png' },
    },
    breadcrumbJson(page),
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: data.h1,
      description: data.seoDescription,
      url: page.route,
      provider: { '@id': '/#+atelier1513' },
      areaServed: { '@type': 'City', name: 'Москва' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ];

  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>${escapeHtml(data.seoTitle)}</title>
    <meta name="description" content="${escapeHtml(data.seoDescription)}">
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="canonical" href="${page.route}">
    <meta property="og:title" content="${escapeHtml(data.seoTitle)}">
    <meta property="og:description" content="${escapeHtml(data.seoDescription)}">
    <meta property="og:url" content="${page.route}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:image" content="/images/hero-atelier.png">
    <meta property="og:image:alt" content="${escapeHtml(data.h1)} — Ателье 15/13, Москва" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(data.seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(data.seoDescription)}" />
    <meta name="twitter:image" content="/images/hero-atelier.png" />
    <link rel="icon" type="image/png" href="./favicon.png">
    <link rel="preload" as="image" href="./images/hero-atelier.png" fetchpriority="high" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" crossorigin href="./assets/index-B-os_Paw.css">
    <link rel="stylesheet" href="./assets/services-menu.css?v=3">
    <link rel="stylesheet" href="./assets/service-page.css?v=5">
    <script defer src="./assets/services-menu.js?v=4"></script>
    <script defer src="./assets/service-page.js?v=2"></script>
    <style>html, body { overflow-x: hidden; }</style>
${jsonLd.map((item) => `    <script type="application/ld+json">${JSON.stringify(item)}</script>`).join('\n')}
</head>
<body>
    <div id="root">
        <nav class="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between gap-4 h-16">
                    <a href="/" class="font-serif text-xl sm:text-2xl tracking-wide">Ателье 15/13</a>
                    <div class="hidden md:flex items-center gap-6">
                        <a href="/consultant" class="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">Консультант</a>
                        <a href="/services" class="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">Услуги</a>
                        <a href="/pricing" class="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">Прайс</a>
                        <a href="/process" class="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">Процесс</a>
                        <a href="/about" class="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">О нас</a>
                        <a href="/location" class="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">Локация</a>
                        <a href="/contacts" class="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">Контакты</a>
                        <a href="/contacts" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground shadow h-9 px-4 py-2">Записаться</a>
                    </div>
                </div>
            </div>
        </nav>

        <div class="mobile-spacer"></div>
        <main class="service-page min-h-screen pt-16 bg-background">
            <section class="service-hero relative min-h-screen flex items-center overflow-hidden">
                <div class="absolute inset-0">
                    <img src="./images/hero-atelier.png" alt="${escapeHtml(data.h1)} — Ателье 15/13"
                        class="w-full h-full object-cover" width="1920" height="1080" fetchpriority="high" decoding="async">
                    <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40"></div>
                    <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30"></div>
                </div>
                <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div class="service-hero__copy max-w-3xl">
                        <p class="service-hero__eyebrow inline-block text-xs tracking-[0.35em] uppercase text-white/70 border border-white/25 px-4 py-2 rounded-md mb-6">Корректировка изделий</p>
                        <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-white leading-tight mb-6">${escapeHtml(data.h1)}</h1>
                        <p class="service-hero__lead text-base sm:text-lg text-white/75 max-w-2xl mb-6 leading-relaxed">${escapeHtml(data.introText)}</p>
                        <p class="service-hero__usp">${escapeHtml(data.heroUsp)}</p>
                        <div class="flex flex-wrap gap-4">
                            <a href="/contacts" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-white text-black shadow h-11 px-8 py-3">Записаться на примерку</a>
                            <a href="#pricing" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium text-white border border-white/30 bg-white/10 backdrop-blur-sm h-11 px-8 py-3">Уточнить стоимость</a>
                        </div>
                    </div>
                </div>
            </section>

            ${breadcrumbHtml(page)}

            <section class="py-24 sm:py-32 bg-background">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="max-w-3xl mb-20">
                        <p class="service-section-eyebrow text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4"><strong>Осмотр и посадка</strong></p>
                        <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-light mb-5">Работы по корректировке</h2>
                        <p class="text-muted-foreground leading-relaxed">На странице собраны основные задачи, с которыми приходят в ателье: от простой подгонки до сложной работы с подкладкой, кожей, мехом и фабричной отделкой.</p>
                    </div>

                    <div class="service-approach">
                        <div class="service-approach__grid">
                            <article class="service-approach__visual" aria-label="Корректировка изделий">
                                <div class="service-approach__media">
                                    <img src="./images/measurement.png" alt="${escapeHtml(data.h1)} — примерка и корректировка" width="1200" height="1400" loading="lazy" decoding="async">
                                </div>
                                <div class="service-approach__visual-body">
                                    <h3 class="service-approach__visual-title">${escapeHtml(data.accentTitle)}</h3>
                                    <p class="service-approach__visual-text">${escapeHtml(data.accentText)}</p>
                                </div>
                            </article>

                            <div class="service-approach__cards" aria-label="Работы по корректировке">
${data.works.map((work) => `                                <article class="service-approach__card">
                                    <h3 class="service-approach__title"><strong>${escapeHtml(work)}</strong></h3>
                                    <p class="service-approach__text">Мастер проверяет конструкцию изделия на примерке и выбирает способ обработки, чтобы сохранить посадку и внешний вид.</p>
                                </article>`).join('\n')}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="service-cta py-16 sm:py-20 bg-card" style="padding-top: 60px;">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
                    <div class="service-cta__card rounded-md border border-border bg-background p-8 sm:p-10">
                        <div class="service-cta__grid">
                            <div>
                                <p class="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3"><strong>Запись</strong></p>
                                <h2 class="font-serif text-3xl sm:text-4xl font-light mb-3">Запишитесь на примерку</h2>
                                <p class="text-muted-foreground leading-relaxed">Мастер посмотрит изделие на фигуре, оценит ткань, подкладку, старые швы и предложит корректный объём работ.</p>
                            </div>
                            <div class="service-cta__actions">
                                <a href="/contacts" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground shadow h-11 px-8 py-3">Записаться</a>
                                <a href="tel:+79153715041" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-border bg-background h-11 px-8 py-3">Позвонить</a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="py-24 sm:py-32 bg-card">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="max-w-3xl mb-14">
                        <p class="service-section-eyebrow text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4"><strong>Почему ателье</strong></p>
                        <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-light mb-5">Корректировка без потери формы изделия</h2>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <article class="rounded-md border border-border bg-background p-8">
                            <h3 class="service-text-card-title font-serif text-xl mb-3"><strong>Посадка</strong></h3>
                            <p class="text-sm text-muted-foreground leading-relaxed">Фиксируем изменения на примерке, чтобы изделие село по фигуре и не потеряло баланс.</p>
                        </article>
                        <article class="rounded-md border border-border bg-background p-8">
                            <h3 class="service-text-card-title font-serif text-xl mb-3"><strong>Материал</strong></h3>
                            <p class="text-sm text-muted-foreground leading-relaxed">Учитываем ткань, подкладку, кожу, мех, трикотаж, старые швы и возможность повторной обработки.</p>
                        </article>
                        <article class="rounded-md border border-border bg-background p-8">
                            <h3 class="service-text-card-title font-serif text-xl mb-3"><strong>Аккуратность</strong></h3>
                            <p class="text-sm text-muted-foreground leading-relaxed">Сохраняем внешний вид изделия, фабричную отделку и чистую линию края там, где это возможно.</p>
                        </article>
                    </div>
                </div>
            </section>

            <section id="pricing" class="py-24 sm:py-32 bg-background">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
                        <div>
                            <div class="max-w-3xl mb-14 service-price">
                                <p class="service-price__eyebrow text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4"><strong>Стоимость</strong></p>
                                <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-light mb-5">Стоимость <strong>${escapeHtml(formatPrice(page.priceFrom))}</strong></h2>
                                <p class="text-muted-foreground leading-relaxed">${escapeHtml(data.priceNote)}</p>
                                <div class="service-price__cta-row">
                                    <a href="/contacts" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground shadow h-11 px-8 py-3">Записаться на примерку</a>
                                </div>
                            </div>
                        </div>
                        <div class="rounded-md border border-border bg-card p-8">
                            <h3 class="font-serif text-2xl mb-6">Что влияет на цену</h3>
                            <div class="service-factor-list">
                                <p class="service-factor"><strong>Материал</strong><br>Ткань, кожа, мех, трикотаж, подкладка и фурнитура требуют разной технологии обработки.</p>
                                <p class="service-factor"><strong>Конструкция</strong><br>На стоимость влияет доступ к швам, наличие подкладки, декоративных деталей и фабричной отделки.</p>
                                <p class="service-factor"><strong>Объём работ</strong><br>Учитываем количество участков, которые нужно изменить, и необходимость дополнительных примерок.</p>
                                <p class="service-factor"><strong>Срочность</strong><br>Сроки согласуются после осмотра изделия и оценки загрузки мастеров.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="py-24 sm:py-32 bg-card">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="max-w-3xl mb-14">
                        <p class="service-section-eyebrow text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4"><strong>Процесс</strong></p>
                        <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-light mb-5">Как проходит корректировка</h2>
                    </div>
                    <ol class="service-process-list">
${data.processSteps.map((step) => `                        <li><p>${escapeHtml(step)}</p></li>`).join('\n')}
                    </ol>
                </div>
            </section>

            <section class="py-24 sm:py-32 bg-background">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
                        <div>
                            <div class="max-w-3xl mb-14">
                                <p class="service-section-eyebrow text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4"><strong>Запросы</strong></p>
                                <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-light mb-5">Какие задачи закрывает страница</h2>
                                <p class="text-muted-foreground leading-relaxed">В текст страницы включены реальные формулировки, по которым клиенты ищут корректировку изделий.</p>
                            </div>
                        </div>
                        <div class="rounded-md border border-border bg-card p-8">
                            <nav aria-label="SEO-запросы страницы">
                                <ol class="service-materials-list">
${data.keywords.map((keyword) => `                                    <li>${escapeHtml(keyword)}</li>`).join('\n')}
                                </ol>
                            </nav>
                        </div>
                    </div>
                </div>
            </section>

            <section class="py-24 sm:py-32 bg-card">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="max-w-3xl mb-14">
                        <p class="service-section-eyebrow text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4"><strong>FAQ</strong></p>
                        <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-light mb-5">Частые вопросы</h2>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
${faqHtml(faqItems)}
                    </div>
                </div>
            </section>

            <div class="service-sticky-cta" role="region" aria-label="Быстрая запись">
                <button class="service-sticky-cta__close" aria-label="Закрыть">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
                <div class="service-sticky-cta__inner">
                    <a href="/contacts" class="service-sticky-cta__primary">Записаться</a>
                    <a href="tel:+79153715041" class="service-sticky-cta__secondary">Позвонить</a>
                </div>
            </div>
        </main>

        <footer class="py-12 bg-background border-t border-border/50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <a href="/" class="font-serif text-lg tracking-wide">Ателье 15/13</a>
                    <p class="text-xs text-muted-foreground">© 2025 Ателье 15/13. Все права защищены.</p>
                    <div class="flex items-center gap-4">
                        <span class="text-xs text-muted-foreground">Москва</span>
                        <span class="text-xs text-muted-foreground">|</span>
                        <a class="text-xs text-muted-foreground hover:text-foreground transition-colors" href="tel:+79153715041">+7 (915) 371-50-41</a>
                    </div>
                </div>
            </div>
        </footer>
    </div>
</body>
</html>`;
}

function generatePage(page) {
  const dir = join(FINAL_PAGES_DIR, page.folder);
  if (!existsSync(TEMPLATE_DIR)) {
    throw new Error(`Template folder not found: ${TEMPLATE_DIR}`);
  }
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(TEMPLATE_DIR, dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), renderPage(page), 'utf8');
  writeFileSync(join(dir, 'page-data.json'), JSON.stringify(pageData(page), null, 2), 'utf8');
}

const pages = [
  ...womenAlterationPagesMatrix.map((page) => ({ ...page, gender: 'women' })),
  ...menAlterationPagesMatrix.map((page) => ({ ...page, gender: 'men' })),
];

for (const page of pages) {
  generatePage(page);
}

console.log(`Generated ${pages.length} alteration final pages`);
