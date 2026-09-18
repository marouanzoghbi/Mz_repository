import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .length(64, "CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"),

  EWELINK_APP_ID: z.string().default(""),
  EWELINK_APP_SECRET: z.string().default(""),
  EWELINK_REGION: z.enum(["us", "eu", "as", "cn"]).default("us"),
  EWELINK_REDIRECT_URI: z.string().default(""),

  DEYE_APP_ID: z.string().default(""),
  DEYE_APP_SECRET: z.string().default(""),
  DEYE_BASE_URL: z.string().default("https://eu1-developer.deyecloud.com"),
  DEYE_REDIRECT_URI: z.string().default(""),

  AUTOMATION_POLL_INTERVAL_MS: z.coerce.number().default(60000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. Check apps/api/.env against .env.example.");
}

export const env = parsed.data;
