FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV DATABASE_URL=file:/app/data/dev.db

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

RUN npx prisma generate

COPY src ./src/
RUN npm run build

COPY certs ./certs/

RUN mkdir -p /app/data

EXPOSE 3005

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/index.js"]
