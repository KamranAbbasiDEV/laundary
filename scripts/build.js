const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SRC_ASSETS = path.join(ROOT, 'src', 'assets');

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8').replace(/^\uFEFF/, ''));
const toolsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tools.json'), 'utf8').replace(/^\uFEFF/, ''));
const conversions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'conversions.json'), 'utf8').replace(/^\uFEFF/, ''));

const tools = dedupeTools(toolsRaw);
const liveTools = tools.filter(t => t.status === 'live');
const categories = site.categories;
const categoryPages = site.categoryPages || [];
const UPLOAD_CATEGORIES = new Set(['document', 'image', 'video', 'audio']);
const OG_IMAGE = `${site.domain}/og-image.svg`;

function dedupeTools(list) {
  const seen = new Set();
  return list.filter(t => {
    if (seen.has(t.slug)) return false;
    seen.add(t.slug);
    return true;
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCategoryName(id) {
  return categories.find(c => c.id === id)?.name || id;
}

function metaDesc(text, max = 158) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${sp > max * 0.6 ? cut.slice(0, sp) : cut}…`;
}

function requiresUpload(tool) {
  if (tool.requiresUpload === true) return true;
  if (tool.requiresUpload === false) return false;
  return UPLOAD_CATEGORIES.has(tool.category);
}

function getCategoryPage(cat) {
  return categoryPages.find(p => p.category === cat || (p.categories || []).includes(cat));
}

function categoryPageUrl(cat) {
  const page = getCategoryPage(cat);
  if (!page) return cat === 'converter' ? '/converters/' : '/tools/';
  return `/${page.slug}/`;
}

function toolsForCategoryPage(page) {
  if (page.categories) {
    return liveTools.filter(t => page.categories.includes(t.category));
  }
  return liveTools.filter(t => t.category === page.category);
}

function buildOrgSchema() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.domain,
    logo: `${site.domain}/assets/favicon.svg`,
    description: site.tagline
  });
}

function buildBreadcrumbSchema(items) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url
    }))
  });
}

function buildItemListSchema(name, items) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: `${site.domain}/${item.slug}/`
    }))
  });
}

function getToolBySlug(slug) {
  return tools.find(t => t.slug === slug);
}

function getMostUsedTools(limit = 12) {
  const slugs = site.mostUsedTools || [];
  if (slugs.length) {
    return slugs
      .map(s => liveTools.find(t => t.slug === s || t.id === s))
      .filter(Boolean)
      .slice(0, limit);
  }
  return liveTools.filter(t => t.popular).slice(0, limit);
}

function defaultFaqs(tool) {
  const upload = requiresUpload(tool);
  return [
    {
      q: `Is ${tool.name} free to use?`,
      a: `Yes. ${tool.name} on JotNexus is 100% free with no signup required.`
    },
    {
      q: 'Is my data uploaded to a server?',
      a: upload
        ? 'You may upload a file from your device, but it is processed locally in your browser. Your file is not sent to JotNexus servers.'
        : tool.privacy === 'client-only'
          ? 'No. This tool runs entirely in your browser. Your data never leaves your device.'
          : 'Most processing happens in your browser. Some features may use lightweight public APIs — see the privacy badge on the tool page.'
    },
    {
      q: 'Does JotNexus work on mobile?',
      a: 'Yes. All JotNexus tools are responsive and work on phones, tablets, and desktops.'
    },
    {
      q: `How do I use ${tool.name}?`,
      a: upload
        ? `Drag and drop your file onto the upload area, or click to browse. Then use the action button — results appear instantly in your browser. No account required.`
        : `Enter your input in the tool above and results update instantly. No account or download required.`
    },
    {
      q: `Can I use ${tool.name} on my phone?`,
      a: 'Yes. JotNexus tools work on iPhone, Android, tablets, and desktop browsers.'
    }
  ];
}

function buildFaqHtml(faqs) {
  return faqs.map(f => `
    <details class="faq-item">
      <summary>${esc(f.q)}</summary>
      <p>${esc(f.a)}</p>
    </details>`).join('\n');
}

function buildFaqSchema(tool, faqs) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  });
}

function buildWebAppSchema(tool) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tool.name,
    url: `${site.domain}/${tool.slug}/`,
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript. Works in Chrome, Firefox, Safari, and Edge.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: tool.description,
    inLanguage: 'en',
    isAccessibleForFree: true,
    featureList: requiresUpload(tool)
      ? 'Drag and drop upload, local file processing, instant download'
      : 'Instant browser processing, no signup, copy and download results'
  });
}

function buildWebPageSchema(title, description, url) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: metaDesc(description),
    url,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: site.name, url: site.domain }
  });
}

function buildHowToSchema(tool) {
  if (!requiresUpload(tool)) return null;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to use ${tool.name} online free`,
    description: tool.description,
    totalTime: 'PT1M',
    tool: [{ '@type': 'HowToTool', name: 'Web browser' }],
    step: [
      { '@type': 'HowToStep', position: 1, name: 'Open the tool', text: `Open ${tool.name} on JotNexus in any modern browser.` },
      { '@type': 'HowToStep', position: 2, name: 'Add your file', text: 'Drag and drop your file onto the upload area, or click to browse from your device.' },
      { '@type': 'HowToStep', position: 3, name: 'Process and download', text: 'Click the action button. Your file is processed locally in your browser, then download the result.' }
    ]
  });
}

