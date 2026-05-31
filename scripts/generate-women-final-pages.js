import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { womenFinalPagesMatrix } from '../seo/womenFinalPagesMatrix.js';

const TEMPLATE_FOLDER = 'cut-off-waist-dresses';
const FINAL_PAGES_DIR = join(process.cwd(), 'public', 'final-pages');
const TEMPLATE_DIR = join(FINAL_PAGES_DIR, TEMPLATE_FOLDER);

const CASES = {
  'women-tops': {
    genitive: 'женских топов',
    singular: 'топ',
    accusative: 'топ',
    adjective: 'индивидуальный',
    intro:
      'Топ строится вокруг мягкой посадки, линии выреза, бретелей или рукава и аккуратной обработки края. Мы подбираем ткань и пропорции так, чтобы изделие работало как самостоятельная вещь или часть образа.',
    materials: ['Шёлк', 'Атлас', 'Вискоза', 'Хлопок', 'Креп', 'Трикотаж', 'Кружево', 'Кожа'],
    focus: ['вырез', 'посадку', 'бретели или рукав', 'обработку края'],
  },
  'dresses-from-photo': {
    genitive: 'платьев по фото',
    singular: 'платье по фото',
    accusative: 'платье по фото',
    adjective: 'индивидуальное',
    intro:
      'Платье по фото создаётся не как слепая копия, а как адаптация референса под фигуру, материал и задачу. Мы сохраняем идею силуэта и деталей, но выстраиваем посадку по вашим меркам.',
    materials: ['Креп', 'Вискоза', 'Хлопок', 'Шёлк', 'Атлас', 'Кружево', 'Смесовые плательные ткани', 'Подкладочные ткани'],
    focus: ['референс', 'посадку', 'пропорции', 'материал'],
  },
  'brand-reference-dresses': {
    genitive: 'платьев по референсу бренда',
    singular: 'платье по референсу бренда',
    accusative: 'платье по референсу бренда',
    adjective: 'индивидуальное',
    intro:
      'Платье по референсу бренда создаётся с вниманием к пропорциям, посадке и характеру оригинального образа. Мы адаптируем идею под фигуру, ткань и комфорт в носке.',
    materials: ['Креп', 'Костюмная шерсть', 'Вискоза', 'Шёлк', 'Атлас', 'Тонкая шерсть', 'Смесовые плательные ткани', 'Подкладочные ткани'],
    focus: ['референс бренда', 'посадку', 'пропорции', 'материал'],
  },
  'straight-skirts': {
    genitive: 'прямых юбок',
    singular: 'прямая юбка',
    accusative: 'прямую юбку',
    adjective: 'индивидуальная',
    intro:
      'Прямая юбка строится на чистой посадке по талии и бёдрам. Важны длина, шлица, подкладка и баланс силуэта, чтобы изделие выглядело собранно и было комфортным в движении.',
    materials: ['Креп', 'Костюмная шерсть', 'Вискоза', 'Хлопок', 'Деним', 'Твид', 'Смесовые ткани', 'Подкладочные ткани'],
    focus: ['посадку по талии', 'линию бёдер', 'длину', 'шлицу'],
  },
  'bias-cut-skirts': {
    genitive: 'юбок по косой',
    singular: 'юбка по косой',
    accusative: 'юбку по косой',
    adjective: 'индивидуальная',
    intro:
      'Юбка по косой строится с учётом пластики ткани и мягкого движения силуэта. Такой крой требует точного баланса, чтобы изделие красиво ложилось по фигуре.',
    materials: ['Шёлк', 'Сатин', 'Вискоза', 'Креп', 'Атлас', 'Тонкая шерсть', 'Смесовые ткани', 'Подкладочные ткани'],
    focus: ['косой крой', 'пластику ткани', 'посадку', 'движение'],
  },
  'mini-skirts': {
    genitive: 'мини-юбок',
    singular: 'мини-юбка',
    accusative: 'мини-юбку',
    adjective: 'индивидуальная',
    intro:
      'Мини-юбка требует точной посадки по талии и бёдрам, потому что короткая длина сразу подчёркивает пропорции. Мы настраиваем силуэт, длину и обработку под фигуру.',
    materials: ['Креп', 'Костюмная шерсть', 'Хлопок', 'Деним', 'Твид', 'Кожа', 'Смесовые ткани', 'Подкладочные ткани'],
    focus: ['короткую длину', 'посадку', 'пропорции', 'материал'],
  },
  'maxi-skirts': {
    genitive: 'макси-юбок',
    singular: 'макси-юбка',
    accusative: 'макси-юбку',
    adjective: 'индивидуальная',
    intro:
      'Макси-юбка строится вокруг длины, пластики ткани и движения. Мы подбираем конструкцию так, чтобы силуэт не перегружал фигуру и красиво работал в шаге.',
    materials: ['Шёлк', 'Вискоза', 'Креп', 'Атлас', 'Хлопок', 'Тонкая шерсть', 'Смесовые ткани', 'Подкладочные ткани'],
    focus: ['длину макси', 'движение', 'пластику ткани', 'посадку'],
  },
  'skirts-from-photo': {
    genitive: 'юбок по фото',
    singular: 'юбка по фото',
    accusative: 'юбку по фото',
    adjective: 'индивидуальная',
    intro:
      'Юбка по фото создаётся как адаптация референса под фигуру, ткань и нужную длину. Мы сохраняем идею силуэта, но строим конструкцию по вашим меркам.',
    materials: ['Креп', 'Вискоза', 'Хлопок', 'Деним', 'Шёлк', 'Твид', 'Смесовые ткани', 'Подкладочные ткани'],
    focus: ['референс', 'посадку', 'длину', 'материал'],
  },
  'women-trousers': {
    genitive: 'женских брюк',
    singular: 'женские брюки',
    accusative: 'женские брюки',
    adjective: 'индивидуальные',
    intro:
      'Женские брюки строятся вокруг посадки по талии, бёдрам и линии шага. Мы настраиваем силуэт, длину, карманы и комфорт в движении под вашу фигуру.',
    materials: ['Костюмная шерсть', 'Креп', 'Вискоза', 'Хлопок', 'Лён', 'Деним', 'Смесовые ткани', 'Подкладочные ткани'],
    focus: ['посадку', 'линию шага', 'длину', 'карманы'],
  },
  'women-jackets': {
    genitive: 'женских жакетов',
    singular: 'женский жакет',
    accusative: 'женский жакет',
    adjective: 'индивидуальный',
    intro:
      'Женский жакет требует точной работы с плечом, посадкой, лацканами и подкладкой. Мы выстраиваем конструкцию под фигуру, ткань и нужный сценарий носки.',
    materials: ['Костюмная шерсть', 'Твид', 'Креп', 'Лён', 'Хлопок', 'Шёлк', 'Смесовые ткани', 'Подкладочные ткани'],
    focus: ['плечо', 'посадку', 'лацканы', 'подкладку'],
  },
  'women-corsets': {
    genitive: 'женских корсетов',
    singular: 'корсет',
    accusative: 'корсет',
    adjective: 'индивидуальный',
    intro:
      'Корсет строится по фигуре и требует точной работы с поддержкой, чашками, косточками и застёжкой. Конструкция должна держать форму и оставаться комфортной.',
    materials: ['Корсетная сетка', 'Атлас', 'Шёлк', 'Креп', 'Хлопок', 'Кружево', 'Дублирующие материалы', 'Подкладочные ткани'],
    focus: ['поддержку', 'чашки', 'посадку', 'застёжку'],
  },
  'women-half-corsets': {
    genitive: 'женских полукорсетов',
    singular: 'полукорсет',
    accusative: 'полукорсет',
    adjective: 'индивидуальный',
    intro:
      'Полукорсет строится как деликатная бельевая основа с поддержкой и точной посадкой. Мы настраиваем форму, высоту, чашки и комфорт под фигуру.',
    materials: ['Корсетная сетка', 'Атлас', 'Шёлк', 'Кружево', 'Хлопок', 'Эластичные материалы', 'Дублирующие материалы', 'Подкладочные ткани'],
    focus: ['бельевую основу', 'поддержку', 'посадку', 'форму'],
  },
  'women-blouses': {
    genitive: 'женских блуз',
    singular: 'блуза',
    accusative: 'блузу',
    adjective: 'индивидуальная',
    intro:
      'Блуза строится вокруг ткани, мягкой посадки, рукава, воротника и застёжки. Мы подбираем конструкцию под образ, сезон и желаемую пластику изделия.',
    materials: ['Шёлк', 'Вискоза', 'Хлопок', 'Батист', 'Креп', 'Шифон', 'Смесовые ткани', 'Пуговицы и фурнитура'],
    focus: ['ткань', 'рукав', 'воротник', 'мягкую посадку'],
  },
  'women-shirts': {
    genitive: 'женских рубашек',
    singular: 'женская рубашка',
    accusative: 'женскую рубашку',
    adjective: 'индивидуальная',
    intro:
      'Женская рубашка требует аккуратной посадки по плечу и груди, чистой планки, воротника и манжет. Мы настраиваем форму под фигуру и сценарий носки.',
    materials: ['Хлопок', 'Поплин', 'Оксфорд', 'Батист', 'Лён', 'Шёлк', 'Смесовые сорочечные ткани', 'Пуговицы'],
    focus: ['воротник', 'манжеты', 'планку', 'посадку'],
  },
  'women-coats': {
    genitive: 'женских пальто',
    singular: 'пальто',
    accusative: 'пальто',
    adjective: 'индивидуальное',
    intro:
      'Женское пальто строится с учётом плеча, длины, воротника, подкладки и плотности ткани. Важно сохранить чистую линию и комфорт поверх нижних слоёв.',
    materials: ['Шерсть', 'Кашемир', 'Драп', 'Твид', 'Альпака', 'Смесовые пальтовые ткани', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['плечо', 'длину', 'воротник', 'подкладку'],
  },
  'women-trench-coats': {
    genitive: 'женских плащей',
    singular: 'плащ',
    accusative: 'плащ',
    adjective: 'индивидуальный',
    intro:
      'Плащ строится вокруг защиты от погоды, посадки и функциональных деталей. Мы продумываем ткань, пояс, воротник, застёжку и карманы.',
    materials: ['Плащёвая ткань', 'Хлопок с пропиткой', 'Габардин', 'Мембранные ткани', 'Смесовые ткани', 'Подкладочные ткани', 'Фурнитура', 'Пуговицы'],
    focus: ['плащевую ткань', 'пояс', 'воротник', 'застёжку'],
  },
  'women-outerwear-jackets': {
    genitive: 'женских курток',
    singular: 'женская куртка',
    accusative: 'женскую куртку',
    adjective: 'индивидуальная',
    intro:
      'Женская куртка строится под нужный объём, длину и функциональность. Мы настраиваем посадку, молнию, карманы, капюшон и подкладку.',
    materials: ['Плащёвая ткань', 'Хлопок', 'Нейлон', 'Шерсть', 'Деним', 'Кожа', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['объём', 'молнию', 'карманы', 'капюшон'],
  },
  'women-bombers': {
    genitive: 'женских бомберов',
    singular: 'бомбер',
    accusative: 'бомбер',
    adjective: 'индивидуальный',
    intro:
      'Бомбер строится вокруг посадки, манжет, эластичного низа и молнии. Мы подбираем материал и объём так, чтобы изделие выглядело собранно.',
    materials: ['Шерсть', 'Плащёвая ткань', 'Нейлон', 'Кожа', 'Хлопок', 'Трикотаж для манжет', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['манжеты', 'молнию', 'посадку', 'материал'],
  },
  'women-parkas': {
    genitive: 'женских парок',
    singular: 'парка',
    accusative: 'парку',
    adjective: 'индивидуальная',
    intro:
      'Парка строится как функциональная верхняя одежда с капюшоном, карманами и кулисками. Мы настраиваем длину, объём и защитные детали.',
    materials: ['Плащёвая ткань', 'Хлопок с пропиткой', 'Нейлон', 'Мембранные ткани', 'Подкладочные ткани', 'Утеплитель', 'Шнуры и фурнитура', 'Молнии'],
    focus: ['капюшон', 'карманы', 'кулиски', 'длину'],
  },
  'women-down-jackets': {
    genitive: 'женских пуховиков',
    singular: 'пуховик',
    accusative: 'пуховик',
    adjective: 'индивидуальный',
    intro:
      'Пуховик строится с учётом утепления, стёжки, объёма и длины. Мы продумываем капюшон, фурнитуру и посадку поверх зимних слоёв.',
    materials: ['Плащёвая ткань', 'Нейлон', 'Мембранные ткани', 'Утеплитель', 'Пуховой пакет', 'Подкладочные ткани', 'Молнии', 'Фурнитура'],
    focus: ['утепление', 'стёжку', 'объём', 'капюшон'],
  },
  'women-shearling-coats': {
    genitive: 'женских дубленок',
    singular: 'дубленка',
    accusative: 'дубленку',
    adjective: 'индивидуальная',
    intro:
      'Дубленка требует внимательной работы с кожей, мехом, посадкой и обработкой края. Мы продумываем длину, застёжку, воротник и комфорт в носке.',
    materials: ['Овчина', 'Кожа', 'Замша', 'Мех', 'Дублёные материалы', 'Фурнитура', 'Молнии', 'Пуговицы'],
    focus: ['кожу и мех', 'посадку', 'длину', 'фурнитуру'],
  },
  'women-vests': {
    genitive: 'женских жилетов',
    singular: 'жилет',
    accusative: 'жилет',
    adjective: 'индивидуальный',
    intro:
      'Жилет строится вокруг посадки, проймы, застёжки и многослойности. Мы настраиваем силуэт так, чтобы изделие хорошо работало поверх рубашек, блуз или трикотажа.',
    materials: ['Костюмная шерсть', 'Твид', 'Креп', 'Лён', 'Хлопок', 'Смесовые ткани', 'Подкладочные ткани', 'Фурнитура'],
    focus: ['пройму', 'посадку', 'застёжку', 'подкладку'],
  },
  'women-long-sleeves': {
    genitive: 'женских лонгсливов',
    singular: 'лонгслив',
    accusative: 'лонгслив',
    adjective: 'индивидуальный',
    intro:
      'Лонгслив строится из трикотажа с учётом растяжимости, горловины, длины и посадки. Мы подбираем форму под фигуру и нужную степень прилегания.',
    materials: ['Хлопковый трикотаж', 'Вискозный трикотаж', 'Джерси', 'Рибана', 'Кашкорсе', 'Шерстяной трикотаж', 'Смесовый трикотаж', 'Нити для трикотажа'],
    focus: ['трикотаж', 'горловину', 'рукав', 'посадку'],
  },
  'women-hoodies': {
    genitive: 'женских худи',
    singular: 'худи',
    accusative: 'худи',
    adjective: 'индивидуальное',
    intro:
      'Худи строится вокруг капюшона, объёма, кармана и плотности трикотажа. Мы настраиваем посадку, длину и детали под нужный образ.',
    materials: ['Футер', 'Хлопковый трикотаж', 'Флис', 'Трикотаж с начёсом', 'Кашкорсе', 'Шнуры', 'Люверсы', 'Фурнитура'],
    focus: ['капюшон', 'карман', 'манжеты', 'плотность трикотажа'],
  },
  'women-sweatshirts': {
    genitive: 'женских свитшотов',
    singular: 'свитшот',
    accusative: 'свитшот',
    adjective: 'индивидуальный',
    intro:
      'Свитшот строится из трикотажа с учётом объёма, манжет, горловины и длины. Мы подбираем посадку под фигуру и нужную плотность изделия.',
    materials: ['Футер', 'Хлопковый трикотаж', 'Флис', 'Трикотаж с начёсом', 'Кашкорсе', 'Рибана', 'Смесовый трикотаж', 'Нити для трикотажа'],
    focus: ['объём', 'манжеты', 'горловину', 'посадку'],
  },
  'women-t-shirts': {
    genitive: 'женских футболок',
    singular: 'футболка',
    accusative: 'футболку',
    adjective: 'индивидуальная',
    intro:
      'Футболка строится из трикотажа с учётом горловины, длины, рукава и посадки. Даже базовое изделие требует точных пропорций и аккуратной обработки.',
    materials: ['Хлопковый трикотаж', 'Вискозный трикотаж', 'Джерси', 'Рибана', 'Кулирка', 'Смесовый трикотаж', 'Нити для трикотажа', 'Отделочные материалы'],
    focus: ['горловину', 'длину', 'рукав', 'посадку'],
  },
};

const DONE_FOLDERS = new Set(
  womenFinalPagesMatrix.flatMap((group) => group.pages)
    .filter((page) => page.status === 'done')
    .map((page) => page.folder)
);

const SOURCE_BY_FOLDER = new Map(
  womenFinalPagesMatrix.flatMap((group) => group.pages.map((page) => [page.folder, { ...page, group: group.group }]))
);

function formatPrice(price) {
  return new Intl.NumberFormat('ru-RU').format(price);
}

function pageKind(page) {
  if (page.route.includes('/dresses/')) return 'Платья';
  if (page.route.includes('/skirts/')) return 'Юбки';
  return null;
}

function parentBreadcrumb(page) {
  const kind = pageKind(page);
  if (kind === 'Платья') {
    return { title: 'Платья', route: '/services/custom-tailoring/women/dresses' };
  }
  if (kind === 'Юбки') {
    return { title: 'Юбки', route: '/services/custom-tailoring/women/skirts' };
  }
  return null;
}

function assistantName(folder) {
  return folder.replace(/^women-/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSeoTitle(copy) {
  return `Пошив ${copy.genitive} на заказ в Москве — Ателье 15/13`;
}

function buildSeoDescription(page, copy, priceText) {
  return `Индивидуальный пошив ${copy.genitive} по меркам: ${page.angle}. Стоимость пошива от ${priceText} ₽.`;
}

function buildHeroUsp(copy) {
  return `Рассчитайте предварительную стоимость пошива на сайте и приходите на консультацию с готовым ориентиром.`;
}

function buildMaterialsList(materials) {
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

function buildBreadcrumbHtml(page) {
  const parent = parentBreadcrumb(page);
  const parentItem = parent
    ? `\n                        <li class="service-breadcrumbs__item">\n                            <a href="${parent.route}" class="service-breadcrumbs__link">${parent.title}</a>\n                        </li>`
    : '';

  return `<nav aria-label="Хлебные крошки" class="service-breadcrumbs bg-background border-b border-border/50">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <ol class="service-breadcrumbs__list">
                        <li class="service-breadcrumbs__item">
                            <a href="/" class="service-breadcrumbs__link">Главная</a>
                        </li>
                        <li class="service-breadcrumbs__item">
                            <a href="/services" class="service-breadcrumbs__link">Услуги</a>
                        </li>
                        <li class="service-breadcrumbs__item">
                            <a href="/services/custom-tailoring" class="service-breadcrumbs__link">Индивидуальный
                                пошив</a>
                        </li>
                        <li class="service-breadcrumbs__item">
                            <a href="/services/custom-tailoring/women" class="service-breadcrumbs__link">Женщинам</a>
                        </li>${parentItem}
                        <li class="service-breadcrumbs__item" aria-current="page">
                            <span class="service-breadcrumbs__current">${page.title}</span>
                        </li>
                    </ol>
                </div>
            </nav>`;
}

function buildBreadcrumbJson(page) {
  const itemListElement = [
    { '@type': 'ListItem', position: 1, name: 'Главная', item: '/' },
    { '@type': 'ListItem', position: 2, name: 'Услуги', item: '/services' },
    { '@type': 'ListItem', position: 3, name: 'Индивидуальный пошив', item: '/services/custom-tailoring' },
    { '@type': 'ListItem', position: 4, name: 'Женщинам', item: '/services/custom-tailoring/women' },
  ];
  const parent = parentBreadcrumb(page);
  if (parent) itemListElement.push({ '@type': 'ListItem', position: 5, name: parent.title, item: parent.route });
  itemListElement.push({ '@type': 'ListItem', position: itemListElement.length + 1, name: page.title, item: page.route });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${page.route}#breadcrumb`,
    itemListElement,
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
      answer: `Да, фото или референс можно использовать как основу для силуэта, пропорций, деталей и настроения будущего изделия. Конструкция адаптируется под фигуру и материал.`,
    },
    {
      question: `Какие ткани подходят для ${copy.genitive}?`,
      strongPhrases: ['ткани подходят'],
      answer: `Для ${copy.genitive} подбираем материалы под сезон, силуэт и сценарий носки. Часто используем: ${copy.materials.slice(0, 5).join(', ')}.`,
    },
  ];
}

function renderFaqHtml(items) {
  return items.map((item) => {
    let question = item.question;
    item.strongPhrases.forEach((phrase) => {
      question = question.replace(phrase, `<strong>${phrase}</strong>`);
    });
    return `                        <details class="service-faq rounded-md border border-border bg-background p-6">
                            <summary class="cursor-pointer">
                                <h3>${question}</h3>
                            </summary>
                            <p class="text-sm text-muted-foreground leading-relaxed mt-4">${item.answer}</p>
                        </details>`;
  }).join('\n\n');
}

function buildPageData(page, copy, priceText) {
  const faqItems = faq(page, copy, priceText);
  return {
    title: page.title,
    slug: page.route.split('/').pop(),
    path: page.route,
    type: 'service-subcategory',
    seoTitle: buildSeoTitle(copy),
    seoDescription: buildSeoDescription(page, copy, priceText),
    canonical: page.route,
    h1: `Индивидуальный пошив ${copy.genitive}`,
    introText: copy.intro,
    heroUsp: buildHeroUsp(copy),
    availableOptions: [
      `Пошив ${copy.genitive} по меркам`,
      `Работа с фото, эскизом или референсом`,
      `Настройка посадки, длины и деталей под фигуру`,
      `Подбор ткани, подкладки и фурнитуры`,
      `Примерки и финальная корректировка изделия`,
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
      `Конструирование: создаём основу изделия под фигуру и выбранные пропорции`,
      'Пошив и примерки: уточняем посадку, длину, объём и детали',
      'Финальная готовность: проверяем посадку, обработку и комфорт в движении',
    ],
    faq: faqItems,
    ctaLabel: 'Записаться на консультацию',
    relatedPages: [],
    children: [],
    parentPath: parentBreadcrumb(page)?.route || '/services/custom-tailoring/women',
    depth: parentBreadcrumb(page) ? 4 : 3,
  };
}

function replaceJsonLd(html, page, copy, priceText) {
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
      name: buildSeoTitle(copy),
      description: buildSeoDescription(page, copy, priceText),
      inLanguage: 'ru-RU',
      isPartOf: { '@id': '/#website' },
      about: { '@id': '/#+atelier1513' },
      breadcrumb: { '@id': `${page.route}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: '/images/hero-atelier.png' },
    },
    buildBreadcrumbJson(page),
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: `Индивидуальный пошив ${copy.genitive}`,
      description: buildSeoDescription(page, copy, priceText),
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
  ].map((script) => `    <script\n        type="application/ld+json">${JSON.stringify(script)}</script>`).join('\n');

  return html.replace(/    <script\s+type="application\/ld\+json">[\s\S]*?FAQPage[\s\S]*?<\/script>/, scripts);
}

function generateHtml(page, copy) {
  const priceText = formatPrice(page.priceFrom);
  const seoTitle = buildSeoTitle(copy);
  const seoDescription = buildSeoDescription(page, copy, priceText);
  const assistant = assistantName(page.folder);
  const faqItems = faq(page, copy, priceText);

  let html = readFileSync(join(TEMPLATE_DIR, 'index.html'), 'utf8');
  html = replaceJsonLd(html, page, copy, priceText);
  html = html
    .replace(/<title>.*?<\/title>/, `<title>${seoTitle}</title>`)
    .replace(/<meta name="description"\s+content=".*?" \/>/s, `<meta name="description"\n        content="${seoDescription}" />`)
    .replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${page.route}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${seoTitle}" />`)
    .replace(/<meta property="og:description"\s+content=".*?" \/>/s, `<meta property="og:description"\n        content="${seoDescription}" />`)
    .replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${page.route}" />`)
    .replace(/<meta property="og:image:alt" content=".*?" \/>/, `<meta property="og:image:alt" content="${seoTitle.replace(' в Москве — Ателье 15/13', '')} — Ателье 15/13, Москва" />`)
    .replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${seoTitle}" />`)
    .replace(/<meta name="twitter:description"\s+content=".*?" \/>/s, `<meta name="twitter:description"\n        content="${seoDescription}" />`)
    .replace(/alt="Пошив .*?"/, `alt="${seoTitle}"`)
    .replace(/(<article class="service-approach__visual"[\s\S]*?<div class="service-approach__media">\s*<img src=")(.*?)(")/, `$1${galleryImage(page)}$3`)
    .replace(/Индивидуальный пошив платьев с отрезной талией/g, `Индивидуальный пошив ${copy.genitive}`)
    .replace(/Платье с отрезной талией строится как отдельный лиф и юбка, соединённые по линии талии\.\s+Такой крой помогает точно настроить пропорции, посадку верха, объём юбки и комфорт в\s+движении\./, copy.intro)
    .replace(/Рассчитайте предварительную стоимость пошива платья с отрезной\s+талией на сайте и приходите на консультацию с готовым ориентиром\./, buildHeroUsp(copy))
    .replace(/от 35 000 ₽/g, `от ${priceText.replace(' ', ' ')} ₽`)
    .replace(/Напишите: хочу платье с отрезной талией\.\.\./g, `Напишите: хочу ${copy.accusative}...`)
    .replace(/Опишите платье или прикрепите фото референса\.\s+Я задам уточняющие вопросы и\s+посчитаю ориентир по пошиву\./g, `Опишите ${copy.accusative} или прикрепите фото референса. Я задам уточняющие вопросы и посчитаю ориентир по пошиву.`)
    .replace(/data-cutoff-assistant/g, `data-${assistant}-assistant`)
    .replace(/<nav aria-label="Хлебные крошки"[\s\S]*?<\/nav>/, buildBreadcrumbHtml(page))
    .replace(/Примеры пошива платьев с отрезной талией,\s+посадка лифа, линия талии, объём юбки и материалы — ориентиры для выбора силуэта\./, `Примеры пошива ${copy.genitive}: ${page.angle}. Это ориентиры для выбора силуэта, материалов и уровня деталей.`)
    .replace(/Ателье 15\/13 — индивидуальный пошив платьев с отрезной талией/g, `Ателье 15/13 — индивидуальный пошив ${copy.genitive}`)
    .replace(/Премиальный результат строится на линии\s+талии/, 'Премиальный результат строится на деталях')
    .replace(/Мы показываем не «портфолио ради\s+портфолио»,\s+а подход: пропорции, посадка лифа, объём юбки и аккуратная обработка\./, `Мы показываем не «портфолио ради портфолио», а подход: ${copy.focus.join(', ')} и аккуратная обработка.`)
    .replace(/<h3 class="service-approach__title"><strong>Линия талии<\/strong><\/h3>\s+<p class="service-approach__text">[\s\S]*?<\/p>/, `<h3 class="service-approach__title"><strong>Посадка</strong></h3>\n                                    <p class="service-approach__text">Настраиваем ${copy.focus[1] || 'посадку'} под фигуру, материал и сценарий носки.</p>`)
    .replace(/Подбираем ткань, подкладку и фурнитуру под задачу:\s+от повседневного платья до более нарядного образа\./, `Подбираем ткань, подкладку и фурнитуру под задачу: ${copy.materials.slice(0, 4).join(', ')}.`)
    .replace(/Берём референс как направление и адаптируем\s+пропорции, вырез, рукава и форму юбки под фигуру\./, `Берём референс как направление и адаптируем ${copy.focus.join(', ')} под фигуру.`)
    .replace(/Проверяем соединение лифа и юбки, посадку по\s+талии, длину и комфорт в движении на примерках\./, 'Проверяем посадку, обработку, длину и комфорт в движении на примерках.')
    .replace(/Обсудим силуэт, линию талии,\s+референсы, материалы и сроки\. Предварительная стоимость — на основе задачи и\s+сложности конструкции лифа и юбки\./, `Обсудим ${copy.focus.join(', ')}, материалы и сроки. Предварительная стоимость — на основе задачи и сложности конструкции.`)
    .replace(/Платье под пропорции,\s+фигуру и материал/, 'Изделие под фигуру, материал и задачу')
    .replace(/<h3 class="service-text-card-title font-serif text-xl mb-3"><strong>Пропорции<\/strong><\/h3>\s+<p class="text-sm text-muted-foreground leading-relaxed">[\s\S]*?<\/p>/, `<h3 class="service-text-card-title font-serif text-xl mb-3"><strong>Посадка</strong></h3>\n                            <p class="text-sm text-muted-foreground leading-relaxed">${copy.adjective[0].toUpperCase()}${copy.adjective.slice(1)} ${copy.singular} строится по меркам, чтобы изделие выглядело собранно и было комфортным.</p>`)
    .replace(/<h3 class="service-text-card-title font-serif text-xl mb-3"><strong>Посадка<\/strong><\/h3>\s+<p class="text-sm text-muted-foreground leading-relaxed">[\s\S]*?<\/p>/, `<h3 class="service-text-card-title font-serif text-xl mb-3"><strong>Материалы</strong></h3>\n                            <p class="text-sm text-muted-foreground leading-relaxed">Ткань, подкладка и фурнитура подбираются под ${copy.focus.join(', ')}.</p>`)
    .replace(/<h3 class="service-text-card-title font-serif text-xl mb-3"><strong>Посадка<\/strong><\/h3>\s+<p class="text-sm text-muted-foreground leading-relaxed">Лиф и юбка строятся отдельно,\s+поэтому платье проще посадить по фигуре без лишнего напряжения в движении\.<\/p>/, `<h3 class="service-text-card-title font-serif text-xl mb-3"><strong>Баланс</strong></h3>\n                            <p class="text-sm text-muted-foreground leading-relaxed">Корректируем ${copy.focus.join(', ')}, чтобы изделие выглядело аккуратно и было комфортным в движении.</p>`)
    .replace(/Фокус на чистой линии талии,\s+аккуратном соединении деталей, материале и спокойной премиальной обработке\./, 'Фокус на чистой линии, аккуратной обработке, материале и спокойном премиальном результате без перегруза.')
    .replace(/Стоимость пошива платья с отрезной\s+талией — от 35 000 ₽\. Итоговая цена зависит от ткани, конструкции лифа и юбки,\s+подкладки, деталей, сроков и количества примерок\./, `Стоимость пошива ${copy.genitive} — от ${priceText} ₽. Итоговая цена зависит от ткани, конструкции, подкладки, деталей, сроков и количества примерок.`)
    .replace(/<strong>Конструкция лифа и юбки<\/strong><br>\s+Форма лифа, высота талии, объём юбки, складки, сборка и асимметрия влияют на объём\s+работы\./, `<strong>Конструкция</strong><br>\n                                    На стоимость влияют ${copy.focus.join(', ')}, а также сложность лекал и примерок.`)
    .replace(/Хлопок, вискоза, креп, шёлк, атлас и шерсть требуют разной обработки и стабилизации\./, `Разные материалы требуют разной обработки: ${copy.materials.slice(0, 5).join(', ')}.`)
    .replace(/Рукава, вырез, застёжка, пояс, декоративные элементы и ручная обработка\s+рассчитываются отдельно\./, 'Карманы, застёжки, воротники, рукава, пояс, декоративные элементы и ручная обработка рассчитываются отдельно.')
    .replace(/Консультация: обсуждаем силуэт, линию талии, референсы и сценарий носки/, `Консультация: обсуждаем ${copy.focus.join(', ')} и сценарий носки`)
    .replace(/Конструирование: создаём лиф и юбку под фигуру и выбранные пропорции/, 'Конструирование: создаём основу изделия под фигуру и выбранные пропорции')
    .replace(/Пошив и примерки: уточняем посадку лифа, объём юбки, длину и линию талии/, 'Пошив и примерки: уточняем посадку, длину, объём и детали')
    .replace(/Материалы подбираются под сезон,\s+силуэт, линию талии и желаемую пластику юбки\./, 'Материалы подбираются под сезон, силуэт, сценарий носки и желаемую пластику изделия.')
    .replace(/<ol class="service-materials-list">[\s\S]*?<\/ol>/, buildMaterialsList(copy.materials))
    .replace(/<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">\s*<details class="service-faq[\s\S]*?<\/div>\s*<\/div>\s*<\/section>\s*<div class="service-sticky-cta"/, `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">\n\n${renderFaqHtml(faqItems)}\n\n                    </div>\n                </div>\n            </section>\n\n            <div class="service-sticky-cta"`);

  return html;
}

function generateJs(page, copy) {
  const assistant = assistantName(page.folder);
  let js = readFileSync(join(TEMPLATE_DIR, 'assets', 'service-page.js'), 'utf8');
  js = js
    .replaceAll('data-cutoff-assistant', `data-${assistant}-assistant`)
    .replaceAll('cut-off-waist-assistant-session-id', `${assistant}-assistant-session-id`)
    .replaceAll('cut-off-waist-', `${assistant}-`)
    .replaceAll('Фото для оценки платья с отрезной талией', `Фото для оценки: ${copy.singular}`);
  return js;
}

function syncExistingGalleryImage(page) {
  if (!page.galleryImage) return;
  const dest = join(FINAL_PAGES_DIR, page.folder);
  const htmlPath = join(dest, 'index.html');
  const dataPath = join(dest, 'page-data.json');

  if (existsSync(dest)) copyGalleryImage(page, dest);

  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, 'utf8')
      .replace(/(<article class="service-approach__visual"[\s\S]*?<div class="service-approach__media">\s*<img src=")(.*?)(")/, `$1${galleryImage(page)}$3`);
    writeFileSync(htmlPath, html);
  }

  if (existsSync(dataPath)) {
    const data = JSON.parse(readFileSync(dataPath, 'utf8'));
    if (Array.isArray(data.galleryItems) && data.galleryItems[0]) {
      data.galleryItems[0].image = galleryImage(page);
      writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
    }
  }
}

function generatePage(page) {
  if (DONE_FOLDERS.has(page.folder)) {
    syncExistingGalleryImage(page);
    return false;
  }
  const copy = CASES[page.folder];
  if (!copy) throw new Error(`Missing copy config for ${page.folder}`);

  const dest = join(FINAL_PAGES_DIR, page.folder);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(TEMPLATE_DIR, dest, { recursive: true });
  copyGalleryImage(page, dest);
  rmSync(join(dest, 'source'), { recursive: true, force: true });

  const priceText = formatPrice(page.priceFrom);
  writeFileSync(join(dest, 'index.html'), generateHtml(page, copy));
  writeFileSync(join(dest, 'assets', 'service-page.js'), generateJs(page, copy));
  writeFileSync(join(dest, 'page-data.json'), JSON.stringify(buildPageData(page, copy, priceText), null, 2) + '\n');
  return true;
}

let generated = 0;
for (const [, page] of SOURCE_BY_FOLDER) {
  if (generatePage(page)) generated += 1;
}

console.log(`Generated ${generated} women final pages`);
