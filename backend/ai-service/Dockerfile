# ====== Stage 1: Build ======
FROM node:20-alpine AS builder
WORKDIR /app

COPY shared/package*.json ./shared/
RUN cd shared && npm install
COPY shared/ ./shared/
RUN cd shared && npm run build

COPY ai-service/package*.json ./ai-service/
RUN cd ai-service && npm install
COPY ai-service/ ./ai-service/
RUN cd ai-service && npx tsc

# --- Production deps only ---
RUN cd ai-service && \
    node -e "const p=require('./package.json');delete p.dependencies['@ecommerce/shared'];require('fs').writeFileSync('package.json',JSON.stringify(p))" && \
    rm -rf node_modules && \
    npm install --omit=dev --ignore-scripts && \
    cd /app/ai-service && \
    mkdir -p node_modules/@ecommerce/shared && \
    cp -r /app/shared/dist node_modules/@ecommerce/shared/dist && \
    cp /app/shared/package.json node_modules/@ecommerce/shared/package.json

# ====== Stage 2: Production ======
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/ai-service/dist ./dist
COPY --from=builder /app/ai-service/node_modules ./node_modules

EXPOSE 4007
CMD ["node", "dist/index.js"]