function toolSeoTitle(tool) {
  return `${tool.name} Online Free — No Signup | ${site.name}`;
}

function toolSeoDescription(tool) {
  const upload = requiresUpload(tool);
  const extra = upload
    ? 'Drag and drop or upload your file — processed locally in your browser.'
    : 'Instant results in your browser. No download required.';
  return metaDesc(`${tool.description} Free ${getCategoryName(tool.category).toLowerCase()} tool — ${extra} ${tool.keywords.split(' ').slice(0, 8).join(', ')}.`);
}

function toolSeoBody(tool) {
  const upload = requiresUpload(tool);
  const cat = getCategoryName(tool.category);
  const catLink = categoryPageUrl(tool.category);
  const terms = tool.keywords.split(' ').slice(0, 8).join(', ');
  if (upload) {
    return `${esc(tool.name)} is a free online ${esc(cat.toLowerCase())} tool on ${esc(site.name)}. ${esc(tool.description)} Drag and drop your file or click to upload — processing happens on your device, not our servers. Works on desktop and mobile. Also try other <a href="${catLink}">${esc(cat)} tools</a>. Searches: ${esc(terms)}.`;
  }
  return `${esc(tool.name)} is a free online ${esc(cat.toLowerCase())} tool on ${esc(site.name)}. ${esc(tool.description)} Paste or type your input above for instant results — no account, no install. Browse more <a href="${catLink}">${esc(cat)} tools</a>. Searches: ${esc(terms)}.`;
}

function toolHowItWorks(tool) {
  const upload = requiresUpload(tool);
  if (upload) {
    return esc(`${tool.description} Drag and drop a file onto the upload area above, or click to browse. Processing runs entirely in your browser — your file is never sent to JotNexus servers.`);
  }
  return esc(`${tool.description} Enter your input above for instant results. Everything runs in your browser — no account and no data sent to our servers.`);
}

function adSlot(id, type = 'display') {
  const client = site.adsenseClient;
  if (client.includes('XXXX')) {
    return `<div class="ad-slot ad-slot--${type}" data-ad-slot="${id}" aria-hidden="true">
      <span class="ad-placeholder">Ad space · Replace ca-pub ID in data/site.json after AdSense approval</span>
    </div>`;
  }
  return `<ins class="adsbygoogle ad-slot ad-slot--${type}"
    style="display:block"
    data-ad-client="${client}"
    data-ad-slot="${id}"
    data-ad-format="auto"
    data-full-width-responsive="true"></ins>`;
}

function layout({ title, description, canonical, bodyClass = '', content, scripts = [], jsonLd = [], keywords = '' }) {
  const scriptTags = scripts.map(s => `<script src="/assets/js/${s}" defer></script>`).join('\n');
  const desc = metaDesc(description);
  const allLd = [buildOrgSchema(), ...jsonLd];
  const ld = allLd.map(j => `<script type="application/ld+json">${j}</script>`).join('\n');
  const kw = keywords ? `<meta name="keywords" content="${esc(keywords)}">` : '';
  const gsv = site.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  ${kw}
  ${gsv}
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="author" content="${esc(site.name)}">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="sitemap" type="application/xml" href="/sitemap.xml">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(site.name)}">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(OG_IMAGE)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(site.name)} — free online tools">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(OG_IMAGE)}">
  <meta name="theme-color" content="#ffffff">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/main.css">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(site.adsenseClient)}" crossorigin="anonymous"></script>
  ${ld}
</head>
<body class="${bodyClass}">
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/">
        <svg class="logo-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#18181b"/><path fill="#fff" d="M9 22V10h3.2l4.8 2.4L21.8 10H25v12h-3.2l-4.8-2.6L12.2 22H9z"/></svg>
        <span>${esc(site.name)}</span>
      </a>
      <nav class="header-nav">
        <a href="/tools/">Categories</a>
        <a href="/converters/">Converters</a>
        <a href="/privacy/">Privacy</a>
      </nav>
    </div>
  </header>
  <main>${content}</main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <strong>${esc(site.name)}</strong>
        <p>${esc(site.tagline)}</p>
      </div>
      <div class="footer-links">
        <a href="/tools/">All categories</a>
        <a href="/converters/">Converters</a>
        <a href="/#tools">All tools</a>
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
      </div>
      <p class="footer-copy">&copy; ${new Date().getFullYear()} ${esc(site.name)}. Free utilities, built for the browser.</p>
    </div>
  </footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <script src="/assets/js/shared.js" defer></script>
  ${scriptTags}
  <script src="/assets/js/main.js" defer></script>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</body>
