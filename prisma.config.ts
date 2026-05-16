import { defineConfig } from 'prisma/config'

export default defineConfig({
  migrations: {
    seed: 'node ./dist/prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:/app/data/dev.db',
  },
})
