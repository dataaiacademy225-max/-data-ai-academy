import { describe, expect, it } from "vitest";
import { createProject, deleteProject, getProject, listProjects } from "@/server/services/projects";
import { createUser, projectInput } from "./factories";

describe("service projets", () => {
  it("crée toujours un projet réel, avec la date d'attestation", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput({ competitors: [{ name: "A" }] }));
    expect(project.isDemo).toBe(false);
    expect(project.ownershipAttestedAt).toBeInstanceOf(Date);
    expect(project.competitors).toEqual([{ name: "A" }]);
  });

  it("isole les projets entre utilisateurs", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceProject = await createProject(alice.id, projectInput({ companyName: "Projet d'Alice" }));

    expect(await listProjects(bob.id)).toEqual([]);
    expect(await getProject(bob.id, aliceProject.id)).toBeNull();
    expect(await deleteProject(bob.id, aliceProject.id)).toBe(false);

    // Le projet d'Alice est intact.
    expect(await getProject(alice.id, aliceProject.id)).not.toBeNull();
    expect((await listProjects(alice.id)).map((p) => p.companyName)).toEqual(["Projet d'Alice"]);
  });

  it("le propriétaire peut supprimer son projet", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput());
    expect(await deleteProject(user.id, project.id)).toBe(true);
    expect(await getProject(user.id, project.id)).toBeNull();
  });

  it("liste les projets réels avant les projets de démonstration", async () => {
    const user = await createUser();
    const { prisma } = await import("@/lib/db");
    await prisma.project.create({
      data: { ...projectInput({ companyName: "Démo" }), userId: user.id, isDemo: true, ownershipAttestedAt: new Date() },
    });
    await createProject(user.id, projectInput({ companyName: "Réel" }));
    expect((await listProjects(user.id)).map((p) => p.companyName)).toEqual(["Réel", "Démo"]);
  });
});
