# ИСПОЛЬЗУЕМ DEBIAN SLIM, А НЕ ALPINE!
# Это решает проблему SSL alert number 80 с MongoDB Atlas
FROM node:20-slim

WORKDIR /app

# Устанавливаем ffmpeg и необходимые библиотеки через apt-get (для Debian)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates openssl && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Устанавливаем зависимости Node.js
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000 3001

# Запускаем бота и админку через правильные bootstrap файлы
CMD sh -c "node src/bootstrap.js & node admin/bootstrap.js"
