export default function PolicyEvidence({
  citations
}: {
  citations: Array<{ key: string; snippet?: string; page?: number; chunk_id?: string }>
}) {
  if (!citations || citations.length === 0) {
    return <div style={{ color: "#888" }}>(no evidence extracted)</div>;
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {citations.map((c, idx) => (
        <div key={idx} style={{ padding: 10, border: "1px solid #eee", borderRadius: 8, background: "linear-gradient(180deg,#fafafa,#f5f5f5)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize: 12, color: "#666", marginBottom: 6 }}>
            <span style={{
              display:"inline-block",
              padding:"2px 6px",
              borderRadius:999,
              background:"#e0e7ff",
              color:"#1e3a8a",
              border:"1px solid #c7d2fe",
              fontWeight:600
            }}>{c.key}</span>
            {typeof c.page === "number" && (
              <span style={{ marginLeft: 8, color: "#355" }}>p.{c.page}</span>
            )}
            {c.chunk_id && (
              <span style={{ marginLeft: 6, color: "#7a7a7a" }}>({c.chunk_id})</span>
            )}
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>{c.snippet || "(no snippet)"}</div>
        </div>
      ))}
    </div>
  );
}
