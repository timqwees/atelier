const DEFAULT_MATERIALS = [
  'Шерсть',
  'Кашемир',
  'Шелк',
  'Атлас',
  'Хлопок',
  'Вискоза',
  'Кожа',
  'Трикотаж',
];

const DEFAULT_PROCESS_STEPS = [
  'Консультация и разбор задачи',
  'Снятие мерок и подбор материалов',
  'Конструирование изделия',
  'Пошив и примерки',
  'Финальная посадка и выдача изделия',
];

const DEFAULT_AVAILABLE_OPTIONS = [
  'Пошив по индивидуальным меркам',
  'Адаптация изделия по фото или референсу',
  'Подбор ткани, подкладки и фурнитуры',
  'Корректировка посадки на примерках',
];

const DEFAULT_GALLERY_ITEMS = [
  {
    title: 'Силуэт изделия',
    description: 'Каркас для будущего блока кейсов, посадки и визуальных деталей пошива.',
    image: '/images/craftsmanship.png',
  },
  {
    title: 'Посадка по фигуре',
    description: 'Блок для демонстрации посадки, пропорций и работы с линиями изделия.',
    image: '/images/measurement.png',
  },
  {
    title: 'Детали пошива',
    description: 'Блок для крупного плана ткани, отделки, фурнитуры и ручных элементов.',
    image: '/images/fabrics.png',
  },
];

const DEFAULT_WHY_ITEMS = [
  {
    title: 'Посадка',
    description: 'Изделие строится под фигуру клиента, а не адаптируется к стандартной размерной сетке.',
  },
  {
    title: 'Качество',
    description: 'Работаем с конструкцией, тканью, подкладкой, швами и деталями как с единой системой.',
  },
  {
    title: 'Уровень luxury brand',
    description: 'Фокус на силуэте, материале и аккуратном исполнении без случайных решений.',
  },
];

const DEFAULT_PRICING_FACTORS = [
  'Тип изделия и сложность конструкции',
  'Ткань, подкладка и фурнитура',
  'Декор, ручная работа и дополнительные детали',
  'Количество примерок и срочность',
];

function joinPath(parentPath, slug) {
  if (!parentPath) return `/${slug}`;
  return `${parentPath.replace(/\/$/, '')}/${slug}`;
}

function createFaq(title) {
  return [
    {
      question: `Можно ли заранее рассчитать стоимость: ${title.toLowerCase()}?`,
      answer: 'Да, предварительную стоимость можно оценить после описания задачи, фото референса и понимания материала. Точная цена фиксируется после консультации.',
    },
    {
      question: 'Сколько примерок обычно требуется?',
      answer: 'Количество примерок зависит от сложности изделия, ткани и посадки. Для базовых изделий обычно достаточно нескольких этапов примерки.',
    },
    {
      question: 'Можно ли сшить изделие по фото или референсу бренда?',
      answer: 'Да, ателье может использовать фото или референс как направление по силуэту, деталям и настроению изделия.',
    },
  ];
}

function createSeoDescription(title) {
  return `${title} в Ателье 15/13: консультация, подбор решения, работа с посадкой, материалами и деталями изделия.`;
}

function createIntroText(title) {
  return `${title} — направление Ателье 15/13 для аккуратной работы с посадкой, материалами, пропорциями и деталями изделия.`;
}

function createNode(definition, parentPath = '') {
  const path = definition.path || joinPath(parentPath, definition.slug);
  const children = (definition.children || []).map((child) => createNode(child, path));
  const childTitles = children.map((child) => child.title);
  const h1 = definition.h1 || (definition.type === 'services-root' ? 'Услуги Ателье 15/13' : `${definition.title} в Ателье 15/13`);

  return {
    title: definition.title,
    slug: definition.slug,
    path,
    type: definition.type || 'service-page',
    seoTitle: definition.seoTitle || `${definition.title} — Ателье 15/13`,
    seoDescription: definition.seoDescription || createSeoDescription(definition.title),
    canonical: definition.canonical || path,
    h1,
    introText: definition.introText || createIntroText(definition.title),
    heroUsp: definition.heroUsp || 'Персональный пошив по меркам, событию и образу.',
    availableOptions: definition.availableOptions || (childTitles.length ? childTitles : DEFAULT_AVAILABLE_OPTIONS),
    materials: definition.materials || DEFAULT_MATERIALS,
    galleryItems: definition.galleryItems || DEFAULT_GALLERY_ITEMS,
    whyItems: definition.whyItems || DEFAULT_WHY_ITEMS,
    pricingFactors: definition.pricingFactors || DEFAULT_PRICING_FACTORS,
    priceFrom: definition.priceFrom || null,
    priceNote: definition.priceNote || 'Стоимость рассчитывается индивидуально и зависит от изделия, ткани, конструкции и дополнительных деталей.',
    processSteps: definition.processSteps || DEFAULT_PROCESS_STEPS,
    faq: definition.faq || createFaq(definition.title),
    ctaLabel: definition.ctaLabel || 'Записаться на консультацию',
    relatedPages: definition.relatedPages || [],
    children,
  };
}

