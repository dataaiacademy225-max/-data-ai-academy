import "dotenv/config";

/** URL de la base de test, avec garde-fous pour ne jamais vider une base réelle. */
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL manquante (voir .env.example).");
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL doit être différente de DATABASE_URL.");
  }
  const dbName = new URL(url).pathname.slice(1);
  if (!/test/i.test(dbName)) {
    throw new Error(`Le nom de la base de test doit contenir « test » (reçu : ${dbName}).`);
  }
  return url;
}
