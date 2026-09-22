FROM node:20-slim
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --legacy-peer-deps
   COPY . .
   
   # Даем права на запуск нашего скрипта
   RUN chmod +x start.sh
   
   EXPOSE 3000 3001
   
   # Запускаем наш скрипт вместо одной команды
   CMD ["./start.sh"]
