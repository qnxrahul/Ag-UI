import type { AppState, PatchOp } from "../state/types";

type Widget =
  | { type: "number" | "text" | "date"; label: string; path: string; readOnly?: boolean }
  | { type: "select"; label: string; path: string; options?: string[]; optionsPath?: string }
  | { type: "chips"; label: string; path: string; readOnly?: boolean };

export default function GenericPanel({
  state, config, sendPatch
}: {
  state: AppState;
  config: { title?: string; widgets: Widget[] };
  sendPatch: (ops: PatchOp[]) => Promise<any> | undefined;
}) {
  const get = (p: string) => getAt(state, p);
  const set = (p: string, v: any) => sendPatch([{ op: getAt(state, p) === undefined ? "add" : "replace", path: p, value: v }]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {config.widgets.map((w, idx) => {
        const val = get(w.path);
        if (w.type === "chips") {
          const items: string[] = Array.isArray(val) ? val : [];
          return (
            <Field key={idx} label={w.label}>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {items.length ? items.map(x => <span key={x} style={chip}>{x}</span>) : <span style={{color:"#888"}}>(none)</span>}
              </div>
            </Field>
          );
        }
        if (w.type === "select") {
          const opts = w.optionsPath ? (get(w.optionsPath) || []) : (w.options || []);
          return (
            <Field key={idx} label={w.label}>
              <select disabled={w["readOnly"]} value={val ?? ""} onChange={(e)=>set(w.path, e.target.value || null)} style={inputStyle}>
                <option value="">(none)</option>
                {Array.isArray(opts) && opts.map((o: any) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
              </select>
            </Field>
          );
        }
        if (w.type === "number") {
          return (
            <Field key={idx} label={w.label}>
              <input type="number" value={val ?? ""} onChange={(e)=>set(w.path, e.target.value === "" ? null : Number(e.target.value))} disabled={w["readOnly"]} style={inputStyle}/>
            </Field>
          );
        }
        if (w.type === "date") {
          return (
            <Field key={idx} label={w.label}>
              <input type="date" value={val ?? ""} onChange={(e)=>set(w.path, e.target.value || null)} disabled={w["readOnly"]} style={inputStyle}/>
            </Field>
          );
        }
        return (
          <Field key={idx} label={w.label}>
            <input type="text" value={val ?? ""} onChange={(e)=>set(w.path, e.target.value)} disabled={w["readOnly"]} style={inputStyle}/>
          </Field>
        );
      })}
    </div>
  );
}

function Field(props: { label: string; children: any }) {
  return <label style={{ display:"grid", gap:6, fontSize:14 }}>
    <span style={{ color:"#333" }}>{props.label}</span>
    {props.children}
  </label>;
}

const inputStyle: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, width: "100%" };
const chip: React.CSSProperties = { border:"1px solid #ddd", padding:"4px 8px", borderRadius:999, fontSize:12, background:"#fafafa" };

function getAt(obj: any, pointer: string): any {
  if (!pointer || pointer[0] !== "/") return undefined;
  return pointer.slice(1).split("/").reduce((acc, seg) => (acc == null ? undefined : acc[decode(seg)]), obj);
}
function decode(s: string) { return s.replace(/~1/g, "/").replace(/~0/g, "~"); }
