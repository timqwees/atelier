// Комплексный поведенческий тест бота-ассистента.
// Требует запущенный сервер (по умолчанию http://127.0.0.1:8097; переопредели BOT_ORIGIN).
// Покрывает классы багов, найденные аудитом: распознавание интента (кнопки/синонимы),
// контекстную безопасность (глобально не ломать), отражение деталей, корректные цены.
//
// Запуск:  BOT_ORIGIN=http://127.0.0.1:8097 node scripts/diagnose-bot.mjs

const ORIGIN = process.env.BOT_ORIGIN || 'http://127.0.0.1:8097';
const TROUSERS = { route: '/services/custom-tailoring/women/trousers', lockBase: true };
const GREET = 'Отлично, брюки женские два кармана! Расскажите, что для вас важно — материал, длина, детали.';
const INTENT_Q = /сшить новое изделие или скорректировать готовое/i;

let pass = 0; const fails = [];
const ok = (cond, name, extra = '') => { if (cond) { pass++; } else { fails.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); } };

async function chat(sid, messages, ctx) {
  const r = await fetch(`${ORIGIN}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sid, messages, ...(ctx ? { assistantContext: ctx } : {}) }),
  });
  const j = await r.json().catch(() => ({}));
  return j.reply || `ERR:${j.error}`;
}
const rid = () => Math.random().toString(36).slice(2, 9);
const amount = (s) => { const m = String(s).match(/(\d[\d\s  ]{3,})\s*руб/); return m ? +m[1].replace(/[^\d]/g, '') : null; };
// один ход: изделие → интент-вопрос → ответ
async function afterIntent(answer) {
  const sid = 'i' + rid();
  const m = [{ role: 'user', content: 'хочу классические брюки' }];
  const q = await chat(sid, m); m.push({ role: 'assistant', content: q });
  m.push({ role: 'user', content: answer });
  return chat(sid, m);
}
async function trousersPrice(userMsg) {
  return chat('p' + rid(), [{ role: 'assistant', content: GREET }, { role: 'user', content: userMsg }], TROUSERS);
}

console.log('▶ Диагностика бота @', ORIGIN, '\n');

// 1. ИНТЕНТ — пошив: кнопки/синонимы/словоформы → НЕ дубль
console.log('1. Интент → пошив (без дубля):');
for (const a of ['новое', 'новый', 'новую', 'новые', 'новенькое', 'хочу новое', 'создать новое', 'пошейте', 'пошив', 'сшить', 'с нуля', 'на заказ', 'первое']) {
  const r = await afterIntent(a); ok(!INTENT_Q.test(r), `пошив «${a}»`, INTENT_Q.test(r) ? 'дубль' : '');
}
// 2. ИНТЕНТ — корректировка
console.log('2. Интент → корректировка (без дубля):');
for (const a of ['готовое', 'готовую', 'готовый', 'имеющееся', 'есть готовые', 'переделать', 'переделка', 'второе', 'скорректировать', 'подшить']) {
  const r = await afterIntent(a); ok(!INTENT_Q.test(r), `корр «${a}»`, INTENT_Q.test(r) ? 'дубль' : '');
}
// 3. НЕГАТИВНЫЕ + МАРШРУТИЗАЦИЯ — контекстность не ломает глобально; описание = пошив; глагол = корректировка
console.log('3. Негативные и маршрутизация:');
{
  const deepAlt = /какую корректировку|обработка низа|какое изделие нужно скорректировать/i;
  const raw = async (t) => chat('n' + rid(), [{ role: 'user', content: t }]);
  ok(!deepAlt.test(await raw('готовое к лету платье')), '«готовое к лету платье» не в корректировку');
  ok(!INTENT_Q.test(await raw('новое пальто в пол')), '«новое пальто в пол» → пошив');
  ok(!INTENT_Q.test(await raw('классические брюки со стрелками из шерсти')), 'описание «брюки со стрелками из шерсти» → пошив, без интент-вопроса');
  ok(!INTENT_Q.test(await raw('длинное платье из шёлка')), 'описание «длинное платье из шёлка» → пошив');
  ok(deepAlt.test(await raw('укоротить брюки')), 'глагол «укоротить брюки» → корректировка');
  ok(deepAlt.test(await raw('хочу подшить пальто')), 'глагол «подшить пальто» → корректировка');
}
// 4. ОТРАЖЕНИЕ деталей (все изделия)
console.log('4. Отражение деталей:');
{
  const r1 = await chat('r' + rid(), [{ role: 'user', content: 'хочу сшить классические брюки с защипом и стрелками' }]);
  ok(/защип/i.test(r1) && /стрелк/i.test(r1), 'брюки: отражает защип+стрелки', /защип/i.test(r1) ? '' : r1.slice(0, 50));
  const r2 = await trousersPrice('женские брюки из шерсти с высокой посадкой, размер 52');
  ok(/посадк|шерст/i.test(r2), 'брюки: отражает посадку/материал', r2.slice(0, 45));
}
// 5. ЦЕНЫ
console.log('5. Цены:');
{
  const base = amount(await trousersPrice('женские брюки из шерсти, два кармана, без подкладки, размер 52'));
  ok(base === 28600, 'два кармана = 28600', `got ${base}`);
  const zash = amount(await trousersPrice('женские брюки из шерсти с защипом, два кармана, без подкладки, размер 52'));
  ok(zash === 42900, 'защип = сложный крой +50% → 42900 (подтверждено ателье)', `got ${zash}`);
  const three = amount(await trousersPrice('женские брюки из шерсти, три кармана, без подкладки, размер 52'));
  ok(three === 30800, 'три кармана = 30800', `got ${three}`);
}
// 6. РЕГРЕССИЯ addon + корректировка
console.log('6. Регрессия:');
{
  const sid = 'ad' + rid(); const spec = 'женские брюки из шерсти, два кармана, без подкладки, размер 52';
  const m = [{ role: 'assistant', content: GREET }, { role: 'user', content: spec }];
  const a1 = await chat(sid, m, TROUSERS); m.push({ role: 'assistant', content: a1 });
  m.push({ role: 'user', content: 'добавь ещё один карман' });
  const a2 = await chat(sid, m, TROUSERS);
  ok(amount(a1) === 28600 && amount(a2) === 30800, 'addon карман 28600→30800', `${amount(a1)}→${amount(a2)}`);
  const alt = await chat('c' + rid(), [{ role: 'user', content: 'хочу укоротить готовые брюки' }], { route: '/services/alterations/women/trousers', lockBase: true });
  ok(/корректировк|обработка низа|стоит|руб/i.test(alt), 'корректировка работает', alt.slice(0, 40));
}

// 7. АУДИТ-ФИКСЫ (потеря контекста, допущения, размер, детерминизм, роутинг, безопасность)
console.log('7. Аудит-фиксы:');
const welcome = /Здравствуйте! Это ателье/i;
async function drive(sid, turns, ctx) { const m = []; for (const u of turns) { m.push({ role: 'user', content: u }); const r = await chat(sid, m, ctx); m.push({ role: 'assistant', content: r }); } return m[m.length - 1].content; }
{
  // #1 потеря контекста — многоходовый пошив не скатывается в welcome/ремонт
  const r1 = await drive('c1' + rid(), ['хочу брюки', 'новое', 'из шерсти с защипами']);
  ok(!welcome.test(r1) && !/ремонт кармана/i.test(r1), '#1 контекст: брюки→новое→детали не теряется', r1.slice(0, 40));
  const r1b = await drive('c1b' + rid(), ['хочу пальто', 'новое', 'из шерсти', 'до колена', 'с подкладкой', 'размер 50']);
  ok(/руб/i.test(r1b), '#1 пальто 6 ходов доходит до цены', r1b.slice(0, 40));
  // #4 не приписывать пол/карманы
  const r4 = await drive('c4' + rid(), ['хочу мужские брюки', 'новое']);
  ok(!/женск/i.test(r4), '#4 «мужские брюки» не даёт «женские»', r4.slice(0, 40));
  const r4b = await drive('c4b' + rid(), ['хочу брюки', 'новое']);
  ok(!/два кармана|женск/i.test(r4b), '#4 «брюки» не «женские два кармана»', r4b.slice(0, 40));
  // #3 размер только с контекстом
  const r3 = await trousersPrice('из шерсти, два кармана, без подкладки, для мамы на 58 лет');
  ok(amount(r3) !== 34320, '#3 «58 лет» не даёт размер+20%', `got ${amount(r3)}`);
  ok(amount(await trousersPrice('из шерсти, два кармана, без подкладки, размер 58')) === 34320, '#3 «размер 58» реально +20%');
  // #2 детерминизм текстовой цены
  const det = []; for (let i = 0; i < 5; i++) det.push(amount(await trousersPrice('из шёлка, размер 48, с подкладкой')));
  ok(new Set(det).size === 1, '#2 идентичный заказ ×5 → одна цена', det.join('/'));
  // #7 императивы корректировки
  ok(/обработка|корректировк|ушив|стоит/i.test(await drive('c7' + rid(), ['подшейте юбку'])), '#7 «подшейте юбку» → корректировка');
  // H8 нет межсессионной утечки
  await drive('leaktest', ['хочу сшить брюки из шёлка', 'размер 48, с подкладкой']);
  const leak = await chat('leaktest', [{ role: 'user', content: 'на чём остановились?' }]);
  ok(!/шёлк|шелк|подкладк/i.test(leak), 'H8 нет утечки чужой сессии (тот же sessionId)');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(fails.length ? `🐞 ПРОВАЛОВ: ${fails.length} / ${pass + fails.length}\n  ${fails.join('\n  ')}` : `✅ Все проверки пройдены (${pass})`);
console.log('─'.repeat(50));
process.exit(fails.length ? 1 : 0);
