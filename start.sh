#!/bin/bash

echo "Настройка Limitless Atelier..."
echo ""

# ── 2. npm install ────────────────────────────────────
echo ""
echo "Устанавливаем npm зависимости..."
npm install
echo "npm зависимости установлены"

# ── 3. PM2 ───────────────────────────────────────────
echo ""
echo "Устанавливаем PM2..."

if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
  echo "PM2 установлен"
else
  echo "PM2 уже установлен"
fi

# ── 4. Запускаем через PM2 ────────────────────────────
echo ""
echo "Запускаем сервер через PM2..."
pm2 delete atelier 2>/dev/null || true
pm2 start server.js --name atelier
pm2 save

# ── 5. Автозапуск ─────────────────────────────────────
echo ""
echo "Настройка автозапуска PM2..."
echo ""
echo "ВАЖНО: скопируй и выполни от root следующую команду:"
echo ""
pm2 startup | grep "sudo"
echo ""
echo "──────────────────────────────────────────────────"
echo "Установка завершена!"
echo ""
echo "Полезные команды:"
echo "  pm2 status          — статус сервера"
echo "  pm2 logs atelier    — логи"
echo "  pm2 restart atelier — перезапуск"
echo "──────────────────────────────────────────────────"
