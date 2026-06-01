FROM node:20-alpine
WORKDIR /app

COPY auth-service/package*.json ./
RUN set -eux \
	&& npm config set fetch-retries 5 \
	&& npm config set fetch-retry-factor 10 \
	&& npm config set fetch-retry-mintimeout 20000 \
	&& npm config set fetch-retry-maxtimeout 120000 \
	&& npm config set registry "https://registry.npmjs.org/" \
	&& for i in 1 2 3 4 5; do \
		npm install --include=dev && break || (echo "npm install failed, retrying ($i)..." && sleep 5); \
	done
COPY auth-service/ ./
RUN npx prisma generate
RUN npm run build

RUN npm prune --omit=dev
EXPOSE 4006
CMD ["npm", "run", "start"]
