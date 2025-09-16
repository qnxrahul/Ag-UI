export default function Chips({ items }: { items: string[] }) {
  if (!items || !items.length) return <div style={{ color: "#888" }}>(none)</div>;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map((x) => (
        <span key={x} style={{
          border: "1px solid #ddd", padding: "4px 8px", borderRadius: 999, fontSize: 12, background: "#fafafa"
        }}>
          {x}
        </span>
      ))}
    </div>
  );
}
