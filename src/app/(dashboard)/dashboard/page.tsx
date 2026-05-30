import Link from "next/link";
import { getServerCaller } from "@/lib/server-caller";

export default async function DashboardHome() {
  const { caller, ctx } = await getServerCaller();
  if (!ctx.org) {
    return (
      <div className="note">
        Not authenticated. Set <code>x-test-user</code> and <code>x-test-org</code> request
        headers, or wire Clerk keys to enable session login.
      </div>
    );
  }
  const [skus, classifications, declarations] = await Promise.all([
    caller.sku.list({}),
    caller.classification.list({}),
    caller.declaration.list({}),
  ]);
  return (
    <>
      <h1>Overview</h1>
      <p>Org <code>{ctx.org.id}</code>, role <strong>{ctx.org.role}</strong>.</p>
      <ul>
        <li>{skus.items.length} SKUs · <Link href="/skus">manage</Link></li>
        <li>{classifications.items.length} classifications · <Link href="/classifications">view</Link></li>
        <li>{declarations.items.length} declarations · <Link href="/declarations">view</Link></li>
      </ul>
    </>
  );
}
