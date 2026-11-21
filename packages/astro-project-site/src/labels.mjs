// The words the template itself puts on pages: button text, screen-reader names, empty states, alert titles.
// Starlight translates its own interface from the docs locale; these follow the same language (`site.lang`, from
// Starlight's root or default locale), so a site in French is French everywhere. Any label can be overridden with
// the `labels` option, in any language.
//
// A label is a string with `{name}` placeholders, or, when it counts something, plural forms keyed by
// Intl.PluralRules category ({ one: '{n} page', other: '{n} pages' }); `other` is required.

/** @typedef {string | { other: string, zero?: string, one?: string, two?: string, few?: string, many?: string }} Label */

export const EN = Object.freeze({
  // Page chrome
  skipToContent: 'Skip to content',
  siteNav: 'Site',
  siteMenu: 'Site menu',
  footerNav: 'Footer',
  breadcrumbs: 'Breadcrumbs',
  version: 'Version',
  releaseNotes: 'Release notes',
  /** Name of the repository link when the host is not one we know by name (GitHub, GitLab, Codeberg). */
  sourceCode: 'Source code',
  theme: 'Theme',
  themeDark: 'Dark',
  themeLight: 'Light',
  themeAuto: 'Auto',
  /** The footer's copyright line; `footer.copyright` replaces it for one site. */
  copyright: '© {year} {name}',
  // Default nav and section names
  docs: 'Docs',
  documentation: 'Documentation',
  overview: 'Overview',
  /** Under a docs section's card. */
  pageCount: { one: '{n} page', other: '{n} pages' },
  /** Default headings of the landing page's `features` and `steps` sections. */
  featuresTitle: 'Why it exists',
  stepsTitle: 'How it works',
  // Copy buttons
  installCommand: 'Install command',
  copy: 'Copy',
  copied: 'Copied',
  copiedToClipboard: 'Copied to clipboard',
  copyFallback: 'Press Ctrl+C',
  copyPage: 'Copy page',
  markdown: 'Markdown',
  pageCopied: 'Page copied to the clipboard as markdown',
  copyFailed: 'Could not copy',
  pageCopyFailed: 'Could not copy the page',
  wrapLines: 'Wrap lines',
  // Docs sidebar filter
  filter: 'Filter',
  filterNav: 'Filter the navigation',
  pagesMatch: { one: '{n} page matches', other: '{n} pages match' },
  noPagesMatch: 'No pages match',
  // Gallery
  gallery: 'Gallery',
  galleryDescription: 'Demos, examples and tools, running live.',
  galleryAll: 'See the whole gallery',
  galleryEmpty: 'Nothing here yet.',
  galleryShowingAll: { one: 'Showing {n}', other: 'Showing all {n}' },
  galleryShowing: 'Showing {shown} of {n}',
  externalSite: '(external site)',
  tags: 'Tags',
  /** The gallery's filters: "Kind: All demo tool", "Tag: Any canvas …". */
  filterKind: 'Kind',
  filterAll: 'All',
  filterTag: 'Tag',
  filterAny: 'Any',
  // Blog
  blog: 'Blog',
  latestPosts: 'Latest posts',
  allPosts: 'All posts',
  allTags: 'All tags',
  tagged: 'Tagged',
  postsTagged: 'Posts tagged “{tag}”',
  tagsDescription: 'Every topic in {blog}.',
  tagDescription: { one: '{n} post about {tag}.', other: '{n} posts about {tag}.' },
  pageN: 'Page {n}',
  draft: 'Draft',
  updated: 'Updated',
  morePosts: 'More posts',
  pagination: 'Pages',
  newerPosts: 'Newer posts',
  olderPosts: 'Older posts',
  newer: 'Newer',
  older: 'Older',
  pageOf: 'Page {n} of {total}',
  postCount: { one: '{n} post', other: '{n} posts' },
  minRead: '{n} min read',
  editPost: 'Edit this post',
  rssFeed: 'RSS feed',
  noPosts: 'No posts yet.',
  draftsWaiting: {
    one: '1 draft is waiting. Drafts only show in development.',
    other: '{n} drafts are waiting. Drafts only show in development.',
  },
  // Live examples
  liveExample: 'Live example',
  liveNoScript: 'This example runs in the browser and needs JavaScript.',
  editCode: 'Edit the example code',
  editHint: 'Edits re-run the example. Tab inserts spaces; press Escape, then Tab, to leave the editor.',
  liveLoadFailed: "Couldn't load {url} (network error or 404). Check the path, or that the site is still being served.",
  linkToExample: 'Link to this example',
  reset: 'Reset',
  retry: 'Retry',
  details: 'Details',
  // Markdown alerts (> [!NOTE]) and margin notes
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
  fieldNote: 'Field note',
});

