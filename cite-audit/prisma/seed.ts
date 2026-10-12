import "dotenv/config";
import { prisma } from "@/lib/db";
import { signUpDemoUser } from "@/server/demo/demo-sign-up";
import { DEMO_EMAIL, seedDemo } from "@/server/demo/seed-demo";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Seed de démonstration refusé en production (définir ALLOW_DEMO_SEED=true pour forcer).");
  }
  const password = process.env.DEMO_PASSWORD ?? "";
  if (password.length < 10) {
    throw new Error("Définissez DEMO_PASSWORD (10 caractères minimum) dans .env.");
  }

  await seedDemo(prisma, signUpDemoUser, password);
  console.log(`Données de démonstration créées. Connexion : ${DEMO_EMAIL} (mot de passe : DEMO_PASSWORD).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Échec du seed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
