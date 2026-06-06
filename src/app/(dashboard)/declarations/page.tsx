import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";
import { SubmitButton } from "@/components/SubmitButton";
import { Banner } from "@/components/Banner";

export default async function DeclarationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  const { items } = await caller.declaration.list({});
  const sp = await searchParams;

  async function submit(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    try {
      await caller.declaration.submit({ id: String(formData.get("id")) });
    } catch {
      redirect("/declarations?error=submit");
    }
    revalidatePath("/declarations");
    redirect("/declarations?ok=submitted");
  }

  return (
    <>
      <h1>Declarations</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
        A declaration is a draft customs filing with its landed-cost breakdown. Submitting files it
        and uses one credit on your plan.
      </p>

      {sp.ok === "drafted" && <Banner kind="success">Draft declaration created. Review it below, then Submit when ready.</Banner>}
      {sp.ok === "submitted" && <Banner kind="success">Declaration submitted.</Banner>}
      {sp.error === "submit" && <Banner kind="error">Couldn&apos;t submit — please retry.</Banner>}

      {items.length === 0 ? (
        <div className="empty">
          No declarations yet. Go to <Link href="/classifications">Classifications</Link> and click
          <strong> Draft declaration</strong> on a classified product.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Dest</th>
              <th>Status</th>
              <th>Total duty</th>
              <th>Submitted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td><Link href={`/declarations/${d.id}`}>{d.shipmentRef ?? <code style={{ fontSize: 12 }}>{d.id.slice(0, 8)}</code>}</Link></td>
                <td>{d.destination}</td>
                <td><StatusPill status={d.status} /></td>
                <td>{d.totalDutyCents != null ? `$${(d.totalDutyCents / 100).toFixed(2)}` : "—"}</td>
                <td style={{ fontSize: 12, color: "#6b7280" }}>
                  {d.submittedAt ? new Date(d.submittedAt).toLocaleString() : "—"}
                </td>
                <td>
                  {d.status === "DRAFT" && (
                    <form action={submit} className="inline">
                      <input type="hidden" name="id" value={d.id} />
                      <SubmitButton pendingText="Submitting…" confirm="Submit this declaration? This files it and uses one credit.">
                        Submit
                      </SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
