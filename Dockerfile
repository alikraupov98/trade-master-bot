# Используем Node 18 (более стабильная работа с Atlas TLS)
FROM node:18-slim

WORKDIR /app

# Устанавливаем ffmpeg и сертификаты
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000 3001

CMD sh -c "node src/bootstrap.js & node admin/bootstrap.js"
