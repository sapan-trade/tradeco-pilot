import { auth } from "@clerk/nextjs/server";
import { Landing } from "@/components/Landing";

export default async function Home() {
  const session = await auth().catch(() => ({ userId: null as string | null }));
  return <Landing signedIn={!!session.userId} />;
}
