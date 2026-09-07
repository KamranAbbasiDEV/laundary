/**
 * Mega catalog expansion — adds 120+ tools, 120+ convert pages, bundles mega JS
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const toolsPath = path.join(ROOT, 'data', 'tools.json');
const convPath = path.join(ROOT, 'data', 'conversions.json');
const megaJsOut = path.join(ROOT, 'src', 'assets', 'js', 'tools', 'all-tools-mega.js');
const megaImpl = path.join(__dirname, 'mega-tool-impls.js');

function tool(id, slug, name, category, keywords, description, popular = false) {
  return { id, slug, name, category, status: 'live', keywords, description, privacy: 'client-only', related: [], popular };
}

const MEGA = [
  tool('pdf-reorder', 'pdf-reorder-pages', 'PDF Page Reorder', 'document', 'reorder pdf pages online free', 'Reorder PDF pages by specifying a new page sequence.'),
  tool('pdf-extract-text', 'pdf-text-extractor', 'PDF Text Extractor', 'document', 'extract text from pdf online free', 'Extract readable text from PDF documents locally.'),
  tool('pdf-watermark', 'pdf-watermark', 'PDF Watermark', 'document', 'add watermark to pdf online free', 'Add text watermarks to every PDF page.'),
  tool('pdf-unlock', 'pdf-unlock', 'PDF Unlock (Remove Password)', 'document', 'unlock pdf remove password online', 'Open password-protected PDFs if you know the password.'),
  tool('heic-converter', 'heic-to-jpg', 'HEIC to JPG', 'image', 'heic to jpg converter online free', 'Convert iPhone HEIC photos to JPG when supported by your browser.'),
  tool('avif-converter', 'avif-converter', 'AVIF Converter', 'image', 'avif to png jpg converter online', 'Convert AVIF images to PNG or JPG locally.'),
  tool('image-sharpen', 'image-sharpen', 'Image Sharpen', 'image', 'sharpen image online free', 'Sharpen blurry photos using canvas filters.'),
  tool('image-border', 'image-border', 'Add Image Border', 'image', 'add border to image online free', 'Add colored borders around images before download.'),
  tool('gif-maker', 'gif-maker', 'GIF Maker', 'image', 'create gif from images online free', 'Combine images into an animated GIF.'),
  tool('transparent-png', 'transparent-png-maker', 'Transparent PNG Maker', 'image', 'make png transparent background online', 'Remove solid-color backgrounds from simple images.'),
  tool('image-collage', 'photo-collage-maker', 'Photo Collage Maker', 'image', 'photo collage maker online free', 'Arrange multiple photos into a simple collage grid.'),
  tool('video-rotate', 'video-rotate', 'Rotate Video', 'video', 'rotate video online free', 'Rotate video 90 or 180 degrees locally.'),
  tool('video-merge', 'video-merger', 'Video Merger', 'video', 'merge combine videos online free', 'Join multiple video clips into one file.'),
  tool('video-crop', 'video-cropper', 'Video Cropper', 'video', 'crop video online free', 'Crop video to a custom aspect ratio.'),
  tool('mov-converter', 'mov-to-mp4', 'MOV to MP4', 'video', 'mov to mp4 converter online free', 'Convert MOV files to MP4 in your browser.'),
  tool('audio-speed', 'audio-speed-changer', 'Audio Speed Changer', 'video', 'change audio speed online free', 'Speed up or slow down audio without changing pitch much.'),
  tool('audio-volume', 'audio-volume-booster', 'Audio Volume Booster', 'audio', 'boost audio volume online free', 'Increase audio volume before export.'),
  tool('audio-reverse', 'reverse-audio', 'Reverse Audio', 'audio', 'reverse audio online free', 'Play audio backwards for creative effects.'),
  tool('record-audio', 'audio-recorder', 'Audio Recorder', 'audio', 'record audio online microphone free', 'Record audio from your microphone in the browser.'),
  tool('ogg-converter', 'ogg-converter', 'OGG Converter', 'audio', 'ogg to mp3 wav converter online', 'Convert OGG audio to WAV format locally.'),
  tool('flac-converter', 'flac-converter', 'FLAC Converter', 'audio', 'flac to wav mp3 converter online', 'Convert FLAC audio using browser decoding.'),
  tool('sha512-hash', 'sha512-hash-generator', 'SHA-512 Hash Generator', 'security', 'sha512 hash generator online', 'Generate SHA-512 hashes from text or files.'),
  tool('sha384-hash', 'sha384-hash-generator', 'SHA-384 Hash Generator', 'security', 'sha384 hash generator online', 'Generate SHA-384 cryptographic hashes locally.'),
  tool('hmac-generator', 'hmac-generator', 'HMAC Generator', 'security', 'hmac sha256 generator online', 'Generate HMAC signatures with a secret key.'),
  tool('pbkdf2-generator', 'pbkdf2-generator', 'PBKDF2 Key Generator', 'security', 'pbkdf2 generator online', 'Derive keys using PBKDF2 with Web Crypto.'),
  tool('htpasswd-generator', 'htpasswd-generator', 'Htpasswd Generator', 'security', 'htpasswd generator apache online', 'Generate Apache htpasswd bcrypt entries.'),
  tool('api-key-generator', 'api-key-generator', 'API Key Generator', 'security', 'api key generator random online', 'Generate secure random API keys and tokens.'),
  tool('caesar-cipher', 'caesar-cipher', 'Caesar Cipher', 'security', 'caesar cipher encoder decoder online', 'Encode and decode Caesar cipher with custom shift.'),
  tool('atbash-cipher', 'atbash-cipher', 'Atbash Cipher', 'security', 'atbash cipher encoder online', 'Apply the Atbash alphabet substitution cipher.'),
  tool('vigenere-cipher', 'vigenere-cipher', 'Vigenère Cipher', 'security', 'vigenere cipher encoder decoder online', 'Encrypt and decrypt text with a Vigenère keyword.'),
  tool('base32-encoder', 'base32-encoder', 'Base32 Encoder & Decoder', 'developer', 'base32 encode decode online', 'Encode and decode Base32 strings locally.'),
  tool('base58-encoder', 'base58-encoder', 'Base58 Encoder', 'developer', 'base58 encode decode bitcoin online', 'Encode and decode Base58 data locally.'),
  tool('punycode-converter', 'punycode-converter', 'Punycode Converter', 'developer', 'punycode idn converter online', 'Convert international domain names to Punycode and back.'),
  tool('json-diff', 'json-diff', 'JSON Diff Compare', 'developer', 'json diff compare online free', 'Compare two JSON documents and highlight differences.'),
  tool('jsonpath-tester', 'jsonpath-tester', 'JSONPath Tester', 'developer', 'jsonpath tester query online', 'Query JSON documents using JSONPath expressions.'),
  tool('json-merge', 'json-merge', 'JSON Merge Tool', 'developer', 'merge json objects online', 'Deep merge two JSON objects into one.'),
  tool('graphql-formatter', 'graphql-formatter', 'GraphQL Formatter', 'developer', 'graphql formatter beautify online', 'Format and indent GraphQL queries for readability.'),
  tool('curl-converter', 'curl-to-fetch', 'cURL to Fetch Converter', 'developer', 'curl to javascript fetch converter', 'Convert cURL commands into JavaScript fetch code.'),
  tool('utm-builder', 'utm-builder', 'UTM Link Builder', 'web', 'utm parameter builder campaign url', 'Build campaign URLs with UTM tracking parameters.'),
  tool('utm-parser', 'utm-parser', 'UTM Parameter Parser', 'web', 'utm parameter parser online', 'Parse UTM campaign parameters from any URL.'),
  tool('docker-compose-gen', 'docker-compose-generator', 'Docker Compose Generator', 'developer', 'docker compose generator yaml online', 'Generate docker-compose.yml from simple service inputs.'),
  tool('gitignore-advanced', 'gitignore-advanced', 'Advanced .gitignore Builder', 'developer', 'gitignore builder multiple stacks online', 'Build combined gitignore rules for polyglot projects.'),
  tool('readme-generator', 'readme-generator', 'README Generator', 'developer', 'readme generator markdown github online', 'Generate GitHub README markdown from project details.'),
  tool('semver-calculator', 'semver-calculator', 'SemVer Calculator', 'developer', 'semver version bump calculator online', 'Bump semantic version numbers by major minor patch.'),
  tool('chmod-calculator', 'chmod-calculator', 'Chmod Calculator', 'developer', 'chmod calculator unix permissions online', 'Convert between chmod numeric and symbolic permissions.'),
  tool('crontab-generator', 'crontab-generator', 'Crontab Generator', 'developer', 'crontab generator linux schedule online', 'Build full crontab entries with timezone notes.'),
  tool('mac-generator', 'mac-address-generator', 'MAC Address Generator', 'developer', 'mac address generator random online', 'Generate random MAC addresses for testing.'),
  tool('cidr-calculator', 'cidr-calculator', 'CIDR Subnet Calculator', 'developer', 'cidr subnet calculator online', 'Calculate IP subnet ranges from CIDR notation.'),
  tool('ipv6-converter', 'ipv6-converter', 'IPv6 Address Formatter', 'developer', 'ipv6 address expand compress online', 'Expand or compress IPv6 address notation.'),
  tool('mime-lookup', 'mime-type-lookup', 'MIME Type Lookup', 'developer', 'mime type lookup file extension online', 'Look up MIME types for file extensions.'),
  tool('http-header-parser', 'http-header-parser', 'HTTP Header Parser', 'developer', 'http header parser online', 'Parse raw HTTP request and response headers.'),
  tool('jwt-rs256-decoder', 'jwt-rs256-decoder', 'JWT RS256 Decoder', 'security', 'jwt rs256 decode inspect online', 'Decode JWT tokens and inspect RS256 header metadata.'),
  tool('pemcert-decoder', 'pem-decoder', 'PEM Certificate Decoder', 'security', 'pem certificate decoder online', 'Decode PEM certificates to readable fields.'),
  tool('factorial-calc', 'factorial-calculator', 'Factorial Calculator', 'math', 'factorial calculator n online', 'Calculate factorials for integers up to 170.'),
  tool('permutation-calc', 'permutation-calculator', 'Permutation & Combination', 'math', 'permutation combination calculator online', 'Calculate nPr and nCr permutations and combinations.'),
  tool('stats-calculator', 'statistics-calculator', 'Statistics Calculator', 'math', 'mean median mode standard deviation online', 'Calculate mean, median, mode, and standard deviation.'),
  tool('quadratic-calc', 'quadratic-calculator', 'Quadratic Formula Calculator', 'math', 'quadratic formula calculator online', 'Solve quadratic equations using the quadratic formula.'),
  tool('pythagorean-calc', 'pythagorean-calculator', 'Pythagorean Theorem Calculator', 'math', 'pythagorean theorem calculator online', 'Find hypotenuse or missing side of a right triangle.'),
  tool('circle-calc', 'circle-calculator', 'Circle Calculator', 'math', 'circle area circumference calculator online', 'Calculate circle area and circumference from radius.'),
  tool('triangle-area', 'triangle-area-calculator', 'Triangle Area Calculator', 'math', 'triangle area calculator online', 'Calculate triangle area from base and height.'),
  tool('volume-calc', 'volume-calculator', 'Volume Calculator', 'math', 'volume calculator cube sphere cylinder online', 'Calculate volume of common 3D shapes.'),
  tool('log-calculator', 'logarithm-calculator', 'Logarithm Calculator', 'math', 'logarithm calculator ln log10 online', 'Calculate natural and base-10 logarithms.'),
  tool('apy-calculator', 'apy-calculator', 'APY Calculator', 'finance', 'apy calculator annual percentage yield online', 'Calculate APY from interest rate and compounding frequency.'),
  tool('rule-of-72', 'rule-of-72-calculator', 'Rule of 72 Calculator', 'finance', 'rule of 72 calculator investment doubling', 'Estimate years to double an investment at a given rate.'),
  tool('inflation-calc', 'inflation-calculator', 'Inflation Calculator', 'finance', 'inflation calculator purchasing power online', 'Estimate purchasing power change over time.'),
  tool('hourly-salary', 'hourly-to-salary-calculator', 'Hourly to Salary Calculator', 'finance', 'hourly to salary calculator annual income', 'Convert hourly wage to annual salary and back.'),
  tool('paycheck-calc', 'paycheck-calculator', 'Paycheck Calculator', 'finance', 'paycheck calculator net pay online', 'Estimate net pay from gross salary and deductions.'),
  tool('retirement-calc', 'retirement-calculator', 'Retirement Calculator', 'finance', 'retirement savings calculator online', 'Project retirement savings growth over time.'),
  tool('stripe-fee', 'stripe-fee-calculator', 'Stripe Fee Calculator', 'finance', 'stripe fee calculator online', 'Calculate Stripe processing fees and net payout.'),
  tool('paypal-fee', 'paypal-fee-calculator', 'PayPal Fee Calculator', 'finance', 'paypal fee calculator online', 'Calculate PayPal transaction fees and net received.'),
  tool('cpm-calculator', 'cpm-calculator', 'CPM Calculator', 'finance', 'cpm calculator advertising online', 'Calculate cost per thousand impressions for ads.'),
  tool('ctr-calculator', 'ctr-calculator', 'CTR Calculator', 'finance', 'ctr calculator click through rate online', 'Calculate click-through rate from clicks and impressions.'),
  tool('roas-calculator', 'roas-calculator', 'ROAS Calculator', 'finance', 'roas calculator return on ad spend online', 'Calculate return on ad spend from revenue and cost.'),
  tool('amazon-fba', 'amazon-fba-calculator', 'Amazon FBA Calculator', 'finance', 'amazon fba fee calculator online', 'Estimate Amazon FBA fees and net profit.'),
  tool('ideal-weight', 'ideal-weight-calculator', 'Ideal Weight Calculator', 'math', 'ideal body weight calculator online', 'Estimate ideal weight using standard medical formulas.'),
  tool('body-fat', 'body-fat-calculator', 'Body Fat Calculator', 'math', 'body fat percentage calculator online', 'Estimate body fat percentage from measurements.'),
  tool('macro-calculator', 'macro-calculator', 'Macro Calculator', 'math', 'macro nutrient calculator online', 'Calculate daily protein carbs fat targets from calories.'),
  tool('water-intake', 'water-intake-calculator', 'Water Intake Calculator', 'math', 'daily water intake calculator online', 'Estimate daily water intake based on weight and activity.'),
  tool('pace-calculator', 'running-pace-calculator', 'Running Pace Calculator', 'math', 'running pace calculator min per mile km online', 'Calculate running pace from distance and time.'),
  tool('one-rep-max', 'one-rep-max-calculator', 'One Rep Max Calculator', 'math', 'one rep max calculator gym online', 'Estimate one-rep max from weight and reps.'),
  tool('pregnancy-due', 'pregnancy-due-date', 'Pregnancy Due Date Calculator', 'datetime', 'pregnancy due date calculator online', 'Calculate estimated due date from last menstrual period.'),
  tool('ovulation-calc', 'ovulation-calculator', 'Ovulation Calculator', 'datetime', 'ovulation calculator fertile window online', 'Estimate ovulation and fertile window dates.'),
  tool('days-until', 'days-until-calculator', 'Days Until Calculator', 'datetime', 'days until date countdown online', 'Count days remaining until any future date.'),
  tool('date-add', 'date-add-subtract', 'Add/Subtract Days from Date', 'datetime', 'add subtract days from date online', 'Add or subtract days weeks months from a date.'),
  tool('world-clock', 'world-clock', 'World Clock', 'datetime', 'world clock multiple timezones online', 'View current time in cities around the world.'),
  tool('meeting-planner', 'meeting-time-planner', 'Meeting Time Planner', 'datetime', 'meeting time planner timezones online', 'Find overlapping meeting times across timezones.'),
  tool('unix-ms', 'unix-milliseconds-converter', 'Unix Milliseconds Converter', 'datetime', 'unix timestamp milliseconds converter online', 'Convert Unix timestamps in milliseconds to dates.'),
  tool('zalgo-text', 'zalgo-text-generator', 'Zalgo Text Generator', 'text', 'zalgo glitch text generator online', 'Generate creepy Zalgo glitch text effects.'),
  tool('bubble-text', 'bubble-text-generator', 'Bubble Text Generator', 'text', 'bubble text generator unicode online', 'Convert text to bubble Unicode characters.'),
  tool('wide-text', 'wide-text-generator', 'Wide Text Generator', 'text', 'wide text generator aesthetic online', 'Convert text to wide fullwidth Unicode characters.'),
  tool('small-caps', 'small-caps-generator', 'Small Caps Generator', 'text', 'small caps text generator online', 'Convert text to Unicode small capitals.'),
  tool('bold-text', 'bold-text-generator', 'Bold Text Generator', 'text', 'bold text generator unicode social media', 'Generate bold Unicode text for social posts.'),
  tool('italic-text', 'italic-text-generator', 'Italic Text Generator', 'text', 'italic text generator unicode online', 'Generate italic Unicode text for bios and posts.'),
  tool('invisible-char', 'invisible-character', 'Invisible Character Copy', 'text', 'invisible character zero width copy online', 'Copy invisible zero-width characters for formatting.'),
  tool('duplicate-finder', 'duplicate-word-finder', 'Duplicate Word Finder', 'text', 'find duplicate words in text online', 'Find repeated words and phrases in your text.'),
  tool('syllable-counter', 'syllable-counter', 'Syllable Counter', 'text', 'syllable counter online free', 'Count syllables in words and sentences.'),
  tool('flesch-score', 'readability-score', 'Readability Score', 'text', 'flesch reading ease score online', 'Calculate Flesch reading ease and grade level.'),
  tool('sort-paragraphs', 'sort-paragraphs', 'Sort Paragraphs', 'text', 'sort paragraphs alphabetically online', 'Sort paragraphs A–Z or by length.'),
  tool('remove-punctuation', 'remove-punctuation', 'Remove Punctuation', 'text', 'remove punctuation from text online', 'Strip punctuation marks from text instantly.'),
  tool('sentence-capitalize', 'capitalize-sentences', 'Capitalize Sentences', 'text', 'capitalize sentences online free', 'Capitalize the first letter of every sentence.'),
  tool('word-frequency', 'word-frequency-counter', 'Word Frequency Counter', 'text', 'word frequency counter online', 'Count how often each word appears in text.'),
  tool('ngram-generator', 'ngram-generator', 'N-Gram Generator', 'text', 'ngram generator text analysis online', 'Generate n-grams from text for NLP analysis.'),
  tool('csv-excel', 'csv-to-excel', 'CSV to Excel (TSV)', 'developer', 'csv to excel download online free', 'Convert CSV data to Excel-compatible TSV download.'),
  tool('excel-csv', 'excel-to-csv', 'Excel to CSV', 'developer', 'excel to csv converter online free', 'Convert tab-separated spreadsheet data to CSV.'),
  tool('schema-generator', 'schema-markup-generator', 'Schema Markup Generator', 'web', 'schema org json-ld generator online', 'Generate JSON-LD schema markup for SEO.'),
  tool('faq-schema', 'faq-schema-generator', 'FAQ Schema Generator', 'web', 'faq schema json-ld generator online', 'Build FAQ structured data for rich search results.'),
  tool('breadcrumb-schema', 'breadcrumb-schema-generator', 'Breadcrumb Schema Generator', 'web', 'breadcrumb schema generator online', 'Generate breadcrumb JSON-LD for search engines.'),
  tool('twitter-card', 'twitter-card-generator', 'Twitter Card Generator', 'web', 'twitter card meta tags generator online', 'Generate Twitter/X card meta tags for link previews.'),
  tool('linkedin-preview', 'linkedin-post-preview', 'LinkedIn Post Preview', 'web', 'linkedin post preview generator online', 'Preview how your post will look on LinkedIn.'),
  tool('canonical-tag', 'canonical-tag-generator', 'Canonical Tag Generator', 'web', 'canonical url tag generator seo online', 'Generate canonical link tags for duplicate content.'),
  tool('hreflang-generator', 'hreflang-generator', 'Hreflang Tag Generator', 'web', 'hreflang tag generator international seo', 'Build hreflang alternate link tags for multilingual sites.'),
  tool('css-animation', 'css-animation-generator', 'CSS Animation Generator', 'design', 'css animation keyframes generator online', 'Build CSS keyframe animations with live preview.'),
  tool('css-filter', 'css-filter-generator', 'CSS Filter Generator', 'design', 'css filter generator blur brightness online', 'Design CSS filter effects with live image preview.'),
  tool('css-text-shadow', 'css-text-shadow-generator', 'CSS Text Shadow Generator', 'design', 'css text shadow generator online', 'Create CSS text-shadow effects with live preview.'),
  tool('css-spinner', 'css-spinner-generator', 'CSS Loading Spinner Generator', 'design', 'css loading spinner generator online', 'Generate pure CSS loading spinner animations.'),
  tool('css-glass', 'glassmorphism-generator', 'Glassmorphism Generator', 'design', 'glassmorphism css generator online', 'Generate glassmorphism UI CSS with blur and transparency.'),
  tool('wcag-contrast', 'wcag-contrast-checker', 'WCAG Contrast Checker', 'design', 'wcag color contrast checker online', 'Check color contrast ratios for WCAG AA and AAA compliance.'),
  tool('golden-ratio', 'golden-ratio-calculator', 'Golden Ratio Calculator', 'design', 'golden ratio calculator design online', 'Calculate golden ratio proportions for layouts.'),
  tool('business-card', 'business-card-generator', 'Business Card Generator', 'design', 'business card generator online free', 'Design a simple business card and download as PNG.'),
  tool('certificate-gen', 'certificate-generator', 'Certificate Generator', 'design', 'certificate generator online free download', 'Create award certificates as downloadable images.'),
  tool('wheel-spinner', 'wheel-spinner', 'Wheel Spinner', 'text', 'wheel spinner random picker online', 'Spin a wheel to pick random winners or choices.'),
  tool('lottery-numbers', 'lottery-number-generator', 'Lottery Number Generator', 'math', 'lottery number generator random online', 'Generate random lottery number combinations.'),
  tool('bingo-card', 'bingo-card-generator', 'Bingo Card Generator', 'text', 'bingo card generator online free', 'Generate printable bingo cards with random numbers.'),
  tool('team-generator', 'team-generator', 'Team Generator', 'text', 'random team generator online free', 'Split a list of names into random balanced teams.'),
  tool('decision-maker', 'decision-maker', 'Decision Maker', 'text', 'decision maker yes no maybe online', 'Get a random decision when you cannot choose.'),
  tool('magic-8ball', 'magic-8-ball', 'Magic 8 Ball', 'text', 'magic 8 ball online free', 'Ask the Magic 8 Ball for a random answer.'),
  tool('rock-paper-scissors', 'rock-paper-scissors', 'Rock Paper Scissors', 'text', 'rock paper scissors online game', 'Play rock paper scissors against the computer.'),
  tool('yes-no-oracle', 'yes-no-oracle', 'Yes or No Oracle', 'text', 'yes no oracle random answer online', 'Get instant yes or no answers to your questions.'),
  tool('bracket-generator', 'tournament-bracket-generator', 'Tournament Bracket Generator', 'text', 'tournament bracket generator online free', 'Generate single-elimination tournament brackets.'),
  tool('name-combiner', 'name-combiner', 'Name Combiner', 'text', 'combine names generator online', 'Combine two names into creative blended options.'),
  tool('steps-converter', 'steps-to-miles-calculator', 'Steps to Miles Calculator', 'math', 'steps to miles km calculator online', 'Convert step count to miles or kilometers walked.'),
  tool('sleep-calculator', 'sleep-calculator', 'Sleep Cycle Calculator', 'datetime', 'sleep calculator wake up time online', 'Find optimal wake-up times based on sleep cycles.'),
  tool('json-to-ts', 'json-to-typescript', 'JSON to TypeScript', 'developer', 'json to typescript interface generator online', 'Generate TypeScript interfaces from JSON data.'),
  tool('json-to-go', 'json-to-go', 'JSON to Go Struct', 'developer', 'json to go struct generator online', 'Generate Go struct types from JSON objects.'),
  tool('json-to-python', 'json-to-python', 'JSON to Python Dataclass', 'developer', 'json to python dataclass generator online', 'Generate Python dataclass definitions from JSON.'),
  tool('sql-to-json', 'sql-to-json', 'SQL Insert to JSON', 'developer', 'sql insert to json converter online', 'Parse SQL INSERT statements into JSON arrays.'),
  tool('html-table-json', 'html-table-to-json', 'HTML Table to JSON', 'developer', 'html table to json converter online', 'Convert HTML table markup into JSON data.'),
  tool('markdown-table', 'markdown-table-generator', 'Markdown Table Generator', 'developer', 'markdown table generator online', 'Build markdown tables from CSV-like input.'),
  tool('lorem-json', 'json-data-generator', 'JSON Data Generator', 'developer', 'json mock data generator online', 'Generate sample JSON objects for testing APIs.'),
  tool('fake-user', 'fake-user-generator', 'Fake User Data Generator', 'developer', 'fake user data generator testing online', 'Generate fake user profiles for testing and demos.'),
  tool('nanoid-generator', 'nanoid-generator', 'Nano ID Generator', 'developer', 'nanoid generator online free', 'Generate compact unique Nano ID strings.'),
  tool('ulid-generator', 'ulid-generator', 'ULID Generator', 'developer', 'ulid generator sortable id online', 'Generate sortable ULID unique identifiers.'),
  tool('slug-bulk', 'bulk-slug-generator', 'Bulk Slug Generator', 'web', 'bulk slug generator urls online', 'Generate URL slugs for multiple titles at once.'),
  tool('color-palette-gen', 'color-palette-generator', 'Color Palette Generator', 'design', 'color palette generator from hex online', 'Generate harmonious color palettes from a base color.'),
  tool('gradient-palette', 'gradient-palette-generator', 'Gradient Palette Generator', 'design', 'gradient color palette generator online', 'Generate multi-stop gradient color palettes.'),
  tool('favicon-from-text', 'text-favicon-generator', 'Text Favicon Generator', 'design', 'text favicon generator online free', 'Create favicons from initials or emoji text.'),
  tool('invoice-number', 'invoice-number-generator', 'Invoice Number Generator', 'finance', 'invoice number generator sequential online', 'Generate sequential invoice numbers with prefixes.'),
  tool('receipt-maker', 'receipt-generator', 'Simple Receipt Generator', 'finance', 'receipt generator online free pdf', 'Create simple receipts as printable PDFs.'),
  tool('quote-calculator', 'quote-calculator', 'Project Quote Calculator', 'finance', 'project quote calculator freelance online', 'Calculate project quotes from hours rate and expenses.'),
  tool('unit-price', 'unit-price-calculator', 'Unit Price Calculator', 'finance', 'unit price calculator compare deals online', 'Compare unit prices to find the best deal.'),
  tool('markup-calculator', 'markup-calculator', 'Markup Calculator', 'finance', 'markup calculator cost price online', 'Calculate selling price from cost and markup percentage.'),
  tool('vat-calculator', 'vat-calculator', 'VAT Calculator UK/EU', 'finance', 'vat calculator add remove online', 'Add or remove VAT from prices for UK and EU.'),
  tool('currency-format', 'currency-formatter', 'Currency Formatter', 'finance', 'currency number formatter online', 'Format numbers as currency for any locale.'),
  tool('number-format', 'number-formatter', 'Number Formatter', 'math', 'number formatter commas decimals online', 'Format numbers with commas and decimal places.'),
  tool('binary-calculator', 'binary-calculator', 'Binary Calculator', 'math', 'binary calculator add subtract online', 'Add and subtract binary numbers.'),
  tool('hex-calculator', 'hex-calculator', 'Hexadecimal Calculator', 'math', 'hex calculator add subtract online', 'Perform arithmetic on hexadecimal numbers.'),
  tool('subnet-mask', 'subnet-mask-calculator', 'Subnet Mask Calculator', 'developer', 'subnet mask calculator online', 'Calculate subnet masks and network addresses.'),
  tool('port-lookup', 'port-number-lookup', 'Port Number Lookup', 'developer', 'port number lookup tcp udp online', 'Look up common TCP and UDP port numbers.'),
  tool('ascii-art-banner', 'ascii-banner-generator', 'ASCII Banner Generator', 'text', 'ascii banner generator terminal online', 'Create large ASCII art banners from text.'),
  tool('figlet-text', 'figlet-text-generator', 'FIGlet Text Generator', 'text', 'figlet ascii art text generator online', 'Generate FIGlet-style ASCII art text.'),
  tool('dot-matrix', 'dot-matrix-text', 'Dot Matrix Text', 'text', 'dot matrix text generator online', 'Render text in dot matrix LED style.'),
  tool('encrypt-text', 'text-encrypt-decrypt', 'Text Encrypt & Decrypt (AES)', 'security', 'aes text encrypt decrypt online browser', 'Encrypt and decrypt text with a passphrase using AES.'),
  tool('hash-compare', 'hash-compare', 'Hash Compare Tool', 'security', 'compare hash checksum online', 'Compare two hash strings for equality.'),
  tool('password-leak', 'password-leak-checker', 'Password Breach Checker', 'security', 'password breach checker k-anonymity online', 'Check if a password appeared in known breaches using k-anonymity.'),
];

const existing = JSON.parse(fs.readFileSync(toolsPath, 'utf8').replace(/^\uFEFF/, ''));
const seen = new Set(existing.map(t => t.id));
let added = 0;
for (const t of MEGA) {
  if (seen.has(t.id)) continue;
  existing.push(t);
  seen.add(t.id);
  added++;
}
fs.writeFileSync(toolsPath, JSON.stringify(existing, null, 2), 'utf8');
console.log('Tools:', existing.length, '(+' + added + ' new)');

// Expand conversions programmatically
const UNIT_PAIRS = [
  ['nm', 'micrometer', 1000, 'mul'], ['micrometer', 'nm', 1000, 'mul'],
  ['micrometer', 'mm', 1000, 'div'], ['mm', 'micrometer', 1000, 'mul'],
  ['cm', 'mm', 10, 'mul'], ['mm', 'cm', 10, 'div'],
  ['meters', 'km', 1000, 'div'], ['km', 'meters', 1000, 'mul'],
  ['km', 'miles', 1.60934, 'div'], ['miles', 'km', 1.60934, 'mul'],
  ['inches', 'feet', 12, 'div'], ['feet', 'inches', 12, 'mul'],
  ['yards', 'feet', 3, 'mul'], ['feet', 'yards', 3, 'div'],
  ['miles', 'yards', 1760, 'mul'], ['yards', 'miles', 1760, 'div'],
  ['grams', 'kg', 1000, 'div'], ['kg', 'grams', 1000, 'mul'],
  ['mg', 'grams', 1000, 'div'], ['grams', 'mg', 1000, 'mul'],
  ['metric-ton', 'kg', 1000, 'mul'], ['kg', 'metric-ton', 1000, 'div'],
  ['pounds', 'oz', 16, 'mul'], ['oz', 'pounds', 16, 'div'],
  ['liters', 'ml', 1000, 'mul'], ['ml', 'liters', 1000, 'div'],
  ['gallons', 'quarts', 4, 'mul'], ['quarts', 'gallons', 4, 'div'],
  ['quarts', 'liters', 0.946353, 'mul'], ['liters', 'quarts', 0.946353, 'div'],
  ['pints', 'cups', 2, 'mul'], ['cups', 'pints', 2, 'div'],
  ['tablespoons', 'ml', 14.7868, 'mul'], ['ml', 'tablespoons', 14.7868, 'div'],
  ['teaspoons', 'ml', 4.92892, 'mul'], ['ml', 'teaspoons', 4.92892, 'div'],
  ['fahrenheit', 'kelvin', null, 'f_to_k'],
  ['kelvin', 'fahrenheit', null, 'k_to_f'],
  ['joules', 'calories', 4.184, 'div'], ['calories', 'joules', 4.184, 'mul'],
  ['joules', 'kwh', 3.6e6, 'div'], ['kwh', 'joules', 3.6e6, 'mul'],
  ['watts', 'horsepower', 745.7, 'div'], ['horsepower', 'watts', 745.7, 'mul'],
  ['pascal', 'psi', 6894.76, 'div'], ['psi', 'pascal', 6894.76, 'mul'],
  ['pascal', 'bar', 100000, 'div'], ['bar', 'pascal', 100000, 'mul'],
  ['lux', 'footcandles', 10.764, 'div'], ['footcandles', 'lux', 10.764, 'mul'],
  ['bits', 'bytes', 8, 'div'], ['bytes', 'bits', 8, 'mul'],
  ['mbps', 'gbps', 1000, 'div'], ['gbps', 'mbps', 1000, 'mul'],
  ['rpm', 'hz', 60, 'div'], ['hz', 'rpm', 60, 'mul'],
  ['degrees', 'turns', 360, 'div'], ['turns', 'degrees', 360, 'mul'],
  ['radians', 'turns', 6.28319, 'mul'], ['turns', 'radians', 6.28319, 'div'],
  ['hectares', 'sqm', 10000, 'mul'], ['sqm', 'hectares', 10000, 'div'],
  ['sqm', 'sqcm', 10000, 'mul'], ['sqcm', 'sqm', 10000, 'div'],
  ['cubic-meters', 'liters', 1000, 'mul'], ['liters', 'cubic-meters', 1000, 'div'],
  ['cubic-feet', 'gallons', 7.48052, 'mul'], ['gallons', 'cubic-feet', 7.48052, 'div'],
];

const baseConv = JSON.parse(fs.readFileSync(convPath, 'utf8').replace(/^\uFEFF/, ''));
const convKey = c => `${c.from}|${c.to}`;
const convSet = new Set(baseConv.map(convKey));

function addConv(from, to, type, spec) {
  const key = `${from}|${to}`;
  if (convSet.has(key)) return;
  convSet.add(key);
  if (typeof spec === 'string') baseConv.push({ from, to, type, special: spec });
  else baseConv.push({ from, to, type, factor: spec[0], op: spec[1] });
}

for (const [from, to, factor, op] of UNIT_PAIRS) {
  if (op === 'f_to_k' || op === 'k_to_f') addConv(from, to, 'temperature', op === 'f_to_k' ? 'f_to_k' : 'k_to_f');
  else addConv(from, to, 'unit', [factor, op]);
}

fs.writeFileSync(convPath, JSON.stringify(baseConv, null, 2), 'utf8');
console.log('Convert pages:', baseConv.length);

// Bundle mega JS
const header = `// Mega tools bundle — ${added} tools\n`;
const impl = fs.existsSync(megaImpl) ? fs.readFileSync(megaImpl, 'utf8') : '';
fs.writeFileSync(megaJsOut, header + impl, 'utf8');
console.log('Wrote', megaJsOut);
