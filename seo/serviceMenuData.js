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
    description: 'Ориентир по форме, пропорциям и общему характеру изделия.',
    image: '/images/craftsmanship.png',
  },
  {
    title: 'Посадка по фигуре',
    description: 'Работа с балансом, линиями и комфортом в движении.',
    image: '/images/measurement.png',
  },
  {
    title: 'Детали пошива',
    description: 'Ткань, отделка, фурнитура и ручные элементы крупным планом.',
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
    indexable: definition.indexable === true,
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
];

const womenSkirtSubcategories = [
  { title: 'Прямые юбки', slug: 'straight', type: 'service-subcategory' },
  { title: 'Юбки по косой', slug: 'bias-cut', type: 'service-subcategory' },
  { title: 'Мини-юбки', slug: 'mini', type: 'service-subcategory' },
  { title: 'Макси-юбки', slug: 'maxi', type: 'service-subcategory' },
  { title: 'Юбки по фото', slug: 'from-photo', type: 'service-subcategory' },
];

const womenCategories = [
  { title: 'Топы', slug: 'tops', type: 'garment-category' },
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
  { title: 'Пиджаки классические', slug: 'bespoke-jackets', type: 'garment-category' },
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

function createAlterationCategory({ title, slug, genitive, genderLabel }) {
  return {
    title,
    slug,
    type: 'garment-category',
    seoTitle: `Корректировка ${genitive} — Ателье 15/13`,
    seoDescription: `Корректировка ${genitive} в Ателье 15/13: посадка по фигуре, изменение длины, работа с деталями, фурнитурой и аккуратная подгонка готового изделия.`,
    h1: `Корректировка ${genitive}`,
    introText: `В Ателье 15/13 выполняем корректировку ${genitive}: уточняем посадку, длину и детали изделия после примерки и осмотра.`,
    heroUsp: 'Подгоним готовое изделие по фигуре, длине и деталям с аккуратной обработкой.',
    availableOptions: [
      'Корректировка посадки по фигуре',
      'Изменение длины изделия или рукавов',
      'Работа с застёжками, карманами, поясом и деталями',
      'Замена или восстановление отдельных элементов',
      'Консультация мастера перед началом работ',
    ],
    materials: [
      'Костюмные ткани',
      'Деним',
      'Трикотаж',
      'Плащевые ткани',
      'Подкладочные ткани',
      'Кожа',
      'Мех',
      'Фурнитура',
    ],
    whyItems: [
      {
        title: 'Посадка',
        description: 'Корректируем изделие по фигуре с учетом баланса, длины и свободы движения.',
      },
      {
        title: 'Аккуратная обработка',
        description: 'Сохраняем внешний вид изделия и подбираем способ обработки под ткань и конструкцию.',
      },
      {
        title: 'Осмотр перед работой',
        description: 'Стоимость и объем корректировки фиксируются после консультации и примерки.',
      },
    ],
    pricingFactors: [
      'Тип изделия и объём корректировки',
      'Материал, подкладка и сложность обработки',
      'Количество участков, которые нужно изменить',
      'Срочность и необходимость дополнительных примерок',
    ],
    priceNote: 'Стоимость корректировки зависит от изделия, ткани, подкладки, объёма работ и сложности обработки. Точную стоимость называем после осмотра изделия.',
    processSteps: [
      'Осмотр изделия и обсуждение задачи',
      'Примерка и фиксация нужных изменений',
      'Согласование объёма работ и стоимости',
      'Выполнение корректировки мастером',
      'Финальная примерка и проверка посадки',
    ],
    faq: [
      {
        question: `Можно ли заранее рассчитать стоимость корректировки ${genitive}?`,
        answer: 'Предварительно стоимость можно оценить по описанию задачи и фото изделия. Точная стоимость определяется после консультации, примерки и осмотра конструкции.',
      },
      {
        question: 'Нужна ли примерка перед корректировкой?',
        answer: 'В большинстве случаев примерка нужна: по ней мастер фиксирует линию длины, посадку, объём и участки, которые нужно изменить.',
      },
      {
        question: 'Работаете ли вы с изделиями на подкладке?',
        answer: 'Да, изделия на подкладке принимаем в работу. Такая корректировка обычно требует больше времени из-за разборки и восстановления внутренних слоёв.',
      },
    ],
  };
}

const womenAlterationCategories = [
  { title: 'Платья', slug: 'dresses', genitive: 'женских платьев' },
  { title: 'Вечерние и свадебные платья', slug: 'evening-dresses', genitive: 'вечерних и свадебных платьев' },
  { title: 'Юбки', slug: 'skirts', genitive: 'женских юбок' },
  { title: 'Брюки', slug: 'trousers', genitive: 'женских брюк' },
  { title: 'Джинсы', slug: 'jeans', genitive: 'женских джинсов' },
  { title: 'Жакеты', slug: 'jackets', genitive: 'женских жакетов' },
  { title: 'Корсеты', slug: 'corsets', genitive: 'корсетов' },
  { title: 'Блузы', slug: 'blouses', genitive: 'женских блуз' },
  { title: 'Рубашки', slug: 'shirts', genitive: 'женских рубашек' },
  { title: 'Пальто', slug: 'coats', genitive: 'женских пальто' },
  { title: 'Плащи', slug: 'trench-coats', genitive: 'женских плащей' },
  { title: 'Куртки', slug: 'jackets-outerwear', genitive: 'женских курток' },
  { title: 'Бомберы', slug: 'bombers', genitive: 'женских бомберов' },
  { title: 'Парки', slug: 'parkas', genitive: 'женских парок' },
  { title: 'Пуховики', slug: 'down-jackets', genitive: 'женских пуховиков' },
  { title: 'Шубы', slug: 'fur-coats', genitive: 'женских шуб' },
  { title: 'Дубленки', slug: 'shearling-coats', genitive: 'женских дубленок' },
  { title: 'Жилеты', slug: 'vests', genitive: 'женских жилетов' },
  { title: 'Лонгсливы', slug: 'long-sleeves', genitive: 'женских лонгсливов' },
  { title: 'Худи', slug: 'hoodies', genitive: 'женских худи' },
  { title: 'Свитшоты', slug: 'sweatshirts', genitive: 'женских свитшотов' },
  { title: 'Футболки', slug: 't-shirts', genitive: 'женских футболок' },
].map((item) => createAlterationCategory({ ...item, genderLabel: 'Женщинам' }));

const menAlterationCategories = [
  { title: 'Мужские сорочки', slug: 'shirts', genitive: 'мужских сорочек' },
  { title: 'Брюки', slug: 'trousers', genitive: 'мужских брюк' },
  { title: 'Джинсы', slug: 'jeans', genitive: 'мужских джинсов' },
  { title: 'Пиджаки', slug: 'blazers', genitive: 'мужских пиджаков' },
  { title: 'Пальто', slug: 'coats', genitive: 'мужских пальто' },
  { title: 'Куртки', slug: 'jackets', genitive: 'мужских курток' },
  { title: 'Бомберы', slug: 'bombers', genitive: 'мужских бомберов' },
  { title: 'Парки', slug: 'parkas', genitive: 'мужских парок' },
  { title: 'Пуховики', slug: 'down-jackets', genitive: 'мужских пуховиков' },
  { title: 'Дубленки', slug: 'shearling-coats', genitive: 'мужских дубленок' },
  { title: 'Худи', slug: 'hoodies', genitive: 'мужских худи' },
  { title: 'Свитшоты', slug: 'sweatshirts', genitive: 'мужских свитшотов' },
  { title: 'Футболки', slug: 't-shirts', genitive: 'мужских футболок' },
].map((item) => createAlterationCategory({ ...item, genderLabel: 'Мужчинам' }));

export const serviceMenuData = createNode({
  title: 'Услуги',
  slug: 'services',
  path: '/services',
  type: 'services-root',
  seoTitle: 'Услуги ателье — индивидуальный пошив и корректировка изделий',
  seoDescription: 'Услуги Ателье 15/13: индивидуальный пошив, корректировка готовых изделий, работа с посадкой, материалами и деталями одежды.',
  h1: 'Услуги Ателье 15/13',
  introText: 'Основные направления Ателье 15/13: индивидуальный пошив, корректировка готовых изделий и консультация мастера по посадке, материалам и деталям.',
  children: [
    {
      title: 'Корректировка изделий',
      slug: 'alterations',
      type: 'service-branch',
      seoTitle: 'Корректировка изделий — Ателье 15/13',
      seoDescription: 'Корректировка изделий в Ателье 15/13: посадка по фигуре, изменение длины, работа с готовыми и премиальными изделиями.',
      h1: 'Корректировка изделий',
      introText: 'Корректируем готовые изделия по фигуре, длине и деталям после осмотра, примерки и консультации мастера.',
      children: [
        {
          title: 'Женщинам',
          slug: 'women',
          type: 'audience',
          seoTitle: 'Корректировка женской одежды — Ателье 15/13',
          seoDescription: 'Корректировка женской одежды: платья, юбки, брюки, жакеты, пальто, куртки, трикотаж и сложные изделия.',
          h1: 'Корректировка женской одежды',
          introText: 'Подгоняем женские изделия по посадке, длине и деталям с учетом ткани, подкладки и конструкции.',
          children: womenAlterationCategories,
        },
        {
          title: 'Мужчинам',
          slug: 'men',
          type: 'audience',
          seoTitle: 'Корректировка мужской одежды — Ателье 15/13',
          seoDescription: 'Корректировка мужской одежды: сорочки, брюки, пиджаки, пальто, куртки, пуховики и трикотаж.',
          h1: 'Корректировка мужской одежды',
          introText: 'Подгоняем мужские изделия по посадке, длине и деталям с аккуратной обработкой и сохранением внешнего вида.',
          children: menAlterationCategories,
        },
      ],
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
      ],
    },
  ],
});

export default serviceMenuData;