const womenDressSubcategories = [
  { title: 'Платья-футляры', slug: 'sheath', type: 'service-subcategory' },
  { title: 'Прямые платья', slug: 'straight', type: 'service-subcategory' },
  { title: 'Отрезные платья', slug: 'cut-off-waist', type: 'service-subcategory' },
  {
    title: 'Вечерние платья',
    slug: 'evening',
    type: 'service-subcategory',
    seoTitle: 'Пошив вечерних платьев на заказ в Москве — Ателье 15/13',
    seoDescription: 'Индивидуальный пошив вечерних платьев на заказ в Москве. Для свадьбы, выпускного или торжества. Премиум-ткани, идеальная посадка. От 80 000 ₽.',
    h1: 'Индивидуальный пошив вечерних платьев',
    introText: 'Вечернее платье создаётся для особого дня: выпускного, свадьбы, торжества или важного события. Ателье 15/13 разрабатывает силуэт, посадку и детали под фигуру, материал и настроение события.',
    heroUsp: 'Рассчитайте предварительную стоимость пошива на сайте и приходите на консультацию с готовым ориентиром.',
    availableOptions: [
      'Вечернее платье на выпускной',
      'Платье для свадьбы или свадебного вечера',
      'Платье для торжества, приёма или особого мероприятия',
      'Пошив по фото, эскизу или референсу бренда',
      'Индивидуальная посадка, длина, рукав, декольте и декор',
    ],
    materials: [
      'Шелк',
      'Атлас',
      'Бархат',
      'Шифон',
      'Кружево',
      'Органза',
      'Креп',
      'Подкладочные ткани',
    ],
    galleryItems: [
      {
        title: 'Платье для особого дня',
        description: 'Силуэт и настроение будущего изделия: выпускной, свадьба, вечерний приём или торжество.',
        image: '/images/craftsmanship.png',
      },
      {
        title: 'Посадка по фигуре',
        description: 'Работа с пропорциями, длиной, линией талии, декольте, рукавом и балансом изделия.',
        image: '/images/measurement.png',
      },
      {
        title: 'Детали пошива',
        description: 'Ткани, подкладка, отделка, декоративные элементы и аккуратная обработка швов.',
        image: '/images/fabrics.png',
      },
      {
        title: 'Работа с референсом',
        description: 'Основа для будущего блока с фото, эскизами и примерами похожих решений.',
        image: '/images/price-tailoring.png',
      },
      {
        title: 'Финальная примерка',
        description: 'Место для фотографий готового изделия, посадки и финальных деталей.',
        image: '/images/transformation.png',
      },
    ],
    whyItems: [
      {
        title: 'Посадка',
        description: 'Платье строится под вашу фигуру и сценарий события, чтобы силуэт выглядел собранно в движении и на фото.',
      },
      {
        title: 'Качество',
        description: 'Конструкция, ткань, подкладка и отделка подбираются под задачу: от лаконичного вечернего платья до сложного торжественного образа.',
      },
      {
        title: 'Уровень luxury brand',
        description: 'Фокус на чистой линии, материале и деталях, которые делают платье индивидуальным, но не перегруженным.',
      },
    ],
    pricingFactors: [
      {
        title: 'Сложность силуэта',
        description: 'Корсетная основа, драпировки, шлейф, разрезы и асимметрия влияют на объём работы.',
      },
      {
        title: 'Ткань и подкладка',
        description: 'Шёлк, атлас, бархат, кружево, органза и сложные материалы требуют разной обработки.',
      },
      {
        title: 'Декор и ручная работа',
        description: 'Вышивка, пайетки, кружево, аппликации и ручные элементы рассчитываются отдельно.',
      },
      {
        title: 'Сроки и примерки',
        description: 'Итоговая стоимость зависит от срочности, количества примерок и уровня детализации.',
      },
    ],
    priceFrom: 80000,
    priceNote: 'Стоимость пошива вечернего платья — от 80 000 ₽. Итоговая цена зависит от ткани, конструкции, декора, подкладки, сроков и количества примерок.',
    processSteps: [
      'Консультация: обсуждаем событие, силуэт, референсы и желаемый образ',
      'Мерки и материалы: подбираем ткань, подкладку, фурнитуру и детали',
      'Конструирование: создаём основу изделия под фигуру и сценарий носки',
      'Пошив и примерки: уточняем посадку, длину, линию талии и детали',
      'Финальная готовность: проверяем посадку, обработку и комфорт перед событием',
    ],
    faq: [
      {
        question: 'Можно ли сшить вечернее платье на выпускной?',
        strongPhrases: ['вечернее платье'],
        answer: 'Да, вечернее платье можно создать специально для выпускного: с нужной длиной, силуэтом, тканью и деталями под формат события.',
      },
      {
        question: 'Можно ли сделать платье для свадьбы?',
        strongPhrases: ['платье для свадьбы'],
        answer: 'Да, ателье может сшить платье для свадьбы, свадебного ужина, второго образа или торжественной части мероприятия.',
      },
      {
        question: 'Сколько стоит пошив вечернего платья?',
        strongPhrases: ['пошив вечернего платья'],
        answer: 'Стоимость пошива вечернего платья начинается от 80 000 ₽. Точная цена зависит от ткани, конструкции, декора и сроков.',
      },
      {
        question: 'Можно ли сшить платье по фото или референсу?',
        strongPhrases: ['платье по фото', 'референсу'],
        answer: 'Да, фото или референс можно использовать как основу для силуэта, настроения, деталей и пропорций будущего изделия.',
      },
    ],
    relatedPages: [],
  },
  { title: 'Платья по фото', slug: 'from-photo', type: 'service-subcategory' },
  { title: 'Платья по референсу бренда', slug: 'brand-reference', type: 'service-subcategory' },
  { title: 'Шелковые платья', slug: 'silk', type: 'service-subcategory' },
  { title: 'Атласные платья', slug: 'satin', type: 'service-subcategory' },
];

