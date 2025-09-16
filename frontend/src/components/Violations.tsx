export default function Violations({ violations }: { violations: Array<{ code: string; message: string; path?: string }> }) {
  if (!violations || violations.length === 0) return <div style={{ color: "#888" }}>(none)</div>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {violations.map((v, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>{v.code}:</span> {v.message}
          {v.path ? <span style={{ color: "#777" }}> — <code>{v.path}</code></span> : null}
        </li>
      ))}
    </ul>
  );
}