</html>`;
}

function privacyBadge(tool) {
  if (tool.privacy === 'client-only') {
    return `<div class="privacy-badge privacy-badge--safe">Runs locally in your browser</div>`;
  }
  return `<div class="privacy-badge privacy-badge--api">May use external APIs when required</div>`;
}

function toolBadges(tool) {
  const badges = [];
  if (requiresUpload(tool)) {
    badges.push('<div class="privacy-badge privacy-badge--upload">Drag & drop or upload · processed locally</div>');
  }
  badges.push(privacyBadge(tool));
  return `<div class="tool-badges">${badges.join('')}</div>`;
}

function relatedTools(tool) {
  const related = (tool.related || [])
    .map(slug => getToolBySlug(slug))
    .filter(Boolean)
    .slice(0, 6);
  if (!related.length) return '';
  return `<section class="related-tools">
    <h2>Related Tools</h2>
    <div class="related-grid">${related.map(r =>
      `<a class="related-card" href="/${r.slug}/">${esc(r.name)}</a>`
    ).join('')}</div>
  </section>`;
}

function toolPage(tool) {
  const faqs = defaultFaqs(tool);
  const canonical = `${site.domain}/${tool.slug}/`;
  const isLive = tool.status === 'live';

  const toolArea = isLive
    ? `<div id="tool-root" class="tool-root" data-tool="${tool.id}" data-tool-desc="${esc(tool.description)}" data-tool-category="${esc(tool.category)}"></div>`
    : `<div class="coming-soon">
        <p>This tool is on the roadmap and will be live soon.</p>
        <a class="btn" href="/">Browse ${liveTools.length}+ live tools</a>
      </div>`;

  const content = `
    ${adSlot('header-leaderboard', 'leaderboard')}
    <article class="tool-page container">
      <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="${categoryPageUrl(tool.category)}">${esc(getCategoryName(tool.category))}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(tool.name)}</span></nav>
      <header class="tool-header">
        <h1>${esc(tool.name)}</h1>
        <p class="tool-lead">${esc(tool.description)}</p>
        ${toolBadges(tool)}
      </header>
      <section class="tool-workspace" aria-label="Tool">
        <p class="tool-workspace-label">Tool</p>
        ${toolArea}
      </section>
      ${adSlot('in-content-1', 'rectangle')}
      <div class="content-block">
        <h2>How it works</h2>
        <p>${toolHowItWorks(tool)}</p>
        <ul>
          <li>${requiresUpload(tool) ? 'Drag and drop or click to upload your file' : 'Type or paste your input above'}</li>
          <li>Free to use — no signup or install</li>
          <li>Works on desktop, tablet, and mobile</li>
          <li>Processed locally in your browser for privacy</li>
        </ul>
      </div>
      <div class="content-block">
        <h2>About this free ${esc(getCategoryName(tool.category).toLowerCase())} tool</h2>
        <p>${toolSeoBody(tool)}</p>
      </div>
      <div class="content-block">
        <h2>Privacy</h2>
        <p>${tool.privacy === 'client-only' ? 'This tool processes data entirely in your browser. Nothing is sent to JotNexus servers.' : 'Most processing happens locally. Some features may call third-party APIs — only when necessary and clearly indicated above.'}</p>
      </div>
      <section class="faq-section">
        <h2>Frequently Asked Questions</h2>
        ${buildFaqHtml(faqs)}
      </section>
      ${relatedTools(tool)}
    </article>
    ${adSlot('footer', 'leaderboard')}`;

  const scripts = isLive ? ['tools/all-tools.js'] : [];

  const pageTitle = toolSeoTitle(tool);
  const pageDesc = toolSeoDescription(tool);
  const howTo = buildHowToSchema(tool);
  const jsonLd = [
    buildBreadcrumbSchema([
      { name: 'Home', url: `${site.domain}/` },
      { name: getCategoryName(tool.category), url: `${site.domain}${categoryPageUrl(tool.category)}` },
      { name: tool.name, url: canonical }
    ]),
    buildWebPageSchema(pageTitle, pageDesc, canonical),
    buildWebAppSchema(tool),
    buildFaqSchema(tool, faqs)
  ];
  if (howTo) jsonLd.push(howTo);

  return layout({
    title: pageTitle,
    description: pageDesc,
    keywords: tool.keywords,
    canonical,
    bodyClass: 'page-tool',
    content,
    scripts,
    jsonLd
  });
}

function convertPage(conv) {
  const from = conv.from;
  const to = conv.to;
  const slug = `${from}-to-${to}`;
  const title = `Convert ${from} to ${to} — Free Online Converter`;
  const description = metaDesc(`Convert ${from} to ${to} instantly with our free online calculator. No signup, runs in your browser. Accurate ${from} to ${to} conversion at JotNexus.`);
  const canonical = `${site.domain}/convert/${slug}/`;
  const faqs = [
    { q: `How do I convert ${from} to ${to}?`, a: `Enter a value in ${from} above and the converter instantly shows the equivalent in ${to}. No signup or download required.` },
    { q: `How many ${to} is 1 ${from}?`, a: `Use the converter above — enter 1 in the ${from} field to see the exact ${to} equivalent instantly.` },
    { q: `Is this ${from} to ${to} converter free?`, a: 'Yes. This converter is 100% free and runs in your browser on JotNexus.' },
    { q: 'Is my data sent to a server?', a: 'No. Unit conversion runs entirely in your browser. Your numbers never leave your device.' },
    { q: `What is ${from} to ${to} used for?`, a: `People use ${from} to ${to} conversion for cooking, travel, science, engineering, schoolwork, and everyday measurements.` }
  ];

  const content = `
    ${adSlot('header-leaderboard', 'leaderboard')}
    <article class="tool-page container">
      <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/converters/">Converters</a><span aria-hidden="true">/</span><span aria-current="page">${esc(from)} to ${esc(to)}</span></nav>
      <header class="tool-header">
        <h1>Convert ${esc(from)} to ${esc(to)}</h1>
        <p class="tool-lead">Free ${esc(from)} to ${esc(to)} converter — instant results in your browser. No signup required.</p>
        <div class="tool-badges"><div class="privacy-badge privacy-badge--safe">Runs locally in your browser</div></div>
      </header>
      <section class="tool-workspace">
        <p class="tool-workspace-label">Converter</p>
        <div id="tool-root" class="tool-root" data-tool="unit-converter" data-from="${esc(from)}" data-to="${esc(to)}"></div>
      </section>
      ${adSlot('in-content-1', 'rectangle')}
      <div class="content-block">
        <h2>About this ${esc(from)} to ${esc(to)} converter</h2>
        <p>Use this free online converter to transform ${esc(from)} values into ${esc(to)} instantly. Enter a number above, copy the result, and bookmark this page for quick access. Part of JotNexus — ${liveTools.length}+ free tools with no account required.</p>
        <p>Looking for other units? Browse our <a href="/converters/">full converters hub</a> with ${conversions.length}+ dedicated conversion pages.</p>
      </div>
      <section class="faq-section">
        <h2>Frequently Asked Questions</h2>
        ${buildFaqHtml(faqs)}
      </section>
    </article>`;

  const convTitle = `${from} to ${to} Converter — Free Online | ${site.name}`;
  return layout({
    title: convTitle,
    description,
    keywords: `${from} to ${to}, convert ${from} to ${to}, ${from} ${to} calculator, ${to} converter, unit converter online free`,
    canonical,
    bodyClass: 'page-tool page-convert',
    content,
    scripts: ['tools/all-tools.js'],
    jsonLd: [
      buildBreadcrumbSchema([
        { name: 'Home', url: `${site.domain}/` },
        { name: 'Converters', url: `${site.domain}/converters/` },
        { name: `${from} to ${to}`, url: canonical }
      ]),
      buildWebPageSchema(convTitle, description, canonical),
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: title,
        url: canonical,
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description
      }),
      buildFaqSchema({ name: title }, faqs)
    ]
  });
}

function toolCard(t) {
  const cat = getCategoryName(t.category);
  const uploadBadge = requiresUpload(t) ? '<span class="tool-card-badge tool-card-badge--upload">File upload</span>' : '';
  return `<a class="tool-card" href="/${t.slug}/" data-name="${esc(t.name.toLowerCase())}" data-category="${t.category}" data-keywords="${esc(t.keywords)}" data-popular="${t.popular ? '1' : '0'}" data-upload="${requiresUpload(t) ? '1' : '0'}">
      <div class="tool-card-meta">
        <span class="tool-card-cat">${esc(cat)}</span>
        ${uploadBadge}
      </div>
      <h3>${esc(t.name)}</h3>
      <p>${esc(t.description)}</p>
    </a>`;
}

function homePage() {
  const allCards = liveTools.map(toolCard).join('\n');

  const catFilters = categories
    .filter(c => liveTools.some(t => t.category === c.id))
    .map(c => `<button class="filter-btn" data-filter="${c.id}">${esc(c.name)}</button>`)
    .join('');

  const sections = site.homepageSections || [];
  const jumpLinks = sections
    .filter(s => s.type !== 'all')
    .map(s => `<a class="section-jump-link" href="#section-${s.id}">${esc(s.title)}</a>`)
    .join('');

  function sectionBlock(sec, list) {
    if (!list.length) return '';
    const filter = sec.category || (sec.categories && sec.categories[0]) || '';
    const moreHref = sec.type === 'popular'
      ? '#tools'
      : sec.type === 'categories' && sec.categories
        ? categoryPageUrl(sec.categories[0])
        : filter === 'converter'
          ? '/converters/'
          : categoryPageUrl(filter);
    return `
    <section class="tool-section homepage-section" id="section-${sec.id}" data-section-id="${sec.id}">
      <div class="container">
        <div class="tool-section-head">
          <h2>${esc(sec.title)}</h2>
          ${sec.subtitle ? `<p>${esc(sec.subtitle)}</p>` : ''}
        </div>
        <div class="tools-grid section-grid">${list.map(toolCard).join('\n')}</div>
        ${list.length > 6 ? `<p class="section-more-wrap"><a class="section-more" href="${moreHref}">View all ${esc(sec.title).toLowerCase()} →</a></p>` : ''}
      </div>
    </section>`;
  }

  const sectionHtml = sections.map(sec => {
    if (sec.type === 'popular') {
      const list = getMostUsedTools(sec.limit || 12);
      if (!list.length) return sectionBlock(sec, liveTools.slice(0, sec.limit || 12));
      return sectionBlock(sec, list);
    }
    if (sec.type === 'category') {
      return sectionBlock(sec, liveTools.filter(t => t.category === sec.category));
    }
    if (sec.type === 'categories') {
      return sectionBlock(sec, liveTools.filter(t => (sec.categories || []).includes(t.category)));
    }
    if (sec.type === 'all') {
      return `
    <section class="tools-section tool-section-all" id="tools">
      <div class="container">
        <div class="tool-section-head">
          <h2>${esc(sec.title)}</h2>
          ${sec.subtitle ? `<p>${esc(sec.subtitle)}</p>` : ''}
        </div>
        <div class="filter-bar">
          <button class="filter-btn active" data-filter="all">All</button>
          ${catFilters}
        </div>
        <div class="tools-grid" id="tools-grid">${allCards}</div>
        <p class="grid-empty hidden" id="no-results">No tools match your search. Try a different keyword or category.</p>
      </div>
    </section>`;
    }
    return '';
  }).join('\n');

  const content = `
    <section class="hero">
      <div class="container hero-inner">
        <p class="hero-eyebrow">${liveTools.length} tools · No signup · Your files stay on your device</p>
        <h1>Every utility you need — one hub, zero friction</h1>
        <p class="hero-sub">${esc(site.description)}</p>
        <div class="search-panel">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3-3"/></svg>
          <input type="search" id="tool-search" placeholder="Search ${liveTools.length}+ tools…" autocomplete="off" aria-label="Search tools">
          <kbd class="search-kbd" aria-hidden="true">/</kbd>
        </div>
        <p class="search-meta" id="search-meta" aria-live="polite">${liveTools.length} tools available</p>
      </div>
    </section>
    ${adSlot('home-mid', 'leaderboard')}
    <nav class="section-jump container" aria-label="Tool categories"><a class="section-jump-link" href="/tools/">All categories</a><a class="section-jump-link" href="/converters/">Converters hub</a>${jumpLinks}<a class="section-jump-link" href="#tools">All tools</a></nav>
    ${sectionHtml}
    <section class="values-strip">
      <div class="container">
        <h2>Why ${esc(site.name)}</h2>
        <div class="values-grid">
          <div class="value-card"><strong>Private by default</strong><p>Text tools run instantly in your browser. File tools let you upload PDFs, images, or media — processed locally, never sent to our servers.</p></div>
          <div class="value-card"><strong>No friction</strong><p>No accounts, no paywalls, no waiting in a queue. Open a tool and get to work.</p></div>
          <div class="value-card"><strong>Complete toolkit</strong><p>${liveTools.length} tools plus ${conversions.length} converter pages — documents, media, dev utilities, finance, and more in one place.</p></div>
        </div>
      </div>
    </section>`;

  return layout({
    title: `${site.name} — ${liveTools.length}+ Free Online Tools, No Signup`,
    description: site.description,
    keywords: `free online tools, pdf tools, image tools, video converter, unit converter, developer tools, ${liveTools.length} utilities`,
    canonical: `${site.domain}/`,
    bodyClass: 'page-home',
    content,
    jsonLd: [
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        url: site.domain,
        description: site.description,
        publisher: { '@type': 'Organization', name: site.name, url: site.domain },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${site.domain}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      }),
      buildItemListSchema(`${site.name} popular tools`, getMostUsedTools(12))
    ]
  });
}

function convertersHubPage() {
  const byType = {};
  for (const c of conversions) {
    if (!byType[c.type]) byType[c.type] = [];
    byType[c.type].push(c);
  }
  const sections = Object.entries(byType).map(([type, list]) => `
    <div class="converter-type-block">
      <h3>${esc(type.charAt(0).toUpperCase() + type.slice(1))}</h3>
      <div class="converter-links">${list.map(c =>
        `<a class="related-card" href="/convert/${esc(c.from)}-to-${esc(c.to)}/">${esc(c.from)} → ${esc(c.to)}</a>`
      ).join('')}</div>
    </div>`).join('');

  const converterTools = liveTools.filter(t => t.category === 'converter').map(toolCard).join('\n');

  const content = `
    <article class="tool-page container">
      <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">Converters</span></nav>
      <header class="tool-header">
        <h1>Converters A–Z</h1>
        <p class="tool-lead">${conversions.length} dedicated conversion pages plus ${liveTools.filter(t=>t.category==='converter').length} interactive converter tools. All free, all in your browser.</p>
      </header>
      <section class="tool-section-head"><h2>Interactive converter tools</h2></section>
      <div class="tools-grid section-grid">${converterTools}</div>
      <section class="tool-section-head" style="margin-top:2.5rem"><h2>All conversion pages (${conversions.length})</h2><p>SEO-optimized pages for specific unit pairs</p></section>
      <div class="converter-hub-grid">${sections}</div>
    </article>`;

  return layout({
    title: `Converters A–Z — ${conversions.length}+ Free Online Converters | ${site.name}`,
    description: metaDesc(`Browse ${conversions.length}+ free online converters for length, weight, temperature, volume, pressure, digital storage, cooking units, and more. No signup.`),
    keywords: 'unit converter, length converter, weight converter, temperature converter, free online converter',
    canonical: `${site.domain}/converters/`,
    bodyClass: 'page-converters',
    content,
    jsonLd: [
      buildBreadcrumbSchema([
        { name: 'Home', url: `${site.domain}/` },
        { name: 'Converters', url: `${site.domain}/converters/` }
      ]),
      buildItemListSchema('JotNexus converters', liveTools.filter(t => t.category === 'converter'))
    ]
  });
}

function categoryLandingPage(page) {
  const list = toolsForCategoryPage(page);
  const canonical = `${site.domain}/${page.slug}/`;
  const cards = list.map(toolCard).join('\n');
  const otherCats = categoryPages
    .filter(p => p.slug !== page.slug)
    .map(p => `<a class="related-card" href="/${p.slug}/">${esc(p.h1)}</a>`)
    .join('');

  const content = `
    ${adSlot('header-leaderboard', 'leaderboard')}
    <article class="tool-page container category-page">
      <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/tools/">Categories</a><span aria-hidden="true">/</span><span aria-current="page">${esc(page.h1)}</span></nav>
      <header class="category-hero">
        <h1>${esc(page.h1)}</h1>
        <p class="tool-lead">${esc(page.intro)}</p>
        <p class="category-stat">${list.length} free tools · No signup · ${UPLOAD_CATEGORIES.has(page.category) || (page.categories || []).some(c => UPLOAD_CATEGORIES.has(c)) ? 'Local file processing' : 'Runs in your browser'}</p>
      </header>
      ${adSlot('in-content-1', 'rectangle')}
      <div class="tools-grid section-grid">${cards}</div>
      <section class="content-block">
        <h2>About ${esc(page.h1)} on ${esc(site.name)}</h2>
        <p>${esc(page.description)} Browse all ${list.length} tools below, or explore other categories.</p>
      </section>
      <section class="related-tools">
        <h2>More tool categories</h2>
        <div class="related-grid">${otherCats}<a class="related-card" href="/converters/">Converters A–Z</a></div>
      </section>
    </article>`;

  return layout({
    title: `${page.title} | ${site.name}`,
    description: page.description,
    keywords: page.description.split(' ').slice(0, 12).join(', '),
    canonical,
    bodyClass: 'page-category',
    content,
    jsonLd: [
      buildBreadcrumbSchema([
        { name: 'Home', url: `${site.domain}/` },
        { name: 'Categories', url: `${site.domain}/tools/` },
        { name: page.h1, url: canonical }
      ]),
      buildItemListSchema(page.h1, list),
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: page.h1,
        url: canonical,
        description: page.description,
        numberOfItems: list.length,
        isPartOf: { '@type': 'WebSite', name: site.name, url: site.domain }
      })
    ]
  });
}

function toolsIndexPage() {
  const cards = categoryPages.map(p => {
    const count = toolsForCategoryPage(p).length;
    return `<a class="category-index-card" href="/${p.slug}/">
      <h2>${esc(p.h1)}</h2>
      <p>${esc(metaDesc(p.description, 120))}</p>
      <span class="category-index-count">${count} tools</span>
    </a>`;
  }).join('\n');

  const content = `
    <article class="tool-page container">
      <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">All categories</span></nav>
      <header class="category-hero">
        <h1>All tool categories</h1>
        <p class="tool-lead">Browse ${liveTools.length}+ free online tools organized by category. PDF, image, video, audio, developer, text, finance, security, and more.</p>
      </header>
      <div class="category-index-grid">${cards}</div>
      <section class="content-block">
        <h2>Also explore</h2>
        <p><a href="/converters/">Converters hub</a> — ${conversions.length}+ dedicated unit conversion pages for length, weight, temperature, and more.</p>
      </section>
    </article>`;

  return layout({
    title: `All Tool Categories — ${liveTools.length}+ Free Utilities | ${site.name}`,
    description: metaDesc(`Browse all JotNexus tool categories — PDF tools, image tools, video tools, developer utilities, converters, and ${liveTools.length}+ free online tools.`),
    keywords: 'online tools, tool categories, pdf tools, image tools, developer tools, free utilities',
    canonical: `${site.domain}/tools/`,
    bodyClass: 'page-tools-index',
    content,
    jsonLd: [
      buildBreadcrumbSchema([
        { name: 'Home', url: `${site.domain}/` },
        { name: 'Categories', url: `${site.domain}/tools/` }
      ]),
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'All tool categories',
        url: `${site.domain}/tools/`,
        description: `Browse all ${liveTools.length}+ JotNexus tools by category`,
        hasPart: categoryPages.map(p => ({
          '@type': 'WebPage',
          name: p.h1,
          url: `${site.domain}/${p.slug}/`
        }))
      })
    ]
  });
}

function termsPage() {
  const content = `
    <article class="legal-page container">
      <h1>Terms of Service</h1>
      <p><em>Last updated: ${new Date().toISOString().slice(0, 10)}</em></p>
      <h2>Agreement</h2>
      <p>By using ${site.name} at ${site.domain}, you agree to these Terms of Service. If you do not agree, please do not use the site.</p>
      <h2>Service description</h2>
      <p>${site.name} provides free browser-based utility tools for personal and commercial use. Most tools process data locally in your browser. Some tools may require you to upload files from your device for local processing, or may use third-party APIs for specific lookups.</p>
      <h2>Acceptable use</h2>
      <p>You agree not to misuse the site, attempt unauthorized access, overload our infrastructure, or use tools for illegal purposes. You are responsible for ensuring your use complies with applicable laws.</p>
      <h2>No warranties</h2>
      <p>Tools are provided "as is" without warranties of any kind. Results from calculators, converters, and file processors may contain errors. Verify critical outputs independently before relying on them.</p>
      <h2>Limitation of liability</h2>
      <p>${site.name} and its operators shall not be liable for any damages arising from use of the site or reliance on tool outputs, including data loss from browser processing.</p>
      <h2>Intellectual property</h2>
      <p>The ${site.name} name, design, and site content are protected. Tool outputs generated from your data belong to you.</p>
      <h2>Advertising</h2>
      <p>The site is supported by advertising. Ad partners may serve ads and set cookies per their own policies.</p>
      <h2>Changes</h2>
      <p>We may update these terms at any time. Continued use after changes constitutes acceptance.</p>
      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:${site.contactEmail}">${site.contactEmail}</a>. See also our <a href="/privacy/">Privacy Policy</a>.</p>
    </article>`;

  return layout({
    title: `Terms of Service | ${site.name}`,
    description: `Terms of service for ${site.name} free online tools.`,
    canonical: `${site.domain}/terms/`,
    bodyClass: 'page-legal',
    content
  });
}

function privacyPage() {
  const content = `
    <article class="legal-page container">
      <h1>Privacy Policy</h1>
      <p><em>Last updated: ${new Date().toISOString().slice(0, 10)}</em></p>
      <h2>Overview</h2>
      <p>${site.name} ("we", "us") operates ${site.domain}. We build free browser-based utility tools. Your privacy matters.</p>
      <h2>Local processing in your browser</h2>
      <p>Most tools on ${site.name} run entirely in your web browser using JavaScript. Text and numbers are processed on your device. File-based tools (PDFs, images, video, audio) may ask you to <strong>upload a file from your device</strong> — that file is processed locally in your browser and is <strong>not sent to our servers</strong>. Tools labeled "Runs locally in your browser" keep your data on your device.</p>
      <h2>Third-party libraries and APIs</h2>
      <p>Some tools load processing libraries (for example PDF, image, or video engines) from CDNs on first use. A small number of tools may query third-party public APIs for DNS, IP geolocation, currency rates, or similar lookups — only the minimum data required for that query is sent, and these tools are marked accordingly.</p>
      <h2>Advertising</h2>
      <p>We display advertisements through Google AdSense and similar networks to keep tools free. Ad partners may use cookies. See <a href="https://policies.google.com/technologies/ads" rel="noopener">Google's ad policy</a>.</p>
      <h2>Analytics</h2>
      <p>We may use privacy-friendly analytics to understand traffic patterns. No personally identifiable information is sold.</p>
      <h2>Cookies</h2>
      <p>Essential cookies may be set by our ad and analytics partners. You can control cookies via your browser settings.</p>
      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:${site.contactEmail}">${site.contactEmail}</a>.</p>
    </article>`;

  return layout({
    title: `Privacy Policy | ${site.name}`,
    description: `Privacy policy for ${site.name} free online tools.`,
    canonical: `${site.domain}/privacy/`,
    bodyClass: 'page-legal',
    content
  });
}

function robotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${site.domain}/sitemap.xml
`;
}

