import { serviceMenuData } from './serviceMenuData.js';

export function normalizeServicePath(path) {
  if (!path || path === '/') return '/';
  const cleanPath = path.split('?')[0].split('#')[0];
  return cleanPath.length > 1 ? cleanPath.replace(/\/+$/, '') : cleanPath;
}

export function flattenServiceMenu(root = serviceMenuData) {
  const pages = [];

  function walk(node, parentPath = null, depth = 0) {
    const page = {
      ...node,
      parentPath,
      depth,
    };

    pages.push(page);
    node.children.forEach((child) => walk(child, node.path, depth + 1));
  }

  walk(root);
  return pages;
}

export const servicePages = flattenServiceMenu(serviceMenuData);

export const serviceRouteMap = servicePages.reduce((routes, page) => {
  routes[normalizeServicePath(page.path)] = page;
  return routes;
}, {});

export function findServicePageByPath(path) {
  return serviceRouteMap[normalizeServicePath(path)] || null;
}

export function getServiceBreadcrumbs(path) {
  const breadcrumbs = [{ title: 'Главная', path: '/' }];
  let currentPage = findServicePageByPath(path);
  const stack = [];

  while (currentPage) {
    stack.unshift({
      title: currentPage.title,
      path: currentPage.path,
    });

    currentPage = currentPage.parentPath ? findServicePageByPath(currentPage.parentPath) : null;
  }

  return breadcrumbs.concat(stack);
}

export function getServicePagesForSitemap() {
  return servicePages.map((page) => ({
    path: page.path,
    title: page.title,
    type: page.type,
  }));
}

export function validateServiceMenu(root = serviceMenuData) {
  const pages = flattenServiceMenu(root);
  const requiredFields = [
    'title',
    'slug',
    'path',
    'type',
    'seoTitle',
    'seoDescription',
    'canonical',
    'h1',
    'introText',
    'heroUsp',
    'availableOptions',
    'materials',
    'galleryItems',
    'whyItems',
    'pricingFactors',
    'priceNote',
    'processSteps',
    'faq',
    'ctaLabel',
    'relatedPages',
    'children',
  ];
  const seenPaths = new Set();
  const errors = [];

  pages.forEach((page) => {
    requiredFields.forEach((field) => {
      if (page[field] === undefined || page[field] === null) {
        errors.push(`${page.path}: missing required field "${field}"`);
      }
    });

    if (seenPaths.has(page.path)) {
      errors.push(`${page.path}: duplicate path`);
    }

    if (!page.path.startsWith('/services')) {
      errors.push(`${page.path}: service path must start with /services`);
    }

    if (page.canonical !== page.path) {
      errors.push(`${page.path}: canonical must match path at the architecture stage`);
    }

    if (!Array.isArray(page.children)) {
      errors.push(`${page.path}: children must be an array`);
    }

    if (!Array.isArray(page.availableOptions)) {
      errors.push(`${page.path}: availableOptions must be an array`);
    }

    if (!Array.isArray(page.materials)) {
      errors.push(`${page.path}: materials must be an array`);
    }

    if (!Array.isArray(page.galleryItems)) {
      errors.push(`${page.path}: galleryItems must be an array`);
    }

    if (!Array.isArray(page.whyItems)) {
      errors.push(`${page.path}: whyItems must be an array`);
    }

    if (!Array.isArray(page.pricingFactors)) {
      errors.push(`${page.path}: pricingFactors must be an array`);
    }

    if (!Array.isArray(page.processSteps)) {
      errors.push(`${page.path}: processSteps must be an array`);
    }

    if (!Array.isArray(page.faq)) {
      errors.push(`${page.path}: faq must be an array`);
    }

    if (!Array.isArray(page.relatedPages)) {
      errors.push(`${page.path}: relatedPages must be an array`);
    }

    seenPaths.add(page.path);
  });

  return {
    valid: errors.length === 0,
    pageCount: pages.length,
    errors,
  };
}
