/**
 * Generates tools-extended.json, merges catalog + popular flags, writes all-tools-extended.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const toolsPath = path.join(ROOT, 'data', 'tools.json');
const extPath = path.join(ROOT, 'data', 'tools-extended.json');
const jsPath = path.join(ROOT, 'src', 'assets', 'js', 'tools', 'all-tools-extended.js');

const POPULAR_IDS = new Set([
  'json-formatter', 'password-generator', 'qr-code', 'pdf-merger', 'background-remover',
  'unit-converter', 'base64', 'uuid-generator', 'word-counter', 'tip-calculator',
  'image-resizer', 'hash-generator', 'jwt-decoder', 'regex-tester', 'diff-checker',
  'case-converter', 'url-encoder', 'markdown-to-html', 'image-compressor', 'pdf-to-jpg',
  'video-to-mp3', 'currency-converter', 'epoch-converter', 'color-picker', 'yaml-json',
  'png-jpg-converter', 'pdf-to-images', 'images-to-pdf', 'webp-converter', 'text-to-speech',
  'background-remover', 'discount-calculator', 'cron-parser', 'html-formatter', 'find-replace'
]);

function tool(id, slug, name, category, keywords, description, related = []) {
  return { id, slug, name, category, status: 'live', keywords, description, privacy: 'client-only', related, popular: POPULAR_IDS.has(id) };
}

const NEW = [
  tool('background-remover', 'background-remover', 'Background Remover', 'image', 'remove background from image online free', 'Remove photo backgrounds instantly using AI in your browser.', ['image-resizer', 'png-jpg-converter', 'exif-stripper']),
  tool('image-cropper', 'image-cropper', 'Image Cropper', 'image', 'crop image online free', 'Crop images to custom dimensions with live preview.', ['image-resizer', 'aspect-ratio', 'background-remover']),
  tool('image-rotate', 'image-rotate-flip', 'Image Rotate & Flip', 'image', 'rotate flip image online', 'Rotate and flip images without uploading to a server.', ['image-cropper', 'image-resizer', 'exif-stripper']),
  tool('image-to-pdf', 'image-to-pdf', 'Image to PDF', 'document', 'convert image to pdf online free', 'Convert JPG or PNG images into a PDF document locally.', ['pdf-merger', 'images-to-pdf', 'pdf-to-jpg']),
  tool('pdf-to-jpg', 'pdf-to-jpg', 'PDF to JPG', 'document', 'convert pdf to jpg online free', 'Export PDF pages as JPG images in your browser.', ['pdf-merger', 'pdf-splitter', 'image-to-pdf']),
  tool('pdf-to-images', 'pdf-to-images', 'PDF to Images', 'document', 'pdf to png jpg images online', 'Convert every PDF page to downloadable PNG images.', ['pdf-to-jpg', 'pdf-splitter', 'image-to-pdf']),
  tool('pdf-compressor', 'pdf-compressor', 'PDF Compressor', 'document', 'compress pdf online free reduce size', 'Reduce PDF file size locally before sharing.', ['pdf-merger', 'pdf-splitter', 'pdf-to-jpg']),
  tool('pdf-rotate', 'pdf-rotate-pages', 'PDF Page Rotator', 'document', 'rotate pdf pages online free', 'Rotate PDF pages 90° or 180° locally.', ['pdf-merger', 'pdf-splitter', 'pdf-compressor']),
  tool('pdf-delete-pages', 'pdf-delete-pages', 'PDF Page Deleter', 'document', 'delete pdf pages online free', 'Remove specific pages from PDF files locally.', ['pdf-splitter', 'pdf-merger', 'pdf-rotate']),
  tool('images-to-pdf', 'images-to-pdf', 'Images to PDF', 'document', 'multiple images to pdf online', 'Combine multiple images into one PDF file.', ['pdf-merger', 'image-to-pdf', 'invoice-pdf']),
  tool('text-to-pdf', 'text-to-pdf', 'Text to PDF', 'document', 'text to pdf converter online free', 'Create a PDF from plain text instantly.', ['invoice-pdf', 'images-to-pdf', 'markdown-to-html']),
  tool('html-to-pdf', 'html-to-pdf', 'HTML to PDF', 'document', 'html to pdf print online free', 'Print HTML content to PDF using your browser.', ['text-to-pdf', 'markdown-to-html', 'invoice-pdf']),
  tool('pdf-page-numbers', 'pdf-page-numbers', 'PDF Page Numbers', 'document', 'add page numbers to pdf online', 'Add page numbers to PDF documents locally.', ['pdf-merger', 'pdf-rotate', 'invoice-pdf']),
  tool('webp-converter', 'webp-converter', 'WebP Converter', 'image', 'webp to png jpg converter online', 'Convert WebP images to PNG or JPG and back.', ['png-jpg-converter', 'image-compressor', 'image-resizer']),
  tool('svg-to-png', 'svg-to-png', 'SVG to PNG', 'image', 'svg to png converter online free', 'Rasterize SVG files to PNG images locally.', ['svg-optimizer', 'favicon-generator', 'image-resizer']),
  tool('image-grayscale', 'image-grayscale', 'Image Grayscale Filter', 'image', 'convert image to grayscale online', 'Turn color photos into black and white instantly.', ['image-compressor', 'png-jpg-converter', 'palette-picker']),
  tool('image-blur', 'image-blur', 'Image Blur Tool', 'image', 'blur image online free', 'Apply blur effects to images locally.', ['image-grayscale', 'image-resizer', 'exif-stripper']),
  tool('image-watermark', 'image-watermark', 'Image Watermark', 'image', 'add watermark to image online free', 'Add text watermarks to images before download.', ['image-resizer', 'quote-card', 'image-compressor']),
  tool('pixelate-image', 'pixelate-image', 'Pixelate Image', 'image', 'pixelate image censor online', 'Pixelate regions of an image for privacy.', ['image-blur', 'image-cropper', 'exif-stripper']),
  tool('invert-image', 'invert-image-colors', 'Invert Image Colors', 'image', 'invert image colors online', 'Invert image colors to create negative effects.', ['image-grayscale', 'palette-picker', 'image-compressor']),
  tool('video-to-mp3', 'video-to-mp3', 'Video to MP3', 'video', 'extract mp3 from video online free', 'Extract audio from video files as MP3 in your browser.', ['audio-trimmer', 'video-mute', 'audio-converter']),
  tool('video-compressor', 'video-compressor', 'Video Compressor', 'video', 'compress video online free reduce size', 'Reduce video file size locally before sharing.', ['video-trimmer', 'video-to-gif', 'video-to-mp3']),
  tool('video-trimmer', 'video-trimmer', 'Video Trimmer', 'video', 'trim cut video online free', 'Trim video clips to a start and end time locally.', ['video-compressor', 'video-to-gif', 'video-speed']),
  tool('video-to-gif', 'video-to-gif', 'Video to GIF', 'video', 'convert video to gif online free', 'Convert video clips into animated GIF files.', ['gif-splitter', 'video-trimmer', 'video-compressor']),
  tool('gif-to-mp4', 'gif-to-mp4', 'GIF to MP4', 'video', 'convert gif to mp4 online free', 'Convert animated GIFs to MP4 video files.', ['video-to-gif', 'gif-splitter', 'video-compressor']),
  tool('video-mute', 'video-mute', 'Mute Video', 'video', 'remove audio from video online free', 'Strip audio track from video files locally.', ['video-to-mp3', 'video-trimmer', 'video-compressor']),
  tool('video-speed', 'video-speed-changer', 'Video Speed Changer', 'video', 'speed up slow down video online', 'Change video playback speed locally.', ['video-trimmer', 'video-compressor', 'video-to-gif']),
  tool('audio-trimmer', 'audio-trimmer', 'Audio Trimmer', 'audio', 'trim audio online free cut mp3', 'Trim audio files to precise start and end points.', ['audio-converter', 'video-to-mp3', 'merge-audio']),
  tool('audio-converter', 'audio-converter', 'Audio Format Converter', 'audio', 'convert wav to mp3 online free', 'Convert audio between WAV and other formats locally.', ['audio-trimmer', 'video-to-mp3', 'merge-audio']),
  tool('merge-audio', 'merge-audio', 'Merge Audio Files', 'audio', 'merge combine audio files online', 'Join multiple audio clips into one file.', ['audio-trimmer', 'audio-converter', 'video-to-mp3']),
  tool('text-to-speech', 'text-to-speech', 'Text to Speech', 'audio', 'text to speech online free', 'Convert written text to spoken audio in your browser.', ['speech-to-text', 'word-counter', 'reading-time']),
  tool('speech-to-text', 'speech-to-text', 'Speech to Text', 'audio', 'speech to text online free dictation', 'Transcribe spoken words to text using your microphone.', ['text-to-speech', 'word-counter', 'markdown-editor']),
  tool('pressure-converter', 'pressure-converter', 'Pressure Converter', 'converter', 'psi bar pascal pressure converter', 'Convert between PSI, bar, Pascal, and atm pressure units.', ['unit-converter', 'energy-converter', 'power-converter']),
  tool('energy-converter', 'energy-converter', 'Energy Converter', 'converter', 'joules calories kwh converter online', 'Convert joules, calories, and kilowatt-hours.', ['power-converter', 'pressure-converter', 'unit-converter']),
  tool('power-converter', 'power-converter', 'Power Converter', 'converter', 'watts horsepower power converter', 'Convert watts, kilowatts, and mechanical horsepower.', ['energy-converter', 'pressure-converter', 'unit-converter']),
  tool('angle-converter', 'angle-converter', 'Angle Converter', 'converter', 'degrees radians gradians converter', 'Convert angles between degrees, radians, and gradians.', ['unit-converter', 'physics-solver', 'base-converter']),
  tool('fuel-economy', 'fuel-economy-converter', 'Fuel Economy Converter', 'converter', 'mpg to liters per 100km converter', 'Convert fuel economy between MPG and L/100km.', ['unit-converter', 'fuel-cost', 'speed-converter']),
  tool('cooking-converter', 'cooking-converter', 'Cooking Measurement Converter', 'converter', 'cups tbsp ml grams cooking converter', 'Convert cups, tablespoons, milliliters, and grams.', ['unit-converter', 'height-weight', 'percentage-calculator']),
  tool('frequency-converter', 'frequency-converter', 'Frequency Converter', 'converter', 'hz khz mhz frequency converter', 'Convert frequency between Hz, kHz, and MHz.', ['unit-converter', 'audio-generator', 'physics-solver']),
  tool('torque-converter', 'torque-converter', 'Torque Converter', 'converter', 'nm lb-ft torque converter online', 'Convert torque between newton-meters and pound-feet.', ['unit-converter', 'power-converter', 'pressure-converter']),
  tool('kelvin-converter', 'kelvin-converter', 'Kelvin Temperature Converter', 'converter', 'celsius kelvin fahrenheit converter', 'Convert between Kelvin, Celsius, and Fahrenheit.', ['unit-converter', 'epoch-converter', 'timezone-converter']),
  tool('nautical-converter', 'nautical-mile-converter', 'Nautical Mile Converter', 'converter', 'nautical miles km miles converter', 'Convert nautical miles to kilometers and statute miles.', ['unit-converter', 'speed-converter', 'gps-converter']),
  tool('stone-converter', 'stone-converter', 'Stone to KG Converter', 'converter', 'stone to kg pounds converter uk', 'Convert stone and pounds to kilograms.', ['height-weight', 'unit-converter', 'bmi-calculator']),
  tool('area-converter', 'square-feet-converter', 'Square Feet Converter', 'converter', 'square feet to square meters converter', 'Convert area between square feet and square meters.', ['unit-converter', 'aspect-ratio', 'storage-converter']),
  tool('data-rate', 'data-rate-converter', 'Data Rate Converter', 'converter', 'mbps to mbs data rate converter', 'Convert data transfer rates between Mbps and MB/s.', ['storage-converter', 'unit-converter', 'binary-text']),
  tool('shoe-size', 'shoe-size-converter', 'Shoe Size Converter', 'converter', 'us uk eu shoe size converter online', 'Convert shoe sizes between US, UK, and EU standards.', ['unit-converter', 'height-weight', 'ring-size']),
  tool('ring-size', 'ring-size-converter', 'Ring Size Converter', 'converter', 'ring size us uk mm converter', 'Convert ring sizes between US, UK, and millimeters.', ['shoe-size', 'unit-converter', 'aspect-ratio']),
  tool('rgb-cmyk', 'rgb-cmyk-converter', 'RGB to CMYK Converter', 'converter', 'rgb to cmyk color converter print', 'Convert RGB screen colors to CMYK for print design.', ['color-picker', 'palette-picker', 'css-gradient']),
  tool('hours-decimal', 'hours-to-decimal-converter', 'Hours to Decimal Converter', 'converter', 'hours minutes to decimal hours converter', 'Convert hours and minutes to decimal hour values.', ['hours-calculator', 'date-duration', 'stopwatch']),
  tool('fuel-cost', 'fuel-cost-calculator', 'Fuel Cost Calculator', 'converter', 'fuel cost trip calculator mpg', 'Estimate trip fuel cost from distance and economy.', ['fuel-economy', 'unit-converter', 'percentage-calculator']),
  tool('speed-converter', 'speed-converter', 'Speed Converter', 'converter', 'speed converter m/s km/h mph', 'Convert speed between m/s, km/h, and mph.', ['unit-converter', 'fuel-economy', 'physics-solver']),
  tool('scientific-calc', 'scientific-calculator', 'Scientific Calculator', 'math', 'scientific calculator online free', 'Perform advanced math with trig, log, and power functions.', ['percentage-calculator', 'equation-solver', 'fraction-calculator']),
  tool('fraction-calc', 'fraction-calculator', 'Fraction Calculator', 'math', 'fraction calculator add multiply online', 'Add, subtract, multiply, and simplify fractions.', ['percentage-calculator', 'scientific-calc', 'equation-solver']),
  tool('gpa-calculator', 'gpa-calculator', 'GPA Calculator', 'math', 'gpa calculator grade point average online', 'Calculate weighted GPA from course grades and credits.', ['percentage-calculator', 'scientific-calc', 'salary-calculator']),
  tool('iban-validator', 'iban-validator', 'IBAN Validator', 'finance', 'iban validator check online free', 'Validate International Bank Account Numbers locally.', ['credit-card-validator', 'hash-generator', 'sales-tax']),
  tool('html-to-markdown', 'html-to-markdown', 'HTML to Markdown', 'developer', 'html to markdown converter online', 'Convert HTML markup into clean Markdown text.', ['markdown-to-html', 'html-minifier', 'markdown-editor']),
  tool('xml-to-json', 'xml-to-json', 'XML to JSON Converter', 'developer', 'xml to json converter online free', 'Parse XML documents into JSON structure locally.', ['json-formatter', 'xml-formatter', 'yaml-json']),
  tool('json-to-xml', 'json-to-xml', 'JSON to XML Converter', 'developer', 'json to xml converter online free', 'Convert JSON data into XML markup locally.', ['xml-to-json', 'json-formatter', 'xml-formatter']),
  tool('unicode-escape', 'unicode-converter', 'Unicode Escape Converter', 'developer', 'unicode escape unescape converter online', 'Convert text to Unicode escape sequences and back.', ['html-entities', 'hex-text', 'binary-text']),
  tool('ascii-table', 'ascii-table', 'ASCII Table Reference', 'developer', 'ascii table character codes reference', 'Look up ASCII character codes and symbols instantly.', ['hex-text', 'binary-text', 'unicode-escape']),
  tool('instagram-formatter', 'instagram-line-breaks', 'Instagram Line Break Generator', 'text', 'instagram caption line breaks online', 'Add invisible line breaks for Instagram captions.', ['tweet-counter', 'word-counter', 'hashtag-generator']),
  tool('hashtag-generator', 'hashtag-generator', 'Hashtag Generator', 'text', 'hashtag generator instagram online', 'Generate relevant hashtags from keywords for social posts.', ['keyword-density', 'instagram-formatter', 'slugify']),
  tool('week-number', 'week-number-calculator', 'Week Number Calculator', 'datetime', 'week number calculator iso online', 'Find ISO week number for any calendar date.', ['epoch-converter', 'date-duration', 'age-calculator']),
  tool('iso-timestamp', 'iso-timestamp-converter', 'ISO Timestamp Converter', 'datetime', 'iso 8601 timestamp converter online', 'Convert dates to ISO 8601 format and parse timestamps.', ['epoch-converter', 'timezone-converter', 'cron-parser']),
  tool('flexbox-gen', 'flexbox-generator', 'CSS Flexbox Generator', 'design', 'css flexbox generator online', 'Build flexbox layouts with live preview and CSS output.', ['css-grid-gen', 'css-box-shadow', 'pixel-to-rem']),
  tool('css-grid-gen', 'css-grid-generator', 'CSS Grid Generator', 'design', 'css grid generator online', 'Design CSS grid layouts with visual controls.', ['flexbox-gen', 'css-box-shadow', 'aspect-ratio']),
  tool('color-shades', 'color-shades-generator', 'Color Shades Generator', 'design', 'color shades tints generator hex online', 'Generate tints and shades from any base hex color.', ['color-picker', 'css-gradient', 'palette-picker']),
  tool('meme-generator', 'meme-generator', 'Meme Generator', 'design', 'meme generator online free', 'Add top and bottom text to images for memes.', ['quote-card', 'image-watermark', 'image-resizer']),
  tool('signature-pad', 'signature-generator', 'Draw Signature', 'design', 'draw signature online download png', 'Draw and download your signature as a PNG image.', ['invoice-pdf', 'email-signature', 'favicon-generator']),
  tool('json-schema', 'json-schema-validator', 'JSON Schema Validator', 'developer', 'json schema validator online', 'Validate JSON documents against a schema definition.', ['json-formatter', 'yaml-json', 'regex-tester']),
  tool('http-status', 'http-status-codes', 'HTTP Status Codes', 'developer', 'http status codes reference lookup', 'Search HTTP status codes with meanings and usage notes.', ['nginx-generator', 'webhook-tester', 'regex-cheatsheet']),
  tool('extract-urls', 'extract-urls', 'Extract URLs from Text', 'text', 'extract urls from text online', 'Pull all URLs from pasted text or HTML content.', ['query-string', 'link-opener', 'slugify']),
  tool('extract-emails', 'extract-emails', 'Extract Emails from Text', 'text', 'extract email addresses from text online', 'Find and list email addresses in any text block.', ['extract-urls', 'find-replace', 'list-dedupe']),
  tool('transpose-text', 'transpose-text', 'Transpose Text Columns', 'text', 'transpose rows columns text online', 'Swap rows and columns in tabular text data.', ['csv-to-json', 'text-joiner', 'array-to-table']),
  tool('column-to-rows', 'columns-to-rows', 'Columns to Rows', 'text', 'convert columns to rows text online', 'Transform column data into row format.', ['transpose-text', 'text-joiner', 'csv-to-json']),
  tool('business-days', 'business-days-calculator', 'Business Days Calculator', 'datetime', 'business days calculator exclude weekends', 'Count business days between two dates.', ['date-duration', 'age-calculator', 'week-number']),
  tool('car-loan', 'car-loan-calculator', 'Car Loan Calculator', 'finance', 'car loan calculator monthly payment', 'Estimate auto loan payments with down payment and rate.', ['loan-calculator', 'mortgage-calculator', 'compound-interest']),
  tool('debt-payoff', 'debt-payoff-calculator', 'Debt Payoff Calculator', 'finance', 'debt payoff calculator snowball avalanche', 'Plan debt payoff with extra monthly payments.', ['loan-calculator', 'compound-interest', 'yearly-savings']),
  tool('csv-to-xml', 'csv-to-xml', 'CSV to XML Converter', 'developer', 'csv to xml converter online free', 'Convert CSV spreadsheet data into XML format.', ['csv-to-json', 'xml-to-json', 'json-to-xml']),
  tool('xml-to-csv', 'xml-to-csv', 'XML to CSV Converter', 'developer', 'xml to csv converter online free', 'Convert XML data into CSV spreadsheet format.', ['csv-to-xml', 'xml-to-json', 'json-to-csv']),
  tool('qr-decoder', 'qr-code-decoder', 'QR Code Decoder', 'web', 'qr code decoder reader online', 'Decode QR codes from uploaded images locally.', ['qr-code', 'barcode', 'file-identify']),
];

// Mark popular on existing tools when merging
const RECAT = {
  'pdf-merger': 'document', 'pdf-splitter': 'document', 'invoice-pdf': 'document',
  'image-compressor': 'image', 'image-resizer': 'image', 'png-jpg-converter': 'image',
  'data-url': 'image', 'palette-picker': 'image', 'exif-stripper': 'image', 'gif-splitter': 'image',
  'svg-tracer': 'image', 'pdf-to-jpg': 'document', 'audio-generator': 'audio'
};
const existing = JSON.parse(fs.readFileSync(toolsPath, 'utf8').replace(/^\uFEFF/, ''));
const seen = new Set(existing.map(t => t.id));
const merged = existing.map(t => ({
  ...t,
  popular: POPULAR_IDS.has(t.id) || t.popular === true,
  category: RECAT[t.id] || t.category
}));
for (const t of NEW) {
  if (seen.has(t.id)) continue;
  merged.push(t);
  seen.add(t.id);
}

fs.writeFileSync(extPath, JSON.stringify(NEW, null, 2), 'utf8');
fs.writeFileSync(toolsPath, JSON.stringify(merged, null, 2), 'utf8');
console.log('Merged catalog:', merged.length, 'tools (+' + NEW.length + ' new)');

// Generate JS bundle header + hand-written implementations
const js = [`// Extended tools bundle — ${NEW.length} additional tools`, ''];
const implPath = path.join(__dirname, 'extended-tool-impls.js');
if (fs.existsSync(implPath)) {
  js.push(fs.readFileSync(implPath, 'utf8'));
} else {
  console.warn('Missing extended-tool-impls.js');
}

fs.writeFileSync(jsPath, js.join('\n'), 'utf8');
console.log('Wrote', jsPath);
