/** Inline feedback banner for server-rendered success/error/info messages. */
export function Banner({
  kind = "info",
  children,
}: {
  kind?: "success" | "error" | "info";
  children: React.ReactNode;
}) {
  return <div className={`banner banner-${kind}`}>{children}</div>;
}
