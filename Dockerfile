# Используем Debian Slim (стабильнее для SSL, чем Alpine)
FROM node:20-slim

WORKDIR /app

# 1. Устанавливаем CA-сертификаты и базовые утилиты
# Это КРИТИЧНО для работы с MongoDB Atlas в Docker
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates openssl && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# 2. Устанавливаем зависимости
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000 3001

# 3. Запускаем бота и админку
CMD sh -c "node src/bootstrap.js & node admin/bootstrap.js"