/** @typedef {{ [K in keyof typeof EN]: Label }} Labels */

/** Built-in translations. A missing key falls back to English. */
export const TRANSLATIONS = /** @type {Record<string, Partial<Labels>>} */ ({
  en: EN,
  fr: {
    skipToContent: 'Aller au contenu',
    siteNav: 'Site',
    siteMenu: 'Menu du site',
    footerNav: 'Pied de page',
    breadcrumbs: "Fil d'Ariane",
    version: 'Version',
    releaseNotes: 'Notes de version',
    sourceCode: 'Code source',
    theme: 'Thème',
    themeDark: 'Sombre',
    themeLight: 'Clair',
    themeAuto: 'Auto',
    copyright: '© {year} {name}',
    docs: 'Docs',
    documentation: 'Documentation',
    overview: "Vue d'ensemble",
    pageCount: { one: '{n} page', other: '{n} pages' },
    featuresTitle: 'Pourquoi ce projet',
    stepsTitle: 'Comment ça marche',
    installCommand: "Commande d'installation",
    copy: 'Copier',
    copied: 'Copié',
    copiedToClipboard: 'Copié dans le presse-papiers',
    copyFallback: 'Appuyez sur Ctrl+C',
    copyPage: 'Copier la page',
    markdown: 'Markdown',
    pageCopied: 'Page copiée dans le presse-papiers au format Markdown',
    copyFailed: 'Copie impossible',
    pageCopyFailed: 'Impossible de copier la page',
    wrapLines: 'Retour à la ligne',
    filter: 'Filtrer',
    filterNav: 'Filtrer la navigation',
    pagesMatch: { one: '{n} page correspond', other: '{n} pages correspondent' },
    noPagesMatch: 'Aucune page ne correspond',
    gallery: 'Galerie',
    galleryDescription: 'Démos, exemples et outils, en direct.',
    galleryAll: 'Voir toute la galerie',
    galleryEmpty: "Rien pour l'instant.",
    galleryShowingAll: { one: '{n} affiché', other: 'Les {n} affichés' },
    galleryShowing: '{shown} sur {n} affichés',
    externalSite: '(site externe)',
    filterKind: 'Type',
    filterAll: 'Tous',
    filterTag: 'Étiquette',
    filterAny: 'Toutes',
    tags: 'Étiquettes',
    blog: 'Blog',
    latestPosts: 'Derniers articles',
    allPosts: 'Tous les articles',
    allTags: 'Toutes les étiquettes',
    tagged: 'Étiquettes',
    postsTagged: 'Articles étiquetés « {tag} »',
    tagsDescription: 'Tous les sujets de {blog}.',
    tagDescription: { one: '{n} article sur {tag}.', other: '{n} articles sur {tag}.' },
    pageN: 'Page {n}',
    draft: 'Brouillon',
    updated: 'Mis à jour le',
    morePosts: "Plus d'articles",
    pagination: 'Pages',
    newerPosts: 'Articles plus récents',
    olderPosts: 'Articles plus anciens',
    newer: 'Plus récent',
    older: 'Plus ancien',
    pageOf: 'Page {n} sur {total}',
    postCount: { one: '{n} article', other: '{n} articles' },
    minRead: '{n} min de lecture',
    editPost: 'Modifier cet article',
    rssFeed: 'Flux RSS',
    noPosts: "Pas encore d'articles.",
    draftsWaiting: {
      one: '1 brouillon en attente. Les brouillons ne sont visibles qu’en développement.',
      other: '{n} brouillons en attente. Les brouillons ne sont visibles qu’en développement.',
    },
    liveExample: 'Exemple interactif',
    liveNoScript: 'Cet exemple tourne dans le navigateur et nécessite JavaScript.',
    editCode: "Modifier le code de l'exemple",
    editHint: "Chaque modification relance l'exemple. Tab insère des espaces ; appuyez sur Échap, puis Tab, pour quitter l'éditeur.",
    liveLoadFailed: 'Impossible de charger {url} (erreur réseau ou 404). Vérifiez le chemin, ou que le site est toujours servi.',
    linkToExample: 'Lien vers cet exemple',
    reset: 'Réinitialiser',
    retry: 'Réessayer',
    details: 'Détails',
    note: 'Remarque',
    tip: 'Astuce',
    important: 'Important',
    warning: 'Attention',
    caution: 'Prudence',
    fieldNote: 'Note de terrain',
  },
  de: {
    skipToContent: 'Zum Inhalt springen',
    siteNav: 'Website',
    siteMenu: 'Menü',
    footerNav: 'Fußzeile',
    breadcrumbs: 'Brotkrümelnavigation',
    version: 'Version',
    releaseNotes: 'Versionshinweise',
    sourceCode: 'Quellcode',
    theme: 'Farbschema',
    themeDark: 'Dunkel',
    themeLight: 'Hell',
    themeAuto: 'Automatisch',
    copyright: '© {year} {name}',
    docs: 'Doku',
    documentation: 'Dokumentation',
    overview: 'Übersicht',
    pageCount: { one: '{n} Seite', other: '{n} Seiten' },
    featuresTitle: 'Warum es das gibt',
    stepsTitle: 'So funktioniert es',
    installCommand: 'Installationsbefehl',
    copy: 'Kopieren',
    copied: 'Kopiert',
    copiedToClipboard: 'In die Zwischenablage kopiert',
    copyFallback: 'Strg+C drücken',
    copyPage: 'Seite kopieren',
    markdown: 'Markdown',
    pageCopied: 'Seite als Markdown in die Zwischenablage kopiert',
    copyFailed: 'Kopieren fehlgeschlagen',
    pageCopyFailed: 'Die Seite konnte nicht kopiert werden',
    wrapLines: 'Zeilen umbrechen',
    filter: 'Filtern',
    filterNav: 'Navigation filtern',
    pagesMatch: { one: '{n} Seite passt', other: '{n} Seiten passen' },
    noPagesMatch: 'Keine Seite passt',
    gallery: 'Galerie',
    galleryDescription: 'Demos, Beispiele und Werkzeuge, live.',
    galleryAll: 'Ganze Galerie ansehen',
    galleryEmpty: 'Noch nichts hier.',
    galleryShowingAll: { one: '{n} angezeigt', other: 'Alle {n} angezeigt' },
    galleryShowing: '{shown} von {n} angezeigt',
    externalSite: '(externe Website)',
    filterKind: 'Art',
    filterAll: 'Alle',
    filterTag: 'Schlagwort',
    filterAny: 'Alle',
    tags: 'Schlagwörter',
    blog: 'Blog',
    latestPosts: 'Neueste Beiträge',
    allPosts: 'Alle Beiträge',
    allTags: 'Alle Schlagwörter',
    tagged: 'Schlagwörter',
    postsTagged: 'Beiträge zum Schlagwort „{tag}“',
    tagsDescription: 'Alle Themen in {blog}.',
    tagDescription: { one: '{n} Beitrag zu {tag}.', other: '{n} Beiträge zu {tag}.' },
    pageN: 'Seite {n}',
    draft: 'Entwurf',
    updated: 'Aktualisiert',
    morePosts: 'Weitere Beiträge',
    pagination: 'Seiten',
    newerPosts: 'Neuere Beiträge',
    olderPosts: 'Ältere Beiträge',
    newer: 'Neuer',
    older: 'Älter',
    pageOf: 'Seite {n} von {total}',
    postCount: { one: '{n} Beitrag', other: '{n} Beiträge' },
    minRead: '{n} Min. Lesezeit',
    editPost: 'Diesen Beitrag bearbeiten',
    rssFeed: 'RSS-Feed',
    noPosts: 'Noch keine Beiträge.',
    draftsWaiting: {
      one: '1 Entwurf wartet. Entwürfe erscheinen nur in der Entwicklung.',
      other: '{n} Entwürfe warten. Entwürfe erscheinen nur in der Entwicklung.',
    },
    liveExample: 'Live-Beispiel',
    liveNoScript: 'Dieses Beispiel läuft im Browser und braucht JavaScript.',
    editCode: 'Code des Beispiels bearbeiten',
    editHint: 'Änderungen führen das Beispiel neu aus. Tab fügt Leerzeichen ein; Escape, dann Tab verlässt den Editor.',
    liveLoadFailed: '{url} konnte nicht geladen werden (Netzwerkfehler oder 404). Prüfen Sie den Pfad und ob die Website noch ausgeliefert wird.',
    linkToExample: 'Link zu diesem Beispiel',
    reset: 'Zurücksetzen',
    retry: 'Erneut versuchen',
    details: 'Details',
    note: 'Hinweis',
    tip: 'Tipp',
    important: 'Wichtig',
    warning: 'Warnung',
    caution: 'Vorsicht',
    fieldNote: 'Notiz aus der Praxis',
  },
  es: {
    skipToContent: 'Ir al contenido',
    siteNav: 'Sitio',
    siteMenu: 'Menú del sitio',
    footerNav: 'Pie de página',
    breadcrumbs: 'Ruta de navegación',
    version: 'Versión',
    releaseNotes: 'Notas de la versión',
    sourceCode: 'Código fuente',
    theme: 'Tema',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    themeAuto: 'Automático',
    copyright: '© {year} {name}',
    docs: 'Docs',
    documentation: 'Documentación',
    overview: 'Resumen',
    pageCount: { one: '{n} página', other: '{n} páginas' },
    featuresTitle: 'Por qué existe',
    stepsTitle: 'Cómo funciona',
    installCommand: 'Comando de instalación',
    copy: 'Copiar',
    copied: 'Copiado',
    copiedToClipboard: 'Copiado al portapapeles',
    copyFallback: 'Pulsa Ctrl+C',
    copyPage: 'Copiar página',
    markdown: 'Markdown',
    pageCopied: 'Página copiada al portapapeles como Markdown',
    copyFailed: 'No se pudo copiar',
    pageCopyFailed: 'No se pudo copiar la página',
    wrapLines: 'Ajustar líneas',
    filter: 'Filtrar',
    filterNav: 'Filtrar la navegación',
    pagesMatch: { one: '{n} página coincide', other: '{n} páginas coinciden' },
    noPagesMatch: 'Ninguna página coincide',
    gallery: 'Galería',
    galleryDescription: 'Demos, ejemplos y herramientas, en vivo.',
    galleryAll: 'Ver toda la galería',
    galleryEmpty: 'Aún no hay nada.',
    galleryShowingAll: { one: 'Mostrando {n}', other: 'Mostrando los {n}' },
    galleryShowing: 'Mostrando {shown} de {n}',
    externalSite: '(sitio externo)',
    filterKind: 'Tipo',
    filterAll: 'Todos',
    filterTag: 'Etiqueta',
    filterAny: 'Cualquiera',
    tags: 'Etiquetas',
    blog: 'Blog',
    latestPosts: 'Últimas entradas',
    allPosts: 'Todas las entradas',
    allTags: 'Todas las etiquetas',
    tagged: 'Etiquetas',
    postsTagged: 'Entradas con la etiqueta «{tag}»',
    tagsDescription: 'Todos los temas de {blog}.',
    tagDescription: { one: '{n} entrada sobre {tag}.', other: '{n} entradas sobre {tag}.' },
    pageN: 'Página {n}',
    draft: 'Borrador',
    updated: 'Actualizado',
    morePosts: 'Más entradas',
    pagination: 'Páginas',
    newerPosts: 'Entradas más recientes',
    olderPosts: 'Entradas anteriores',
    newer: 'Más reciente',
    older: 'Más antigua',
    pageOf: 'Página {n} de {total}',
    postCount: { one: '{n} entrada', other: '{n} entradas' },
    minRead: '{n} min de lectura',
    editPost: 'Editar esta entrada',
    rssFeed: 'Canal RSS',
    noPosts: 'Aún no hay entradas.',
    draftsWaiting: {
      one: 'Hay 1 borrador en espera. Los borradores solo se ven en desarrollo.',
      other: 'Hay {n} borradores en espera. Los borradores solo se ven en desarrollo.',
    },
    liveExample: 'Ejemplo en vivo',
    liveNoScript: 'Este ejemplo se ejecuta en el navegador y necesita JavaScript.',
    editCode: 'Editar el código del ejemplo',
    editHint: 'Cada cambio vuelve a ejecutar el ejemplo. Tab inserta espacios; pulsa Escape y luego Tab para salir del editor.',
    liveLoadFailed: 'No se pudo cargar {url} (error de red o 404). Comprueba la ruta o que el sitio se siga sirviendo.',
    linkToExample: 'Enlace a este ejemplo',
    reset: 'Restablecer',
    retry: 'Reintentar',
    details: 'Detalles',
    note: 'Nota',
    tip: 'Consejo',
    important: 'Importante',
    warning: 'Advertencia',
    caution: 'Precaución',
    fieldNote: 'Nota de campo',
  },
});

