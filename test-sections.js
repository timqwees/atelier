const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');
const startMarker = "const PRICE_DATA = `";
const startIdx = code.indexOf(startMarker);
if (startIdx === -1) { console.log('No PRICE_DATA found'); process.exit(1); }
const afterStart = startIdx + startMarker.length;
const endIdx = code.indexOf('`;', afterStart);
const PRICE_DATA = code.substring(afterStart, endIdx);

function parseSections(text) {
  const sections = {};
  const regex = /===\s*([A-ZА-ЯЁ_0-9]+)\s*===/g;
  let m;
  const markers = [];
  while ((m = regex.exec(text)) !== null) {
    markers.push({ name: m[1], start: m.index, headerEnd: m.index + m[0].length });
  }
  for (let i = 0; i < markers.length; i++) {
    const contentStart = markers[i].headerEnd;
    const contentEnd = i + 1 < markers.length ? markers[i + 1].start : text.length;
    sections[markers[i].name] = text.slice(contentStart, contentEnd).trim();
  }
  return sections;
}

const SECTIONS = parseSections(PRICE_DATA);
console.log('Total sections:', Object.keys(SECTIONS).length);
console.log('Section names:', Object.keys(SECTIONS).join(', '));
console.log('БАЗА_ИЗДЕЛИЙ present:', !!SECTIONS['БАЗА_ИЗДЕЛИЙ'], 'length:', (SECTIONS['БАЗА_ИЗДЕЛИЙ'] || '').length);
console.log('ДРАЙВЕРЫ present:', !!SECTIONS['ДРАЙВЕРЫ'], 'length:', (SECTIONS['ДРАЙВЕРЫ'] || '').length);
console.log('СКРИПТ_БОТА present:', !!SECTIONS['СКРИПТ_БОТА'], 'length:', (SECTIONS['СКРИПТ_БОТА'] || '').length);