const womenSkirtSubcategories = [
  { title: 'Прямые юбки', slug: 'straight', type: 'service-subcategory' },
  { title: 'Юбки по косой', slug: 'bias-cut', type: 'service-subcategory' },
  { title: 'Мини-юбки', slug: 'mini', type: 'service-subcategory' },
  { title: 'Макси-юбки', slug: 'maxi', type: 'service-subcategory' },
  { title: 'Юбки по фото', slug: 'from-photo', type: 'service-subcategory' },
];

const womenCategories = [
  { title: 'Платья', slug: 'dresses', type: 'garment-category', children: womenDressSubcategories },
  { title: 'Юбки', slug: 'skirts', type: 'garment-category', children: womenSkirtSubcategories },
  { title: 'Брюки', slug: 'trousers', type: 'garment-category' },
  { title: 'Жакеты', slug: 'jackets', type: 'garment-category' },
  { title: 'Корсеты', slug: 'corsets', type: 'garment-category' },
  { title: 'Полукорсеты', slug: 'half-corsets', type: 'garment-category' },
  { title: 'Блузы', slug: 'blouses', type: 'garment-category' },
  { title: 'Рубашки', slug: 'shirts', type: 'garment-category' },
  { title: 'Пальто', slug: 'coats', type: 'garment-category' },
  { title: 'Плащи', slug: 'trench-coats', type: 'garment-category' },
  { title: 'Куртки', slug: 'jackets-outerwear', type: 'garment-category' },
  { title: 'Бомберы', slug: 'bombers', type: 'garment-category' },
  { title: 'Парки', slug: 'parkas', type: 'garment-category' },
  { title: 'Пуховики', slug: 'down-jackets', type: 'garment-category' },
  { title: 'Дубленки', slug: 'shearling-coats', type: 'garment-category' },
  { title: 'Жилеты', slug: 'vests', type: 'garment-category' },
  { title: 'Лонгсливы', slug: 'long-sleeves', type: 'garment-category' },
  { title: 'Худи', slug: 'hoodies', type: 'garment-category' },
  { title: 'Свитшоты', slug: 'sweatshirts', type: 'garment-category' },
  { title: 'Футболки', slug: 't-shirts', type: 'garment-category' },
];