/**
 * Language and direction of the site, from Starlight's locales: the root locale, else the `defaultLocale`, else
 * English. Docs pages get theirs from Starlight; every other page (landing, gallery, blog) uses this.
 * @param {Record<string, any> | undefined} starlight the `starlight` option
 * @returns {{ lang: string, dir: 'ltr' | 'rtl' }}
 */
export function siteLocale(starlight) {
  const locales = starlight?.locales;
  if (locales && typeof locales === 'object') {
    const key = 'root' in locales ? 'root' : starlight?.defaultLocale in locales ? starlight?.defaultLocale : undefined;
    const locale = key ? locales[key] : undefined;
    if (locale) return { lang: String(locale.lang ?? (key === 'root' ? 'en' : key)), dir: locale.dir === 'rtl' ? 'rtl' : 'ltr' };
  }
  return { lang: 'en', dir: 'ltr' };
}

export const LABEL_NAMES = Object.freeze(/** @type {(keyof typeof EN)[]} */ (Object.keys(EN)));

/**
 * The labels for `lang` (a BCP 47 tag: `fr`, `pt-BR`): the closest built-in translation (`pt-BR`, then `pt`), then
 * English for anything it lacks, then `overrides` on top.
 * @param {string} lang
 * @param {Partial<Labels>} [overrides]
 * @returns {Labels}
 */
export function resolveLabels(lang, overrides = {}) {
  const tags = [];
  for (let parts = String(lang || 'en').toLowerCase().split('-'); parts.length; parts.pop()) tags.push(parts.join('-'));
  const base = tags.map((t) => TRANSLATIONS[t]).find(Boolean) ?? {};
  return Object.freeze({ ...EN, ...base, ...overrides });
}

/**
 * A label with its placeholders filled. `n` (when given) also picks the plural form for `lang`.
 * @param {Label} label
 * @param {Record<string, string | number>} [vars]
 * @param {string} [lang]
 */
export function format(label, vars = {}, lang = 'en') {
  let text = typeof label === 'string' ? label : label.other;
  if (typeof label === 'object' && typeof vars.n === 'number') {
    const exact = vars.n === 0 && label.zero;
    let category = 'other';
    try {
      category = new Intl.PluralRules(lang).select(vars.n);
    } catch {
      category = vars.n === 1 ? 'one' : 'other';
    }
    text = exact || /** @type {Record<string, string | undefined>} */ (label)[category] || label.other;
  }
  return text.replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all));
}
