# Используем Node 18 Slim для стабильной работы SSL с Atlas
FROM node:18-slim

WORKDIR /app

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
