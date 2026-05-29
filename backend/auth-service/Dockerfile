FROM node:20-alpine
WORKDIR /app

COPY auth-service/package*.json ./
RUN npm install --include=dev
COPY auth-service/ ./
RUN npx prisma generate
RUN npm run build

RUN npm prune --omit=dev
EXPOSE 4006
CMD ["npm", "run", "start"]
