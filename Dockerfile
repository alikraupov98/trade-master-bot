FROM node:20-bookworm-slim

# ВАЖНО: используем glibc-образ (bookworm-slim), а НЕ alpine — Alpine использует musl libc с
# урезанной сборкой OpenSSL, которая не проходит TLS-рукопожатие с MongoDB Atlas и падает с
# ошибкой "SSL alert number 80 / tlsv1 alert internal error". На Debian-based образах эта
# проблема не воспроизводится.

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads/photos uploads/videos uploads/temp logs

EXPOSE 3000

# ВАЖНО: запускаем через bootstrap.js, а не index.js напрямую — bootstrap сначала подгружает
# настройки, сохранённые через админ-панель (БД), в process.env, и только потом стартует
# основное приложение. Прямой запуск index.js эти настройки просто не увидит.
CMD ["node", "src/bootstrap.js"]
