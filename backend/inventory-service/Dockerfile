# ====== Stage 1: Build ======
FROM node:20-alpine AS builder
WORKDIR /app

COPY shared/package*.json ./shared/
RUN cd shared && npm install
COPY shared/ ./shared/
RUN cd shared && npm run build

COPY inventory-service/package*.json ./inventory-service/
RUN cd inventory-service && npm install
COPY inventory-service/prisma ./inventory-service/prisma
RUN cd inventory-service && npx prisma generate
COPY inventory-service/ ./inventory-service/
RUN cd inventory-service && npx tsc

# --- Production deps only ---
RUN cp -r /app/inventory-service/node_modules/.prisma /tmp/.prisma && \
    cd inventory-service && \
    node -e "const p=require('./package.json');delete p.dependencies['@ecommerce/shared'];require('fs').writeFileSync('package.json',JSON.stringify(p))" && \
    rm -rf node_modules && \
    npm install --omit=dev --ignore-scripts && \
    rm -rf node_modules/prisma node_modules/typescript node_modules/effect \
           node_modules/fast-check node_modules/@types node_modules/ts-node \
           node_modules/ts-node-dev node_modules/pure-rand node_modules/jiti \
           node_modules/@prisma/engines node_modules/@prisma/fetch-engine \
           node_modules/@prisma/get-platform node_modules/@prisma/engines-version \
           node_modules/@prisma/client/generator-build \
           node_modules/@prisma/client/scripts && \
    cd node_modules/@prisma/client/runtime && \
    rm -f *.map edge* index-browser* react-native* wasm-*-edge* && \
    rm -f query_*_bg.cockroachdb.* query_*_bg.mysql.* \
          query_*_bg.sqlite.* query_*_bg.sqlserver.* && \
    cd /app/inventory-service && \
    mkdir -p node_modules/@ecommerce/shared && \
    cp -r /app/shared/dist node_modules/@ecommerce/shared/dist && \
    cp /app/shared/package.json node_modules/@ecommerce/shared/package.json && \
    cp -r /tmp/.prisma node_modules/.prisma

# ====== Stage 2: Production ======
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/inventory-service/dist ./dist
COPY --from=builder /app/inventory-service/node_modules ./node_modules

EXPOSE 4003
CMD ["node", "dist/index.js"]
