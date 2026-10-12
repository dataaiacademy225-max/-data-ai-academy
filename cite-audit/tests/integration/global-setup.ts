import { execFileSync } from "node:child_process";
import { getTestDatabaseUrl } from "./test-db";

/** Applique les migrations sur la base de test avant tous les tests d'intégration. */
export default function setup() {
  const url = getTestDatabaseUrl();
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
