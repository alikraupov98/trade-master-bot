#!/bin/sh
   echo "🚀 Запуск TradeMaster AI..."
   
   # Запускаем бота в фоновом режиме
   echo "▶️ Запускаем бота (npm start)..."
   node src/index.js &
   
   # Запускаем админ-панель (она работает на порту 3000 и держит контейнер живым)
   echo "▶️ Запускаем админ-панель (npm run admin)..."
   node admin/server.js