function sitemapPriority(url) {
  if (url === `${site.domain}/`) return '1.0';
  if (url.includes('/convert/')) return '0.7';
  if (url.includes('/privacy/') || url.includes('/terms/')) return '0.3';
  const path = url.replace(site.domain, '');
  if (path === '/tools/' || path === '/converters/') return '0.9';
  const seg = path.split('/').filter(Boolean)[0];
  if (categoryPages.some(p => p.slug === seg)) return '0.9';
  return '0.8';
}

function sitemapXml(urls) {
  const body = urls.map(u => `  <url><loc>${u}</loc><changefreq>weekly</changefreq><priority>${sitemapPriority(u)}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

function writePage(relPath, html) {
  const full = path.join(DIST, relPath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, html, 'utf8');
}

function build() {
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);
  copyDir(SRC_ASSETS, path.join(DIST, 'assets'));
  const toolsJsBase = path.join(SRC_ASSETS, 'js', 'tools', 'all-tools.js');
  const toolsJsExt = path.join(SRC_ASSETS, 'js', 'tools', 'all-tools-extended.js');
  const toolsJsOut = path.join(DIST, 'assets', 'js', 'tools', 'all-tools.js');
  let bundled = fs.readFileSync(toolsJsBase, 'utf8');
  if (fs.existsSync(toolsJsExt)) bundled += '\n' + fs.readFileSync(toolsJsExt, 'utf8');
  const toolsJsMega = path.join(SRC_ASSETS, 'js', 'tools', 'all-tools-mega.js');
  if (fs.existsSync(toolsJsMega)) bundled += '\n' + fs.readFileSync(toolsJsMega, 'utf8');
  fs.writeFileSync(toolsJsOut, bundled, 'utf8');
  const publicDir = path.join(ROOT, 'public');
  if (fs.existsSync(publicDir)) copyDir(publicDir, DIST);

  const urls = [`${site.domain}/`, `${site.domain}/tools/`, `${site.domain}/privacy/`, `${site.domain}/terms/`, `${site.domain}/converters/`];

  writePage('index.html', homePage());
  writePage('tools/index.html', toolsIndexPage());
  writePage('privacy/index.html', privacyPage());
  writePage('terms/index.html', termsPage());
  writePage('converters/index.html', convertersHubPage());

  for (const page of categoryPages) {
    writePage(`${page.slug}/index.html`, categoryLandingPage(page));
    urls.push(`${site.domain}/${page.slug}/`);
  }

  for (const tool of tools) {
    writePage(`${tool.slug}/index.html`, toolPage(tool));
    urls.push(`${site.domain}/${tool.slug}/`);
  }

  for (const conv of conversions) {
    const slug = `${conv.from}-to-${conv.to}`;
    writePage(`convert/${slug}/index.html`, convertPage(conv));
    urls.push(`${site.domain}/convert/${slug}/`);
  }

  fs.writeFileSync(path.join(DIST, 'robots.txt'), robotsTxt(), 'utf8');
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapXml(urls), 'utf8');

  console.log(`✓ Built ${site.name}`);
  console.log(`  ${liveTools.length} live tools · ${tools.length} total pages · ${conversions.length} convert pages · ${categoryPages.length} category pages`);
  console.log(`  Output: dist/`);
}

build();
