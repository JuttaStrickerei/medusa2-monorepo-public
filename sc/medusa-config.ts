import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "./src/modules/sendcloud",
            id: "sendcloud",
            options: {
              public_key: process.env.SENDCLOUD_PUBLIC_KEY,
              secret_key: process.env.SENDCLOUD_SECRET_KEY
            }
          },
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          }
        ],
      },
    },
  ],
})
