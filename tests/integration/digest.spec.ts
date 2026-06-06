import { describe, it, expect } from "vitest";
import { sendWeeklyDigests } from "@/server/services/digest";
import { seedSampleData } from "@/server/services/sample-data";
import { prisma } from "@/lib/db";

let seq = 0;
async function seedOrgWithOwner() {
  seq++;
  const ts = `${Date.now()}_${seq}`;
  const ownerId = `u_${ts}`;
  const orgId = `org_${ts}`;
  await prisma.user.create({ data: { id: ownerId, email: `${ownerId}@x.local` } });
  await prisma.organization.create({ data: { id: orgId, name: "Acme", country: "US" } });
  await prisma.membership.create({ data: { userId: ownerId, orgId, role: "OWNER" } });
  return { ownerId, orgId };
}

describe("weekly digest", () => {
  it("sends a per-org summary with a tariff alert to each member", async () => {
    const { ownerId, orgId } = await seedOrgWithOwner();
    await seedSampleData(orgId); // 3 classified products incl. HS 6109.*
    await prisma.regulatoryUpdate.create({
      data: {
        source: "federal_register",
        externalId: `reg_${Date.now()}`,
        title: "Tariff change on cotton apparel",
        url: "https://example.gov/x",
        severity: "WARN",
        affectedHs: ["6109"],
        affectedDest: ["US"],
        publishedAt: new Date(),
      },
    });

    const r = await sendWeeklyDigests();
    expect(r.orgsNotified).toBe(1);
    expect(r.usersNotified).toBe(1);

    const notes = await prisma.notification.findMany({ where: { userId: ownerId } });
    expect(notes.length).toBe(1);
    expect(notes[0].type).toBe("GENERAL");
    expect(notes[0].body).toContain("products classified");
    expect(notes[0].body).toContain("regulatory change");
  });

  it("skips orgs with no classifications", async () => {
    await seedOrgWithOwner(); // org exists but has no data
    const r = await sendWeeklyDigests();
    expect(r.orgsNotified).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });
});
