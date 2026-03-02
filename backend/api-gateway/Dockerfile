# ====== Stage 1: Build ======
FROM node:20-alpine AS builder
WORKDIR /app

COPY shared/package*.json ./shared/
RUN cd shared && npm install
COPY shared/ ./shared/
RUN cd shared && npm run build

COPY api-gateway/package*.json ./api-gateway/
RUN cd api-gateway && npm install
COPY api-gateway/ ./api-gateway/
RUN cd api-gateway && npx tsc

# --- Production deps only ---
RUN cd api-gateway && \
    node -e "const p=require('./package.json');delete p.dependencies['@ecommerce/shared'];require('fs').writeFileSync('package.json',JSON.stringify(p))" && \
    rm -rf node_modules && \
    npm install --omit=dev --ignore-scripts && \
    rm -rf node_modules/typescript node_modules/@types node_modules/ts-node \
           node_modules/ts-node-dev && \
    mkdir -p node_modules/@ecommerce/shared && \
    cp -r /app/shared/dist node_modules/@ecommerce/shared/dist && \
    cp /app/shared/package.json node_modules/@ecommerce/shared/package.json

# ====== Stage 2: Production ======
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/api-gateway/dist ./dist
COPY --from=builder /app/api-gateway/node_modules ./node_modules

EXPOSE 4000
CMD ["node", "dist/index.js"]
