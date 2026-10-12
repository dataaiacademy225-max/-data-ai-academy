import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // « server-only » refuse tout import hors serveur React ; les tests tournent dans Node, c'est sans risque.
  "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Une seule base de test partagée : les fichiers s'exécutent l'un après l'autre.
          fileParallelism: false,
        },
      },
    ],
  },
});
