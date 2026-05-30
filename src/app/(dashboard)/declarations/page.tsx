import { revalidatePath } from "next/cache";
import { getServerCaller } from "@/lib/server-caller";
import { StatusPill } from "@/components/StatusPill";

export default async function DeclarationsPage() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) return <div className="note">Not authenticated.</div>;
  const { items } = await caller.declaration.list({});

  async function submit(formData: FormData) {
    "use server";
    const { caller } = await getServerCaller();
    await caller.declaration.submit({ id: String(formData.get("id")) });
    revalidatePath("/declarations");
  }

  return (
    <>
      <h1>Declarations</h1>
      {items.length === 0 ? (
        <div className="empty">No declarations yet.</div>
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
                <td>{d.shipmentRef ?? <code style={{ fontSize: 12 }}>{d.id.slice(0, 8)}</code>}</td>
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
                      <button type="submit">Submit</button>
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
