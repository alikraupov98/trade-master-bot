# Используем ту же версию Node.js, что и локально (v26)
FROM node:26-slim

WORKDIR /app

# Копируем зависимости
COPY package*.json ./

# Устанавливаем пакеты
RUN npm install --legacy-peer-deps

# Копируем весь код
COPY . .

EXPOSE 3000 3001

# Запускаем бота и админку через правильные файлы bootstrap.js
CMD sh -c "node src/bootstrap.js & node admin/bootstrap.js"
