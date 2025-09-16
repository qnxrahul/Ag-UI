export default function Banner({ children }: { children: any }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "#eef6ff",
      border: "1px solid #cde3ff",
      color: "#0b3d91",
      borderRadius: 8,
      marginTop: 12
    }}>
      {children}
    </div>
  );
}
