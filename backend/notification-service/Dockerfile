# ====== Stage 1: Build ======
FROM node:20-alpine AS builder
WORKDIR /app

COPY shared/package*.json ./shared/
RUN cd shared && npm install
COPY shared/ ./shared/
RUN cd shared && npm run build

COPY notification-service/package*.json ./notification-service/
RUN cd notification-service && npm install
COPY notification-service/prisma ./notification-service/prisma
RUN cd notification-service && npx prisma generate
COPY notification-service/ ./notification-service/
RUN cd notification-service && npx tsc

# --- Production deps only ---
RUN cp -r /app/notification-service/node_modules/.prisma /tmp/.prisma && \
    cd notification-service && \
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
    cd /app/notification-service && \
    mkdir -p node_modules/@ecommerce/shared && \
    cp -r /app/shared/dist node_modules/@ecommerce/shared/dist && \
    cp /app/shared/package.json node_modules/@ecommerce/shared/package.json && \
    cp -r /tmp/.prisma node_modules/.prisma

# ====== Stage 2: Production ======
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/notification-service/dist ./dist
COPY --from=builder /app/notification-service/node_modules ./node_modules

EXPOSE 4005
CMD ["node", "dist/index.js"]
