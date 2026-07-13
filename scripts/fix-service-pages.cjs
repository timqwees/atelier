const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'final-pages');
const entries = fs.readdirSync(dir, { withFileTypes: true });

const ERROR_BLOCK_NEW = `if (data.error) {
            var errMsg = '\u0418\u0437\u0432\u0438\u043d\u0438\u0442\u0435, AI-\u043a\u043e\u043d\u0441\u0443\u043b\u044c\u0442\u0430\u043d\u0442 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.';
            if (data.chatwootFallback) { errMsg += ' \u0412\u044b \u043c\u043e\u0436\u0435\u0442\u0435 \u043d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043c\u0430\u0441\u0442\u0435\u0440\u0443 \u043d\u0430\u043f\u0440\u044f\u043c\u0443\u044e \u0432 \u0447\u0430\u0442.'; addMessage('bot', errMsg); addChatwootFallback(); return; }
            addMessage('bot', data.error);
            return;
          }`;

const ERROR_BLOCK_OLD = /if\s*\(data\.error\)\s*\{\s*addMessage\('bot',\s*data\.error\);\s*return;\s*\}/g;

const CATCH_NEW = `.catch(function () {
          typing.remove();
          addMessage('bot', '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043e\u043c. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.');
          addChatwootFallback();
        })`;

const CATCH_OLD = /\.catch\(function\s*\(\)\s*\{\s*typing\.remove\(\);\s*addMessage\('bot',\s*'[^']+'\);\s*\}(?:\s*addChatwootFallback\(\);)?\)/g;

const FALLBACK_FN = `
    function addChatwootFallback() {
      var fb = document.querySelector('.chatwoot-fallback-btn');
      if (fb) return;
      var wrap = document.querySelector('.chat-messages');
      if (!wrap) return;
      var btn = document.createElement('button');
      btn.className = 'chatwoot-fallback-btn';
      btn.textContent = '\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0432 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0443';
      btn.onclick = function () {
        if (window.$chatwoot && window.$chatwoot.toggle) { window.$chatwoot.toggle(); }
        else if (window.chatwootSDK) {
          window.chatwootSDK.run({ websiteToken: 'ZFDyf4j1nG7yALnV2ECbPG5H', baseUrl: 'https://app.chatwoot.com' });
          setTimeout(function () { if (window.$chatwoot && window.$chatwoot.toggle) window.$chatwoot.toggle(); }, 500);
        } else {
          window.open('https://t.me/atelie1513_bot', '_blank');
        }
      };
      wrap.appendChild(btn);
    }
`;

entries.forEach(entry => {
  if (!entry.isDirectory()) return;
  const f = path.join(dir, entry.name, 'assets', 'service-page.js');
  if (!fs.existsSync(f)) return;

  let code = fs.readFileSync(f, 'utf8');
  const orig = code;

  // Remove broken addChatwootFallback() calls between .catch() and .finally()
  code = code.replace(/\)\s*\n\s*addChatwootFallback\(\);\s*\n\s*\.finally\(/g, ')\n        .finally(');

  // Replace data.error block
  code = code.replace(ERROR_BLOCK_OLD, ERROR_BLOCK_NEW);

  // Replace .catch() block
  code = code.replace(CATCH_OLD, CATCH_NEW);

  // Add fallback function if not present
  if (!code.includes('function addChatwootFallback()')) {
    code = code.replace(/function send\(\) \{/, FALLBACK_FN + '\n    function send() {');
  }

  if (code !== orig) {
    fs.writeFileSync(f, code);
    console.log('Patched:', entry.name);
  }
});

console.log('Done');