const menCategories = [
  { title: 'Мужские сорочки', slug: 'shirts', type: 'garment-category' },
  { title: 'Классические брюки', slug: 'classic-trousers', type: 'garment-category' },
  { title: 'Пиджаки Casual', slug: 'casual-jackets', type: 'garment-category' },
  { title: 'Пиджаки Bespoke', slug: 'bespoke-jackets', type: 'garment-category' },
  { title: 'Пальто', slug: 'coats', type: 'garment-category' },
  { title: 'Куртки', slug: 'jackets', type: 'garment-category' },
  { title: 'Бомберы', slug: 'bombers', type: 'garment-category' },
  { title: 'Парки', slug: 'parkas', type: 'garment-category' },
  { title: 'Пуховики', slug: 'down-jackets', type: 'garment-category' },
  { title: 'Дубленки', slug: 'shearling-coats', type: 'garment-category' },
  { title: 'Худи', slug: 'hoodies', type: 'garment-category' },
  { title: 'Свитшоты', slug: 'sweatshirts', type: 'garment-category' },
  { title: 'Футболки', slug: 't-shirts', type: 'garment-category' },
];

const unisexCategories = [
  { title: 'Бейсболки', slug: 'caps', type: 'garment-category' },
  { title: 'Худи', slug: 'hoodies', type: 'garment-category' },
  { title: 'Свитшоты', slug: 'sweatshirts', type: 'garment-category' },
  { title: 'Футболки', slug: 't-shirts', type: 'garment-category' },
  { title: 'Бомберы', slug: 'bombers', type: 'garment-category' },
];

export const serviceMenuData = createNode({
  title: 'Услуги',
  slug: 'services',
  path: '/services',
  type: 'services-root',
  seoTitle: 'Услуги ателье — индивидуальный пошив и корректировка изделий',
  seoDescription: 'Услуги Ателье 15/13: индивидуальный пошив, корректировка готовых изделий, работа с посадкой, материалами и деталями одежды.',
  h1: 'Услуги Ателье 15/13',
  introText: 'Главная страница направления услуг. Отсюда пользователь и поисковый робот переходят к отдельным индексируемым страницам корректировки изделий и индивидуального пошива.',
  children: [
    {
      title: 'Корректировка изделий',
      slug: 'alterations',
      type: 'service-branch',
      seoTitle: 'Корректировка изделий — Ателье 15/13',
      seoDescription: 'Корректировка изделий в Ателье 15/13: посадка по фигуре, изменение длины, работа с готовыми и премиальными изделиями.',
      h1: 'Корректировка изделий',
      introText: 'Корректируем готовые изделия по фигуре, длине и деталям после осмотра, примерки и консультации мастера.',
    },
    {
      title: 'Индивидуальный пошив',
      slug: 'custom-tailoring',
      type: 'service-branch',
      seoTitle: 'Индивидуальный пошив одежды — Ателье 15/13',
      seoDescription: 'Индивидуальный пошив одежды в Ателье 15/13: женские, мужские и унисекс изделия по меркам, фото и референсам.',
      h1: 'Индивидуальный пошив',
      introText: 'Создаем одежду по индивидуальным меркам, задачам и референсам: от базовой конструкции до материалов, деталей и примерок.',
      children: [
        {
          title: 'Женщинам',
          slug: 'women',
          type: 'audience',
          seoTitle: 'Индивидуальный пошив женской одежды — Ателье 15/13',
          seoDescription: 'Индивидуальный пошив женской одежды: платья, юбки, брюки, жакеты, пальто, куртки, трикотаж и сложные изделия.',
          h1: 'Индивидуальный пошив женской одежды',
          children: womenCategories,
        },
        {
          title: 'Мужчинам',
          slug: 'men',
          type: 'audience',
          seoTitle: 'Индивидуальный пошив мужской одежды — Ателье 15/13',
          seoDescription: 'Индивидуальный пошив мужской одежды: сорочки, брюки, пиджаки, пальто, куртки, пуховики и трикотаж.',
          h1: 'Индивидуальный пошив мужской одежды',
          children: menCategories,
        },
        {
          title: 'Унисекс / Аксессуары',
          slug: 'unisex',
          type: 'audience',
          seoTitle: 'Индивидуальный пошив унисекс изделий и аксессуаров — Ателье 15/13',
          seoDescription: 'Унисекс изделия и аксессуары на заказ: бейсболки, худи, свитшоты, футболки и бомберы.',
          h1: 'Унисекс изделия и аксессуары на заказ',
          children: unisexCategories,
        },
      ],
    },
  ],
});

export default serviceMenuData;
