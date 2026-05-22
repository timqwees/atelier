// Quick test: can DRIVER_DETECTION_PROMPT be serialized to valid JSON?
require('dotenv').config();
const fs = require('fs');

// Simulate loading sections
const code = fs.readFileSync('server.js', 'utf8');
const pdMatch = code.match(/const PRICE_DATA = `([\s\S]*?)`;/);
if (!pdMatch) { console.log('PRICE_DATA not found'); process.exit(1); }
const PRICE_DATA = pdMatch[1];

const SECTIONS = {};
let currentKey = null, currentLines = [];
for (const line of PRICE_DATA.split('\n')) {
  const m = line.match(/^===\s*(.+?)\s*===$/);
  if (m) {
    if (currentKey) SECTIONS[currentKey] = currentLines.join('\n').trim();
    currentKey = m[1]; currentLines = [];
  } else if (currentKey) currentLines.push(line);
}
if (currentKey) SECTIONS[currentKey] = currentLines.join('\n').trim();

// Simulate APPLICABILITY_LOOKUP
const APPLICABILITY_LOOKUP = {
  'платье вечернее(свадебное)': 'ПРИМЕНИМОСТЬ_ПЛАТЬЯ',
};

// Simulate buildPhase2PriceData
function buildPhase2PriceData(baseName) {
  const parts = [];
  if (SECTIONS['ДРАЙВЕРЫ']) parts.push(SECTIONS['ДРАЙВЕРЫ']);
  const appKey = APPLICABILITY_LOOKUP[baseName.toLowerCase().trim()];
  if (appKey && SECTIONS[appKey]) parts.push(SECTIONS[appKey]);
  return parts.join('\n\n');
}

// Replicate DRIVER_DETECTION_PROMPT
function DRIVER_DETECTION_PROMPT(baseName, basePrice) {
  const targetedPriceData = buildPhase2PriceData(baseName);
  const appSheetName = APPLICABILITY_LOOKUP[baseName.toLowerCase().trim()] || '';
  const appSheetRaw = appSheetName ? (SECTIONS[appSheetName] || '') : '';

  const checklistItems = [];
  if (appSheetRaw) {
    const lines = appSheetRaw.split('\n');
    for (const line of lines) {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 4 && parts[0] !== 'Элемент') {
        checklistItems.push({
          element: parts[0], code: parts[1],
          source: parts[2], hasQuestion: parts[3].toLowerCase() === 'да',
        });
      }
    }
  }

  let checklistText = checklistItems.map((item, i) =>
    `  ${i + 1}. "${item.element}" → код ${item.code} (источник: ${item.source}, спорный: ${item.hasQuestion ? 'да' : 'нет'})`
  ).join('\n');

  const prompt = `Тест промпт ${baseName} ${basePrice}\n${checklistText}`;
  return prompt;
}

const prompt = DRIVER_DETECTION_PROMPT('платье вечернее(свадебное)', 80000);
console.log('Prompt length:', prompt.length);
console.log('Checklist items found');

// Test JSON.stringify
const body = {
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: prompt },
    { role: 'user', content: 'test message' },
  ],
  max_tokens: 4096,
  temperature: 0.0,
  response_format: { type: 'json_object' },
};

try {
  const json = JSON.stringify(body);
  console.log('JSON.stringify OK, size:', json.length);
  // Verify it parses back
  JSON.parse(json);
  console.log('JSON.parse OK');
} catch (e) {
  console.log('JSON ERROR:', e.message);
}
