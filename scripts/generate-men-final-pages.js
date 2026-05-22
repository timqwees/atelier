import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { menFinalPagesMatrix } from '../seo/menFinalPagesMatrix.js';

const TEMPLATE_FOLDER = 'women-jackets';
const FINAL_PAGES_DIR = join(process.cwd(), 'public', 'final-pages');
const TEMPLATE_DIR = join(FINAL_PAGES_DIR, TEMPLATE_FOLDER);

const CASES = {
  'men-shirts': {
    genitive: 'мужских сорочек',
    singular: 'мужская сорочка',
    accusative: 'мужскую сорочку',
    adjective: 'индивидуальная',
    intro: 'Мужская сорочка строится вокруг посадки по плечу и груди, чистой планки, воротника и манжет. Мы настраиваем форму под фигуру, ткань и сценарий носки.',
    materials: ['Хлопок', 'Поплин', 'Оксфорд', 'Батист', 'Лён', 'Смесовые сорочечные ткани', 'Пуговицы', 'Фурнитура'],
    focus: ['воротник', 'манжеты', 'планку', 'посадку'],
  },
  'men-classic-trousers': {
    genitive: 'классических мужских брюк',
    singular: 'классические брюки',
    accusative: 'классические брюки',
    adjective: 'индивидуальные',
    intro: 'Классические брюки требуют точной посадки по талии, бёдрам и линии шага. Мы настраиваем длину, стрелки, карманы и баланс силуэта.',
    materials: ['Костюмная шерсть', 'Креп', 'Хлопок', 'Лён', 'Габардин', 'Смесовые ткани', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['посадку', 'линию шага', 'стрелки', 'карманы'],
  },
  'men-casual-jackets': {
    genitive: 'мужских пиджаков Casual',
    singular: 'пиджак Casual',
    accusative: 'пиджак Casual',
    adjective: 'индивидуальный',
    intro: 'Пиджак Casual строится мягче классического: важны плечо, посадка, лацканы, подкладка и комфорт в повседневной носке.',
    materials: ['Костюмная шерсть', 'Лён', 'Хлопок', 'Твид', 'Креп', 'Смесовые ткани', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['мягкую конструкцию', 'плечо', 'лацканы', 'посадку'],
  },
  'men-bespoke-jackets': {
    genitive: 'мужских классических пиджаков',
    singular: 'классический пиджак',
    accusative: 'классический пиджак',
    adjective: 'индивидуальный',
    intro: 'Классический пиджак строится как строгая конструкция с точной посадкой, сложным плечом, лацканами и вниманием к ручной работе.',
    materials: ['Костюмная шерсть', 'Кашемир', 'Твид', 'Лён', 'Хлопок', 'Конский волос', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['классическую конструкцию', 'плечо', 'лацканы', 'ручную работу'],
  },
  'men-coats': {
    genitive: 'мужских пальто',
    singular: 'пальто',
    accusative: 'пальто',
    adjective: 'индивидуальное',
    intro: 'Мужское пальто строится с учётом плеча, длины, воротника, подкладки и плотности ткани. Важно сохранить чистую линию поверх нижних слоёв.',
    materials: ['Шерсть', 'Кашемир', 'Драп', 'Твид', 'Альпака', 'Смесовые пальтовые ткани', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['плечо', 'длину', 'воротник', 'подкладку'],
  },
  'men-jackets': {
    genitive: 'мужских курток',
    singular: 'мужская куртка',
    accusative: 'мужскую куртку',
    adjective: 'индивидуальная',
    intro: 'Мужская куртка строится под нужный объём, длину и функциональность. Мы продумываем молнию, карманы, капюшон и посадку.',
    materials: ['Плащёвая ткань', 'Хлопок', 'Нейлон', 'Деним', 'Кожа', 'Шерсть', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['объём', 'молнию', 'карманы', 'капюшон'],
  },
  'men-bombers': {
    genitive: 'мужских бомберов',
    singular: 'бомбер',
    accusative: 'бомбер',
    adjective: 'индивидуальный',
    intro: 'Бомбер строится вокруг посадки, манжет, молнии и эластичного низа. Мы подбираем материал и объём под нужный образ.',
    materialsQuestion: 'Из чего лучше всего шить мужской бомбер?',
    materialsStrongPhrases: ['мужской бомбер'],
    materials: ['Шерсть', 'Плащёвая ткань', 'Нейлон', 'Кожа', 'Хлопок', 'Трикотаж для манжет', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['манжеты', 'молнию', 'посадку', 'материал'],
  },
  'men-parkas': {
    genitive: 'мужских парок',
    singular: 'парка',
    accusative: 'парку',
    adjective: 'индивидуальная',
    intro: 'Парка строится как функциональная верхняя одежда с капюшоном, карманами, кулисками и защитными материалами.',
    materials: ['Плащёвая ткань', 'Хлопок с пропиткой', 'Нейлон', 'Мембранные ткани', 'Подкладочные ткани', 'Утеплитель', 'Шнуры и фурнитура', 'Молнии'],
    focus: ['капюшон', 'карманы', 'кулиски', 'длину'],
  },
  'men-down-jackets': {
    genitive: 'мужских пуховиков',
    singular: 'пуховик',
    accusative: 'пуховик',
    adjective: 'индивидуальный',
    intro: 'Пуховик строится с учётом утепления, стёжки, объёма и длины. Мы продумываем капюшон, фурнитуру и посадку поверх зимних слоёв.',
    materials: ['Плащёвая ткань', 'Нейлон', 'Мембранные ткани', 'Утеплитель', 'Пуховой пакет', 'Подкладочные ткани', 'Молнии', 'Фурнитура'],
    focus: ['утепление', 'стёжку', 'объём', 'капюшон'],
  },
  'men-shearling-coats': {
    genitive: 'мужских дубленок',
    singular: 'дубленка',
    accusative: 'дубленку',
    adjective: 'индивидуальная',
    intro: 'Дубленка требует внимательной работы с кожей, мехом, посадкой и обработкой края. Мы продумываем длину, воротник, застёжку и фурнитуру.',
    materials: ['Овчина', 'Кожа', 'Замша', 'Мех', 'Дублёные материалы', 'Фурнитура', 'Молнии', 'Пуговицы'],
    focus: ['кожу и мех', 'посадку', 'длину', 'фурнитуру'],
  },
  'men-hoodies': {
    genitive: 'мужских худи',
    singular: 'худи',
    accusative: 'худи',
    adjective: 'индивидуальное',
    intro: 'Худи строится вокруг капюшона, объёма, кармана и плотности трикотажа. Мы настраиваем посадку, длину и детали под нужный образ.',
    materials: ['Футер', 'Хлопковый трикотаж', 'Флис', 'Трикотаж с начёсом', 'Кашкорсе', 'Шнуры', 'Люверсы', 'Фурнитура'],
    focus: ['капюшон', 'карман', 'манжеты', 'плотность трикотажа'],
  },
  'men-sweatshirts': {
    genitive: 'мужских свитшотов',
    singular: 'свитшот',
    accusative: 'свитшот',
    adjective: 'индивидуальный',
    intro: 'Свитшот строится из трикотажа с учётом объёма, манжет, горловины и длины. Мы подбираем посадку под фигуру и нужную плотность изделия.',
    materials: ['Футер', 'Хлопковый трикотаж', 'Флис', 'Трикотаж с начёсом', 'Кашкорсе', 'Рибана', 'Смесовый трикотаж', 'Нити для трикотажа'],
    focus: ['объём', 'манжеты', 'горловину', 'посадку'],
  },
  'men-t-shirts': {
    genitive: 'мужских футболок',
    singular: 'футболка',
    accusative: 'футболку',
    adjective: 'индивидуальная',
    intro: 'Футболка строится из трикотажа с учётом горловины, длины, рукава и посадки. Даже базовое изделие требует точных пропорций и аккуратной обработки.',
    materials: ['Хлопковый трикотаж', 'Вискозный трикотаж', 'Джерси', 'Рибана', 'Кулирка', 'Смесовый трикотаж', 'Нити для трикотажа', 'Отделочные материалы'],
    focus: ['горловину', 'длину', 'рукав', 'посадку'],
  },
};

function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU').format(price);
}

function assistantName(folder) {
  return folder.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function seoTitle(copy) {
  return `Пошив ${copy.genitive} на заказ в Москве — Ателье 15/13`;
}

function seoDescription(page, copy, priceText) {
  return `Индивидуальный пошив ${copy.genitive} по меркам: ${page.angle}. Стоимость пошива от ${priceText} ₽.`;
}

function breadcrumbHtml(page) {
  return `<nav aria-label="Хлебные крошки" class="service-breadcrumbs bg-background border-b border-border/50">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <ol class="service-breadcrumbs__list">
                        <li class="service-breadcrumbs__item"><a href="/" class="service-breadcrumbs__link">Главная</a></li>
                        <li class="service-breadcrumbs__item"><a href="/services" class="service-breadcrumbs__link">Услуги</a></li>
                        <li class="service-breadcrumbs__item"><a href="/services/custom-tailoring" class="service-breadcrumbs__link">Индивидуальный пошив</a></li>
                        <li class="service-breadcrumbs__item"><a href="/services/custom-tailoring/men" class="service-breadcrumbs__link">Мужчинам</a></li>
                        <li class="service-breadcrumbs__item" aria-current="page"><span class="service-breadcrumbs__current">${page.title}</span></li>
                    </ol>
                </div>
            </nav>`;
}

function breadcrumbJson(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${page.route}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: '/' },
      { '@type': 'ListItem', position: 2, name: 'Услуги', item: '/services' },
      { '@type': 'ListItem', position: 3, name: 'Индивидуальный пошив', item: '/services/custom-tailoring' },
      { '@type': 'ListItem', position: 4, name: 'Мужчинам', item: '/services/custom-tailoring/men' },
      { '@type': 'ListItem', position: 5, name: page.title, item: page.route },
    ],
  };
}

function faq(page, copy, priceText) {
  return [
    {
      question: `Что важно в пошиве ${copy.genitive}?`,
      strongPhrases: [copy.genitive],
      answer: `В пошиве ${copy.genitive} важны ${copy.focus.join(', ')}. Эти детали определяют посадку, внешний вид и итоговую стоимость изделия.`,
    },
    {
      question: `Сколько стоит пошив ${copy.genitive}?`,
      strongPhrases: [`пошив ${copy.genitive}`],
      answer: `Стоимость пошива ${copy.genitive} начинается от ${priceText} ₽. Точная цена зависит от ткани, конструкции, подкладки, деталей, сроков и количества примерок.`,
    },
    {
      question: `Можно ли сшить ${copy.accusative} по фото?`,
      strongPhrases: [`${copy.accusative} по фото`],
      answer: 'Да, фото или референс можно использовать как основу для силуэта, пропорций, деталей и настроения будущего изделия. Конструкция адаптируется под фигуру и материал.',
    },
    {
      question: copy.materialsQuestion || `Какие ткани подходят для ${copy.genitive}?`,
      strongPhrases: copy.materialsStrongPhrases || ['ткани подходят'],
      answer: `Для ${copy.genitive} подбираем материалы под сезон, силуэт и сценарий носки. Часто используем: ${copy.materials.slice(0, 5).join(', ')}.`,
    },
  ];
}

function faqHtml(items) {
  return items.map((item) => {
    let question = item.question;
    item.strongPhrases.forEach((phrase) => {
      question = question.replace(phrase, `<strong>${phrase}</strong>`);
    });
    return `                        <details class="service-faq rounded-md border border-border bg-background p-6">
                            <summary class="cursor-pointer"><h3>${question}</h3></summary>
                            <p class="text-sm text-muted-foreground leading-relaxed mt-4">${item.answer}</p>
                        </details>`;
  }).join('\n\n');
}

function materialsHtml(materials) {
  return `<ol class="service-materials-list">\n${materials.map((material) => `                                    <li>${material}</li>`).join('\n')}\n                                </ol>`;
}

function galleryImage(page) {
  return page.galleryImage ? './images/gallery-main.png' : './images/hero-atelier.png';
}

function copyGalleryImage(page, dest) {
  if (!page.galleryImage) return;
  const source = join(process.cwd(), 'public', page.galleryImage.replace(/^\//, ''));
  if (!existsSync(source)) throw new Error(`Missing gallery image: ${page.galleryImage}`);
  cpSync(source, join(dest, 'images', 'gallery-main.png'));
}

function pageData(page, copy, priceText) {
  return {
    title: page.title,
    slug: page.route.split('/').pop(),
    path: page.route,
    type: 'garment-category',
    seoTitle: seoTitle(copy),
    seoDescription: seoDescription(page, copy, priceText),
    canonical: page.route,
    h1: `Индивидуальный пошив ${copy.genitive}`,
    introText: copy.intro,
    heroUsp: 'Рассчитайте предварительную стоимость пошива на сайте и приходите на консультацию с готовым ориентиром.',
    availableOptions: [
      `Пошив ${copy.genitive} по меркам`,
      'Работа с фото, эскизом или референсом',
      'Настройка посадки, длины и деталей под фигуру',
      'Подбор ткани, подкладки и фурнитуры',
      'Примерки и финальная корректировка изделия',
    ],
    materials: copy.materials,
    galleryItems: [
      { title: 'Посадка', description: `Настраиваем ${copy.focus[1] || 'посадку'} под фигуру и сценарий носки.`, image: galleryImage(page) },
      { title: 'Пропорции', description: `Работаем с ${copy.focus[0]} и общим балансом изделия.`, image: '/images/measurement.png' },
      { title: 'Материалы', description: `Подбираем ткани и фурнитуру под задачу: ${copy.materials.slice(0, 4).join(', ')}.`, image: '/images/fabrics.png' },
      { title: 'Работа с референсом', description: 'Адаптируем фото или идею под фигуру, материал и комфорт.', image: '/images/price-tailoring.png' },
      { title: 'Финальная примерка', description: 'Проверяем посадку, обработку и удобство в движении.', image: '/images/transformation.png' },
    ],
    whyItems: [
      { title: 'Посадка', description: `${copy.adjective[0].toUpperCase()}${copy.adjective.slice(1)} ${copy.singular} строится по меркам, чтобы изделие выглядело собранно и было комфортным.` },
      { title: 'Материалы', description: `Ткань, подкладка и фурнитура подбираются под ${copy.focus.join(', ')}.` },
      { title: 'Уровень luxury brand', description: 'Фокус на чистой линии, аккуратной обработке и спокойном премиальном результате без перегруза.' },
    ],
    pricingFactors: [
      { title: 'Конструкция', description: `На стоимость влияют ${copy.focus.join(', ')}, а также сложность лекал и примерок.` },
      { title: 'Ткань и подкладка', description: `Разные материалы требуют разной обработки: ${copy.materials.slice(0, 5).join(', ')}.` },
      { title: 'Детали и отделка', description: 'Карманы, застёжки, воротники, рукава, пояс, декоративные элементы и ручная обработка рассчитываются отдельно.' },
      { title: 'Сроки и примерки', description: 'Итоговая стоимость зависит от срочности, количества примерок и уровня детализации.' },
    ],
    priceFrom: page.priceFrom,
    priceNote: `Стоимость пошива ${copy.genitive} — от ${priceText} ₽. Итоговая цена зависит от ткани, конструкции, подкладки, деталей, сроков и количества примерок.`,
    processSteps: [
      `Консультация: обсуждаем ${copy.focus.join(', ')} и сценарий носки`,
      'Мерки и материалы: подбираем ткань, подкладку, фурнитуру и детали',
      'Конструирование: создаём основу изделия под фигуру и выбранные пропорции',
      'Пошив и примерки: уточняем посадку, длину, объём и детали',
      'Финальная готовность: проверяем посадку, обработку и комфорт в движении',
    ],
    faq: faq(page, copy, priceText),
    ctaLabel: 'Записаться на консультацию',
    relatedPages: [],
    children: [],
    parentPath: '/services/custom-tailoring/men',
    depth: 3,
  };
}

function jsonLdScripts(page, copy, priceText) {
  const scripts = [
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': '/#+atelier1513',
      name: 'Ателье 15/13',
      address: { '@type': 'PostalAddress', addressLocality: 'Москва', streetAddress: 'ул. Петровка 15/13, стр. 3', addressCountry: 'RU' },
      telephone: '+7 (915) 371-50-41',
      areaServed: { '@type': 'City', name: 'Москва' },
      image: ['/images/hero-atelier.png'],
      url: '/',
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': '/#website', name: 'Ателье 15/13', url: '/', inLanguage: 'ru-RU' },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${page.route}#webpage`,
      url: page.route,
      name: seoTitle(copy),
      description: seoDescription(page, copy, priceText),
      inLanguage: 'ru-RU',
      isPartOf: { '@id': '/#website' },
      about: { '@id': '/#+atelier1513' },
      breadcrumb: { '@id': `${page.route}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: '/images/hero-atelier.png' },
    },
    breadcrumbJson(page),
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: `Индивидуальный пошив ${copy.genitive}`,
      description: seoDescription(page, copy, priceText),
      url: page.route,
      provider: { '@id': '/#+atelier1513' },
      areaServed: { '@type': 'City', name: 'Москва' },
      offers: { '@type': 'Offer', price: page.priceFrom, priceCurrency: 'RUB', availability: 'https://schema.org/InStock', url: page.route },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq(page, copy, priceText).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
  return scripts.map((script) => `    <script\n        type="application/ld+json">${JSON.stringify(script)}</script>`).join('\n');
}

function renderHtml(page, copy) {
  const priceText = formatPrice(page.priceFrom);
  const title = seoTitle(copy);
  const description = seoDescription(page, copy, priceText);
  const assistant = assistantName(page.folder);
  const faqItems = faq(page, copy, priceText);

  let html = readFileSync(join(TEMPLATE_DIR, 'index.html'), 'utf8');
  html = html
    .replace(/    <script\s+type="application\/ld\+json">[\s\S]*?FAQPage[\s\S]*?<\/script>/, jsonLdScripts(page, copy, priceText))
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"\s+content=".*?" \/>/s, `<meta name="description"\n        content="${description}" />`)
    .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${page.route}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"\s+content=".*?" \/>/s, `<meta property="og:description"\n        content="${description}" />`)
    .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${page.route}" />`)
    .replace(/<meta property="og:image:alt" content=".*?" \/>/, `<meta property="og:image:alt" content="${title.replace(' в Москве — Ателье 15/13', '')} — Ателье 15/13, Москва" />`)
    .replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description"\s+content=".*?" \/>/s, `<meta name="twitter:description"\n        content="${description}" />`)
    .replace(/alt="Пошив .*?"/, `alt="${title}"`)
    .replace(/(<article class="service-approach__visual"[\s\S]*?<div class="service-approach__media">\s*<img src=")(.*?)(")/, `$1${galleryImage(page)}$3`)
    .replace(/Индивидуальный пошив женских жакетов/g, `Индивидуальный пошив ${copy.genitive}`)
    .replace(/Женский жакет требует точной работы с плечом, посадкой, лацканами и подкладкой\. Мы выстраиваем конструкцию под фигуру, ткань и нужный сценарий носки\./g, copy.intro)
    .replace(/от 48 000 ₽/g, `от ${priceText.replace(' ', ' ')} ₽`)
    .replace(/Напишите: хочу женский жакет\.\.\./g, `Напишите: хочу ${copy.accusative}...`)
    .replace(/Опишите женский жакет или прикрепите фото референса\. Я задам уточняющие вопросы и посчитаю ориентир по пошиву\./g, `Опишите ${copy.accusative} или прикрепите фото референса. Я задам уточняющие вопросы и посчитаю ориентир по пошиву.`)
    .replace(/data-women-jackets-assistant/g, `data-${assistant}-assistant`)
    .replace(/<nav aria-label="Хлебные крошки"[\s\S]*?<\/nav>/, breadcrumbHtml(page))
    .replace(/Примеры пошива женских жакетов:[^<]*Это ориентиры для выбора силуэта, материалов и уровня деталей\./g, `Примеры пошива ${copy.genitive}: ${page.angle}. Это ориентиры для выбора силуэта, материалов и уровня деталей.`)
    .replace(/Ателье 15\/13 — индивидуальный пошив женских жакетов/g, `Ателье 15/13 — индивидуальный пошив ${copy.genitive}`)
    .replace(/Мы показываем не «портфолио ради портфолио», а подход: плечо, посадку, лацканы, подкладку и аккуратная обработка\./g, `Мы показываем не «портфолио ради портфолио», а подход: ${copy.focus.join(', ')} и аккуратная обработка.`)
    .replace(/Настраиваем посадку под фигуру, материал и сценарий носки\./g, `Настраиваем ${copy.focus[1] || 'посадку'} под фигуру, материал и сценарий носки.`)
    .replace(/Подбираем ткань, подкладку и фурнитуру под задачу: Костюмная шерсть, Твид, Креп, Лён\./g, `Подбираем ткань, подкладку и фурнитуру под задачу: ${copy.materials.slice(0, 4).join(', ')}.`)
    .replace(/Берём референс как направление и адаптируем плечо, посадку, лацканы, подкладку под фигуру\./g, `Берём референс как направление и адаптируем ${copy.focus.join(', ')} под фигуру.`)
    .replace(/Обсудим плечо, посадку, лацканы, подкладку, материалы и сроки\. Предварительная стоимость — на основе задачи и сложности конструкции\./g, `Обсудим ${copy.focus.join(', ')}, материалы и сроки. Предварительная стоимость — на основе задачи и сложности конструкции.`)
    .replace(/Индивидуальный женский жакет строится по меркам, чтобы изделие выглядело собранно и было комфортным\./g, `${copy.adjective[0].toUpperCase()}${copy.adjective.slice(1)} ${copy.singular} строится по меркам, чтобы изделие выглядело собранно и было комфортным.`)
    .replace(/Ткань, подкладка и фурнитура подбираются под плечо, посадку, лацканы, подкладку\./g, `Ткань, подкладка и фурнитура подбираются под ${copy.focus.join(', ')}.`)
    .replace(/Корректируем плечо, посадку, лацканы, подкладку, чтобы изделие выглядело аккуратно и было комфортным в движении\./g, `Корректируем ${copy.focus.join(', ')}, чтобы изделие выглядело аккуратно и было комфортным в движении.`)
    .replace(/Стоимость пошива женских жакетов — от [\d\s ]+ ₽\. Итоговая цена зависит от ткани, конструкции, подкладки, деталей, сроков и количества примерок\./g, `Стоимость пошива ${copy.genitive} — от ${priceText} ₽. Итоговая цена зависит от ткани, конструкции, подкладки, деталей, сроков и количества примерок.`)
    .replace(/На стоимость влияют плечо, посадку, лацканы, подкладку, а также сложность лекал и примерок\./g, `На стоимость влияют ${copy.focus.join(', ')}, а также сложность лекал и примерок.`)
    .replace(/Разные материалы требуют разной обработки: Костюмная шерсть, Твид, Креп, Лён, Хлопок\./g, `Разные материалы требуют разной обработки: ${copy.materials.slice(0, 5).join(', ')}.`)
    .replace(/Консультация: обсуждаем плечо, посадку, лацканы, подкладку и сценарий носки/g, `Консультация: обсуждаем ${copy.focus.join(', ')} и сценарий носки`)
    .replace(/Материалы подбираются под сезон, силуэт, сценарий носки и желаемую пластику изделия\./g, 'Материалы подбираются под сезон, силуэт, сценарий носки и желаемую пластику изделия.')
    .replace(/<ol class="service-materials-list">[\s\S]*?<\/ol>/, materialsHtml(copy.materials))
    .replace(/<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">\s*<details class="service-faq[\s\S]*?<\/div>\s*<\/div>\s*<\/section>\s*<div class="service-sticky-cta"/, `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">\n\n${faqHtml(faqItems)}\n\n                    </div>\n                </div>\n            </section>\n\n            <div class="service-sticky-cta"`);

  return html;
}

function renderJs(page, copy) {
  const assistant = assistantName(page.folder);
  let js = readFileSync(join(TEMPLATE_DIR, 'assets', 'service-page.js'), 'utf8');
  js = js
    .replaceAll('data-women-jackets-assistant', `data-${assistant}-assistant`)
    .replaceAll('women-jackets-assistant-session-id', `${assistant}-assistant-session-id`)
    .replaceAll('women-jackets-', `${assistant}-`)
    .replaceAll('Фото для оценки: женский жакет', `Фото для оценки: ${copy.singular}`);
  return js;
}

let generated = 0;
for (const page of menFinalPagesMatrix) {
  const copy = CASES[page.folder];
  if (!copy) throw new Error(`Missing copy for ${page.folder}`);
  const dest = join(FINAL_PAGES_DIR, page.folder);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(TEMPLATE_DIR, dest, { recursive: true });
  copyGalleryImage(page, dest);
  rmSync(join(dest, 'source'), { recursive: true, force: true });
  const priceText = formatPrice(page.priceFrom);
  writeFileSync(join(dest, 'index.html'), renderHtml(page, copy));
  writeFileSync(join(dest, 'assets', 'service-page.js'), renderJs(page, copy));
  writeFileSync(join(dest, 'page-data.json'), JSON.stringify(pageData(page, copy, priceText), null, 2) + '\n');
  generated += 1;
}

console.log(`Generated ${generated} men final pages`);
