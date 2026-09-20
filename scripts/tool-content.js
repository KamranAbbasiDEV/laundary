/**
 * Generates unique, substantial editorial content per tool for SEO and AdSense quality.
 * Uses category profiles + deterministic slug-based variation — not one-size-fits-all templates.
 */

function slugHash(slug) {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function pickN(slug, items, count, salt = 0) {
  if (!items.length) return [];
  const h = slugHash(`${slug}:${salt}`);
  const picked = [];
  const used = new Set();
  for (let i = 0; i < count && picked.length < items.length; i++) {
    const idx = (h + i * 7919 + salt * 997) % items.length;
    if (used.has(idx)) continue;
    used.add(idx);
    picked.push(items[idx]);
  }
  return picked;
}

const CATEGORY_PROFILES = {
  document: {
    label: 'document and PDF',
    audiences: ['office teams', 'students submitting assignments', 'freelancers sending proposals', 'HR departments', 'real estate agents'],
    useCases: [
      'Combine scanned pages into one file before emailing a client',
      'Split a large PDF into smaller chapters or sections',
      'Compress PDFs so they pass email attachment size limits',
      'Convert PDF pages to JPG or PNG for slides and social posts',
      'Rotate or reorder pages after scanning documents on your phone',
      'Extract text from a PDF when you need to edit content elsewhere',
      'Add page numbers or watermarks before sharing a draft',
      'Merge invoices, receipts, or contracts into a single archive'
    ],
    tips: [
      'Process one file at a time for large PDFs — browser memory has limits on very heavy documents.',
      'If output looks blurry, try a lower compression setting or export pages as images first.',
      'Keep a backup of the original PDF before merging or splitting irreversible changes.',
      'For password-protected PDFs, unlock them in your PDF reader first — most browser tools cannot open encrypted files.',
      'When merging, drag files into the order you want before clicking merge.',
      'Scanned PDFs are often large; compress after merge for faster sharing.'
    ],
    limits: [
      'Browser-based PDF tools work best on files under roughly 50–100 MB depending on your device.',
      'Complex forms, embedded fonts, or digital signatures may not survive every conversion unchanged.',
      'Password-protected or DRM-locked PDFs usually cannot be processed until unlocked.'
    ],
    extraFaqs: [
      {
        q: 'Will formatting stay the same after conversion?',
        a: 'Simple page merges and rotations preserve layout well. Converting PDF to images or other formats may change text selectability or font rendering — always review the output before sending.'
      },
      {
        q: 'Can I use this for confidential documents?',
        a: 'Because processing happens locally in your browser, files are not uploaded to JotNexus servers. For highly sensitive material, still follow your organization\'s data policies and use a trusted device.'
      }
    ]
  },
  image: {
    label: 'image and photo',
    audiences: ['bloggers', 'e-commerce sellers', 'social media managers', 'designers', 'everyday phone photographers'],
    useCases: [
      'Shrink photo file size before uploading to a website or CMS',
      'Resize images to exact pixel dimensions for Instagram, LinkedIn, or banners',
      'Convert HEIC or WebP photos to JPG for older apps',
      'Remove a busy background from product photos',
      'Crop headshots to a consistent aspect ratio for team pages',
      'Add a subtle watermark before sharing proofs with clients',
      'Sharpen slightly soft phone photos before printing',
      'Create transparent PNGs for logos and stickers'
    ],
    tips: [
      'Start with moderate compression — you can always re-export smaller, but you cannot recover lost detail.',
      'For web use, 1200–2000 px on the long edge is usually enough for hero images.',
      'PNG is best for logos and flat graphics; JPG is better for photos.',
      'When removing backgrounds, use high-contrast subjects on simple backgrounds for cleaner edges.',
      'Check preview before download — colors can shift slightly between formats.',
      'Keep originals in a folder; batch edits are easier when you can revert.'
    ],
    limits: [
      'Very large RAW or TIFF files may be slow or fail on low-memory devices.',
      'Automatic background removal works best on clear subjects; hair and glass remain challenging.',
      'Animated GIF/WebP features may be lost when converting to static JPG or PNG.'
    ],
    extraFaqs: [
      {
        q: 'Does compression reduce quality?',
        a: 'Lossy formats like JPG trade some detail for smaller size. Our tools let you adjust quality so you can balance file size and sharpness. PNG compression is lossless but files stay larger.'
      },
      {
        q: 'What image formats are supported?',
        a: 'Most tools accept common formats including JPG, PNG, WebP, GIF, and often HEIC/AVIF in modern browsers. The tool page describes the exact input and output for this utility.'
      }
    ]
  },
  video: {
    label: 'video',
    audiences: ['content creators', 'teachers recording lessons', 'marketers', 'musicians', 'small business owners'],
    useCases: [
      'Trim the start or end of a screen recording',
      'Extract audio from a clip for a podcast intro',
      'Convert a short clip to GIF for Slack or email',
      'Compress video before uploading to a form or LMS',
      'Merge intro and main footage into one file',
      'Change resolution for mobile-friendly playback',
      'Grab a still frame for a thumbnail',
      'Convert between MP4, WebM, or MOV for compatibility'
    ],
    tips: [
      'Shorter clips process faster — trim first, then compress.',
      'For web embedding, H.264 MP4 at 720p or 1080p is widely supported.',
      'Audio-only exports are much smaller than full video — use when visuals are not needed.',
      'Close other heavy browser tabs while processing long videos.',
      'Preview a few seconds before processing the entire file when trying new settings.'
    ],
    limits: [
      'Browser video processing depends on your CPU and RAM; long 4K files may time out on older hardware.',
      'Some proprietary codecs (certain MOV variants) may not decode in every browser.',
      'Processing very long files can take several minutes — do not close the tab until download starts.'
    ],
    extraFaqs: [
      {
        q: 'Why is video processing slow?',
        a: 'Video encoding is CPU-intensive. WebAssembly runs on your device, so speed depends on your hardware. Shorter clips and lower resolution settings finish much faster.'
      }
    ]
  },
  audio: {
    label: 'audio',
    audiences: ['podcasters', 'musicians', 'transcriptionists', 'video editors', 'language learners'],
    useCases: [
      'Trim silence from the start of a voice memo',
      'Convert WAV to MP3 for smaller sharing',
      'Merge multiple takes into one track',
      'Slow down or speed up practice material',
      'Normalize volume across clips',
      'Extract a segment for a ringtone or notification',
      'Convert formats for older car stereos or phones',
      'Generate a waveform preview before editing elsewhere'
    ],
    tips: [
      'MP3 at 192–256 kbps is a good balance for speech and music sharing.',
      'Trim dead air before compressing — smaller files process faster.',
      'Keep lossless WAV masters; export MP3 copies for distribution.',
      'Use headphones when checking fade in/out points.'
    ],
    limits: [
      'Long multi-hour recordings may exceed browser memory on mobile devices.',
      'Some exotic codecs may not be supported without converting to WAV or MP3 first.'
    ],
    extraFaqs: [
      {
        q: 'Is audio uploaded to your servers?',
        a: 'No. Like our other media tools, audio is decoded and processed in your browser. Nothing is sent to JotNexus for storage or processing.'
      }
    ]
  },
  developer: {
    label: 'developer',
    audiences: ['software engineers', 'DevOps teams', 'QA testers', 'API integrators', 'computer science students'],
    useCases: [
      'Validate JSON from an API response before pasting into code',
      'Decode a JWT header to inspect claims during debugging',
      'Generate UUIDs for database seeds or test fixtures',
      'Compare two config files line by line before deployment',
      'Hash strings to verify checksums or test auth flows',
      'Encode binary data as Base64 for data URLs',
      'Test regular expressions against sample strings',
      'Format minified SQL or XML for code review'
    ],
    tips: [
      'Never paste production secrets into any online tool — even local ones — on shared or untrusted machines.',
      'Use minify + validate together: format for humans, minify before shipping.',
      'When diffing configs, normalize line endings first for cleaner results.',
      'Copy results to a scratch file before closing the tab — browser refreshes clear unsaved work.'
    ],
    limits: [
      'Extremely large payloads (multi-megabyte JSON) may lag on mobile browsers.',
      'JWT decoding shows payload content but does not verify signatures — use proper libraries in production.',
      'Regex tools help prototyping; always add unit tests for critical patterns.'
    ],
    extraFaqs: [
      {
        q: 'Is it safe to paste API keys or tokens here?',
        a: 'Processing is local, but clipboard and browser extensions can still pose risks on shared computers. Treat this like any dev utility: avoid real production credentials on untrusted devices.'
      },
      {
        q: 'Do these tools replace IDE plugins?',
        a: 'They complement your editor for quick one-off tasks — formatting a payload, checking a hash, or decoding a token without opening a project.'
      }
    ]
  },
  text: {
    label: 'text',
    audiences: ['writers', 'editors', 'marketers', 'students', 'support teams'],
    useCases: [
      'Count words and characters for essay limits or ad copy',
      'Convert between title case, sentence case, and camelCase for code or headings',
      'Generate URL-friendly slugs from article titles',
      'Compare two versions of copy during review',
      'Remove duplicate lines from pasted lists',
      'Create placeholder text for mockups',
      'Reverse or sort lines in a CSV export',
      'Extract emails or URLs from unstructured text'
    ],
    tips: [
      'Paste plain text when possible — rich text from Word may carry hidden formatting.',
      'Use word count with spaces vs without depending on your publisher\'s rules.',
      'For slugs, preview the output URL before publishing.',
      'Large documents may scroll slowly — split into sections if needed.'
    ],
    limits: [
      'Very large texts (hundreds of thousands of characters) may slow down older browsers.',
      'Language-specific edge cases (smart quotes, ligatures) may need manual cleanup after conversion.'
    ],
    extraFaqs: [
      {
        q: 'Is my text stored anywhere?',
        a: 'No. Text tools run entirely in your browser. When you close the tab, the content is gone unless you copy it elsewhere.'
      }
    ]
  },
  converter: {
    label: 'conversion',
    audiences: ['travelers', 'cooks', 'engineers', 'students', 'shoppers comparing international units'],
    useCases: [
      'Convert recipe measurements between cups and grams',
      'Switch between Celsius and Fahrenheit when traveling',
      'Translate file sizes between KB, MB, and GB',
      'Convert feet and meters for furniture or room dimensions',
      'Swap mph and km/h for driving abroad',
      'Convert pressure or energy units for science homework',
      'Map color values between HEX, RGB, and HSL for CSS',
      'Convert currency amounts using live rates when available'
    ],
    tips: [
      'Double-check unit labels — similar names (US vs imperial gallons) can differ.',
      'For cooking, weight (grams) is often more accurate than volume (cups).',
      'Bookmark frequent conversion pairs for one-click access.',
      'Round results appropriately — four decimal places is plenty for most everyday use.'
    ],
    limits: [
      'Currency tools depend on third-party rate APIs and may not include every exotic currency pair.',
      'Extreme precision beyond display decimals is not meaningful for most household conversions.'
    ],
    extraFaqs: [
      {
        q: 'How accurate are conversions?',
        a: 'Unit conversions use standard factors (NIST-style constants where applicable). Currency rates update from public APIs and are indicative — verify with your bank for financial transactions.'
      }
    ]
  },
  security: {
    label: 'security and crypto',
    audiences: ['developers', 'security students', 'IT administrators', 'privacy-conscious users'],
    useCases: [
      'Generate strong random passwords for new accounts',
      'Compute SHA-256 hashes to verify file integrity',
      'Test HMAC values against API documentation examples',
      'Encrypt short messages with AES for learning exercises',
      'Validate password strength before updating credentials',
      'Generate passphrases that are easier to remember but still strong',
      'Compare hash outputs from different algorithms',
      'Encode secrets for local testing only — never production keys'
    ],
    tips: [
      'Use a dedicated password manager for real credentials — generators here are for one-off or test use.',
      'Longer passwords beat complex short ones — aim for 16+ random characters.',
      'When learning encryption, use test keys only; rotate anything that was ever pasted online.',
      'Verify hash algorithm names match what your system expects (SHA-256 vs SHA-1).'
    ],
    limits: [
      'Browser crypto is for utility and education — not audited for high-assurance HSM replacement.',
      'Very large files may take time to hash on low-end hardware.'
    ],
    extraFaqs: [
      {
        q: 'Are generated passwords sent to a server?',
        a: 'No. Random values and hashes are computed locally with Web Crypto or vetted JavaScript libraries in your browser.'
      }
    ]
  },
  finance: {
    label: 'finance',
    audiences: ['household budgeters', 'small business owners', 'freelancers', 'students', 'investors doing quick math'],
    useCases: [
      'Estimate monthly loan or mortgage payments before talking to a bank',
      'Calculate tips and split bills at restaurants',
      'Project compound interest on savings goals',
      'Figure ROI on a marketing spend or equipment purchase',
      'Convert hourly rate to annual salary for job offers',
      'Run break-even analysis for a side project',
      'Calculate sales tax or VAT on invoices',
      'Compare lease vs buy scenarios with simple inputs'
    ],
    tips: [
      'Treat outputs as estimates — lenders use fees, insurance, and credit terms not captured in simple calculators.',
      'Re-run scenarios with conservative and optimistic inputs to see a range.',
      'For tax calculations, confirm rates for your jurisdiction — defaults may not match your city or state.',
      'Export or screenshot results when comparing multiple options.'
    ],
    limits: [
      'Calculators simplify real-world products; they are not financial advice.',
      'Currency and tax rules change — verify figures with a professional for major decisions.'
    ],
    extraFaqs: [
      {
        q: 'Can I rely on these for tax filing?',
        a: 'No. These tools help with quick math and planning. Always use official tax software or a qualified professional for filing.'
      }
    ]
  },
  math: {
    label: 'math',
    audiences: ['students', 'teachers', 'engineers', 'hobbyists', 'parents helping with homework'],
    useCases: [
      'Solve percentage increase or discount problems quickly',
      'Convert fractions to decimals for recipes or measurements',
      'Calculate GPA or grade averages',
      'Find greatest common divisor for fraction simplification',
      'Compute area and volume for DIY projects',
      'Check arithmetic on large columns of numbers',
      'Plot simple functions for visualization',
      'Convert between number bases for programming exercises'
    ],
    tips: [
      'Write down inputs before clearing the form — easy to lose context on multi-step problems.',
      'For geometry, keep units consistent (all feet or all meters).',
      'Use fraction mode when exact rationals matter more than decimals.'
    ],
    limits: [
      'Symbolic algebra and advanced calculus are outside the scope of quick utility calculators.',
      'Floating-point rounding can produce tiny trailing errors — round for presentation.'
    ],
    extraFaqs: [
      {
        q: 'Do you show the formula used?',
        a: 'Each calculator applies standard formulas (percentage, area, etc.). For learning, compare the output against your textbook steps.'
      }
    ]
  },
  datetime: {
    label: 'date and time',
    audiences: ['remote teams', 'travelers', 'event planners', 'developers', 'historians'],
    useCases: [
      'Convert Unix timestamps from server logs to readable dates',
      'Compare time zones for meeting scheduling',
      'Count days until a deadline or event',
      'Calculate age from a birth date',
      'Add or subtract business days from a project timeline',
      'Convert between 12-hour and 24-hour formats',
      'Find week numbers for reporting periods',
      'Parse ambiguous date strings consistently'
    ],
    tips: [
      'Always confirm AM/PM when scheduling across zones.',
      'Unix timestamps may be seconds or milliseconds — check your source documentation.',
      'Daylight saving shifts can make “same local time” differ by an hour twice a year.',
      'Use UTC for logs; convert to local only for display.'
    ],
    limits: [
      'Historical timezone rule changes before modern databases may be approximate.',
      'Leap seconds and exotic calendar systems are not covered by every tool.'
    ],
    extraFaqs: [
      {
        q: 'Which timezone is used by default?',
        a: 'Most tools use your browser\'s local timezone unless you pick a specific zone. Developers converting epoch times can usually choose UTC explicitly.'
      }
    ]
  },
  web: {
    label: 'web and SEO',
    audiences: ['web developers', 'SEO specialists', 'marketers', 'site owners', 'content publishers'],
    useCases: [
      'Preview Open Graph tags before sharing on social media',
      'Generate meta descriptions and title tags for new pages',
      'Encode URLs or query strings safely',
      'Build a robots.txt or sitemap snippet for a static site',
      'Look up DNS records when troubleshooting email or hosting',
      'Create QR codes for campaign landing pages',
      'Validate structured data ideas before implementation',
      'Inspect redirect chains on marketing links'
    ],
    tips: [
      'Test social previews with real URLs after deploying — cached cards may lag.',
      'Keep meta descriptions under ~155 characters for clean SERP display.',
      'DNS changes can take up to 48 hours to propagate globally.',
      'API-based lookups (DNS, IP) send only the query needed — see the privacy badge on each tool.'
    ],
    limits: [
      'DNS and IP tools rely on public resolvers; corporate split-horizon DNS may differ.',
      'SEO generators suggest copy — always edit for your brand voice.'
    ],
    extraFaqs: [
      {
        q: 'Which tools call external APIs?',
        a: 'Look for the “May use external APIs” badge. Local tools (QR, URL encode, meta tag builder) stay entirely in your browser.'
      }
    ]
  },
  design: {
    label: 'design',
    audiences: ['UI designers', 'front-end developers', 'brand designers', 'accessibility advocates'],
    useCases: [
      'Build CSS gradients and copy ready-to-paste code',
      'Check WCAG contrast between text and background colors',
      'Generate harmonious color palettes from a brand hex',
      'Preview box shadows and border radius for components',
      'Convert between color spaces for design handoff',
      'Create placeholder avatars or patterns for mockups',
      'Measure aspect ratios for responsive layouts',
      'Export CSS snippets for design systems'
    ],
    tips: [
      'Aim for WCAG AA contrast (4.5:1) for body text on backgrounds.',
      'Preview gradients on both light and dark UI shells.',
      'Copy CSS variables into your design tokens file for consistency.',
      'Test color-blind accessibility with more than contrast alone when possible.'
    ],
    limits: [
      'Browser color parsing may differ slightly from Figma or Photoshop for exotic color spaces.',
      'Generated palettes are starting points — refine with brand guidelines.'
    ],
    extraFaqs: [
      {
        q: 'Can I use generated CSS in commercial projects?',
        a: 'Yes. CSS snippets you generate from your inputs are yours to use freely.'
      }
    ]
  }
};

const POPULAR_OVERRIDES = {
  'pdf-merger': {
    intro: 'Merging PDFs is one of the most common document tasks — combining contracts, scans, slides, or invoices into a single file you can email or archive. JotNexus PDF Merger runs entirely in your browser: upload the files in order, merge, and download. No account, no cloud upload to our servers.',
    steps: [
      'Open PDF Merger and upload two or more PDF files (drag and drop or click to browse).',
      'Arrange files in the order you want pages to appear — first file first, and so on.',
      'Click merge and wait a few seconds while pages are combined locally.',
      'Download the merged PDF and open it in your reader to confirm page order.'
    ]
  },
  'pdf-compressor': {
    intro: 'Email providers and web forms often reject PDFs over 10–25 MB. Our PDF Compressor reduces file size by re-encoding images inside the document while keeping text readable — all on your device.',
    steps: [
      'Upload the PDF you need to shrink.',
      'Choose a compression level — start with medium and preview file size savings.',
      'Run compress and compare the before/after size shown on screen.',
      'Download the smaller PDF; keep your original if you need maximum quality later.'
    ]
  },
  'image-compressor': {
    intro: 'Large photos slow down websites and fill storage on your phone. This compressor lets you tune quality and see estimated savings before export — ideal for blogs, listings, and email.',
    steps: [
      'Upload a JPG, PNG, or WebP image.',
      'Adjust the quality slider and watch the estimated output size update.',
      'Click compress and compare the preview if available.',
      'Download the optimized image for upload to your site or message.'
    ]
  },
  'qr-code-generator': {
    intro: 'QR codes bridge print and digital — menus, Wi‑Fi setup, event check-in, or payment links. Generate a scannable code from any URL or text, optionally with a center logo, and download PNG or SVG.',
    steps: [
      'Enter the URL or text you want encoded.',
      'Optional: upload a small logo for the center (keep it simple for reliable scanning).',
      'Pick size and error correction if offered.',
      'Download the image and test scan with your phone before printing.'
    ]
  }
};

function getProfile(category) {
  return CATEGORY_PROFILES[category] || CATEGORY_PROFILES.text;
}

function buildHowToSteps(tool, upload) {
  const override = POPULAR_OVERRIDES[tool.slug];
  if (override?.steps) return override.steps;

  const name = tool.name;
  if (upload) {
    return [
      `Go to ${name} on JotNexus — no signup required.`,
      'Drag and drop your file onto the upload area, or click to choose from your device.',
      'Adjust any settings shown (quality, dimensions, format, etc.) using the labels on the page.',
      'Click the main action button and wait for processing to finish in your browser.',
      'Preview the result if the tool shows one, then download or copy the output.'
    ];
  }
  return [
    `Open ${name} in any modern browser.`,
    'Paste or type your input in the fields above — results update as you work.',
    'Use copy or download buttons to save the output.',
    'Try related tools linked at the bottom if you need the next step in your workflow.'
  ];
}

function buildToolEditorial(tool, helpers) {
  const { esc, getCategoryName, categoryPageUrl, siteName } = helpers;
  const profile = getProfile(tool.category);
  const upload = helpers.requiresUpload(tool);
  const override = POPULAR_OVERRIDES[tool.slug];
  const h = slugHash(tool.slug);

  const audience = profile.audiences[h % profile.audiences.length];
  const useCases = pickN(tool.slug, profile.useCases, 4, 1);
  const tips = pickN(tool.slug, profile.tips, 4, 2);
  const limits = pickN(tool.slug, profile.limits, 2, 3);
  const catName = getCategoryName(tool.category);
  const catLink = categoryPageUrl(tool.category);

  const intro = override?.intro || (
    upload
      ? `${tool.name} helps ${audience} work with ${profile.label} files without installing software. ${tool.description} Upload from your computer or phone, process locally, and download the result — your files are not sent to ${siteName} servers.`
      : `${tool.name} is built for ${audience} who need fast ${profile.label} utilities in the browser. ${tool.description} Paste your input, get instant output, and copy or save — no account required.`
  );

  const aboutP2 = upload
    ? `Unlike cloud converters that upload your files to remote servers, this tool keeps processing on your device. That matters for ${profile.label} work where confidentiality, speed, or offline-friendly workflows count. Browse more <a href="${catLink}">${esc(catName)} tools</a> or search the full catalog from the homepage.`
    : `Because everything runs client-side, you can use it on locked-down networks where installing desktop apps is not an option. Pair it with related utilities at the bottom of this page for multi-step workflows. See all <a href="${catLink}">${esc(catName)} tools</a> on ${esc(siteName)}.`;

  const keywordPhrase = tool.keywords.split(' ').slice(0, 6).join(', ');

  return {
    intro,
    aboutP2,
    keywordPhrase,
    useCases,
    tips,
    limits,
    steps: buildHowToSteps(tool, upload),
    profile
  };
}

function buildToolFaqs(tool, helpers) {
  const upload = helpers.requiresUpload(tool);
  const editorial = buildToolEditorial(tool, helpers);
  const base = [
    {
      q: `Is ${tool.name} free to use?`,
      a: `Yes. ${tool.name} on JotNexus is free with no signup, subscription, or hidden limits for normal personal and business use.`
    },
    {
      q: 'Is my data uploaded to a server?',
      a: upload
        ? 'You select a file from your device, but processing happens locally in your browser. Your file is not uploaded to JotNexus servers for storage or conversion.'
        : tool.privacy === 'client-only'
          ? 'No. This tool runs entirely in your browser. Your input never leaves your device.'
          : 'Most processing happens in your browser. Tools that need live data (such as DNS or currency rates) call public APIs with only the minimum query required — see the privacy badge above.'
    },
    {
      q: `How do I use ${tool.name}?`,
      a: upload
        ? `Upload your file using drag-and-drop or the file picker, adjust any options on the page, then click the action button. Download or copy the result when processing completes — usually within seconds for typical file sizes.`
        : `Enter or paste your content in the tool workspace above. Results appear instantly. Use the copy button or on-page download when you are done.`
    },
    {
      q: `Who is ${tool.name} for?`,
      a: `It is useful for ${editorial.profile.audiences[slugHash(tool.slug) % editorial.profile.audiences.length]} and anyone who needs a quick ${editorial.profile.label} utility without installing software.`
    },
    {
      q: 'Does it work on mobile?',
      a: 'Yes. JotNexus tools are responsive and work on iPhone, Android, tablets, and desktop browsers. Very large files may process slower on phones due to hardware limits.'
    },
    {
      q: `What makes this different from other ${editorial.profile.label} tools online?`,
      a: `JotNexus focuses on privacy-first browser processing, a consistent interface across ${helpers.liveToolCount}+ utilities, and no account wall. You get a dedicated page with instructions, not just a bare widget.`
    }
  ];

  const extra = pickN(tool.slug, editorial.profile.extraFaqs, 2, 4);
  return [...base, ...extra];
}

function buildHowToSchemaSteps(tool, steps) {
  return steps.map((text, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: i === 0 ? 'Open the tool' : i === steps.length - 1 ? 'Save your result' : `Step ${i + 1}`,
    text
  }));
}

module.exports = {
  slugHash,
  buildToolEditorial,
  buildToolFaqs,
  buildHowToSchemaSteps,
  POPULAR_OVERRIDES
};
