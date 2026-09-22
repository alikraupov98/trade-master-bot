FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 3000 3001

# Запускаем бота в фоне (&), а админку на переднем плане
CMD sh -c "node src/bootstrap.js & node admin/bootstrap.js"
