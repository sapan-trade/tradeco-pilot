export default function Loading() {
  return (
    <div>
      <div className="skeleton skel-line" style={{ width: 200, height: 28 }} />
      <div className="skeleton skel-line" style={{ width: 320 }} />
      <div className="stat-cards" style={{ marginTop: 20 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton skel-card" />
        ))}
      </div>
      <div className="skeleton" style={{ height: 180, marginTop: 24 }} />
    </div>
  );
}
