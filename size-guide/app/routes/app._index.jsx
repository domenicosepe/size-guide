import { useState, useMemo, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";

const NAMESPACE = "$app:size_guide";
const KEY = "config";

const DEFAULT_CONFIG = {
  theme: {
    accent: "#111111",
    accentText: "#ffffff",
    bg: "#ffffff",
    text: "#1a1a1a",
    head: "#f3f3f3",
    radius: 10,
    font: "inherit",
  },
  features: {
    calculator: true,
    units: true,
    photo: true,
    addToCart: true,
    showRecommendation: true,
    highlight: true,
  },
  tables: [
    {
      id: "default",
      name: "Uomo – Magliette",
      rules: { all: true, collections: [], tags: [], productIds: [] },
      columns: [
        { key: "height", label: "Altezza", unit: "cm" },
        { key: "weight", label: "Peso", unit: "kg" },
        { key: "waist", label: "Vita", unit: "cm" },
        { key: "chest", label: "Torace", unit: "cm" },
      ],
      rows: [
        { size: "S", height: "165-172", weight: "60-70", waist: "78-84", chest: "88-92" },
        { size: "M", height: "171-176", weight: "70-76", waist: "84-88", chest: "92-98" },
        { size: "L", height: "176-182", weight: "76-82", waist: "88-94", chest: "98-104" },
        { size: "XL", height: "181-186", weight: "82-88", waist: "94-100", chest: "104-110" },
      ],
    },
  ],
};

const FEATURE_LABELS = {
  calculator: "Calcolatore taglia",
  units: "Conversione cm / pollici",
  photo: "Foto prodotto nella finestra",
  addToCart: "Aggiungi al carrello con la taglia scelta",
  showRecommendation: "Mostra la taglia consigliata sulla pagina prodotto",
  highlight: "Evidenzia la taglia consigliata in tabella",
};

const FONTS = [
  ["inherit", "Eredita dal tema"],
  ["Inter, system-ui, sans-serif", "Inter / Sans"],
  ["Georgia, serif", "Georgia (elegante)"],
  ["'Courier New', monospace", "Mono"],
];

function mergeConfig(saved) {
  if (!saved) return structuredClone(DEFAULT_CONFIG);
  return {
    theme: { ...DEFAULT_CONFIG.theme, ...saved.theme },
    features: { ...DEFAULT_CONFIG.features, ...saved.features },
    tables: saved.tables?.length ? saved.tables : structuredClone(DEFAULT_CONFIG.tables),
  };
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const res = await admin.graphql(
    `#graphql
    query SizeGuideConfig($ns: String!, $key: String!) {
      currentAppInstallation {
        id
        metafield(namespace: $ns, key: $key) { value }
      }
    }`,
    { variables: { ns: NAMESPACE, key: KEY } },
  );
  const json = await res.json();
  const raw = json.data?.currentAppInstallation?.metafield?.value;
  let saved = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  return { config: mergeConfig(saved) };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const value = String(form.get("config") || "");
  try {
    JSON.parse(value);
  } catch {
    return { ok: false, error: "Configurazione non valida." };
  }

  const idRes = await admin.graphql(`#graphql
    query { currentAppInstallation { id } }`);
  const installationId = (await idRes.json()).data.currentAppInstallation.id;

  const res = await admin.graphql(
    `#graphql
    mutation SaveSizeGuide($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          { ownerId: installationId, namespace: NAMESPACE, key: KEY, type: "json", value },
        ],
      },
    },
  );
  const out = await res.json();
  const errs = out.data?.metafieldsSet?.userErrors;
  if (errs?.length) return { ok: false, error: errs.map((e) => e.message).join(", ") };
  return { ok: true };
};

const css = `
.sg-admin{font-family:Inter,system-ui,sans-serif;color:#1a1a1a;max-width:1200px;margin:0 auto;padding:20px 16px 60px}
.sg-admin *{box-sizing:border-box}
.sg-admin h1{font-size:22px;margin:0}
.sg-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;flex-wrap:wrap}
.sg-grid{display:grid;grid-template-columns:340px 1fr;gap:20px;align-items:start}
.sg-card{background:#fff;border:1px solid #e3e3e3;border-radius:12px;padding:18px;margin-bottom:16px}
.sg-card h2{font-size:15px;margin:0 0 14px}
.sg-fld{margin-bottom:12px}
.sg-fld label{display:block;font-size:12px;color:#666;margin-bottom:5px}
.sg-fld input[type=text],.sg-fld select,.sg-fld textarea{width:100%;padding:9px 10px;border:1px solid #ccc;border-radius:7px;font-size:14px;font-family:inherit}
.sg-fld input[type=color]{width:100%;height:36px;border:1px solid #ccc;border-radius:7px;padding:2px;background:#fff}
.sg-fld input[type=range]{width:100%}
.sg-tg{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:14px;gap:10px}
.sg-btn{padding:9px 14px;border:1px solid #ccc;background:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit}
.sg-btn.p{background:#111;color:#fff;border-color:#111}
.sg-btn.d{color:#b3261e;border-color:#e6b8b5}
.sg-btn:disabled{opacity:.5;cursor:default}
.sg-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.sg-tabs button{padding:7px 14px;border:1px solid #ccc;background:#fff;border-radius:20px;cursor:pointer;font-size:13px;font-family:inherit}
.sg-tabs button.on{background:#111;color:#fff;border-color:#111}
.sg-tbl{width:100%;border-collapse:collapse;font-size:13px}
.sg-tbl th,.sg-tbl td{border:1px solid #e3e3e3;padding:4px}
.sg-tbl th{background:#fafafa;font-weight:600;padding:6px}
.sg-tbl input{width:100%;border:1px solid #ddd;border-radius:5px;padding:6px;font-size:13px;text-align:center;font-family:inherit}
.sg-tbl .sg-x{border:none;background:none;cursor:pointer;color:#b3261e;font-size:16px}
.sg-note{font-size:12px;color:#777;margin:8px 0 0}
.sg-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sg-ok{color:#1a7f37;font-size:13px}.sg-err{color:#b3261e;font-size:13px}
.sg-prev{border-radius:12px;padding:20px;background:repeating-conic-gradient(#eee 0 25%,#f7f7f7 0 50%) 0 0/20px 20px}
.sg-pm{background:var(--bg);color:var(--text);font-family:var(--font);border-radius:calc(var(--radius) + 6px);box-shadow:0 8px 30px rgba(0,0,0,.15);padding:18px;max-width:560px;margin:0 auto}
.sg-pm table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid rgba(0,0,0,.12);border-radius:var(--radius);overflow:hidden;font-size:13px}
.sg-pm th{background:var(--head);padding:9px 6px;font-size:11px;text-transform:uppercase;text-align:center}
.sg-pm td{padding:10px 6px;text-align:center;border-top:1px solid rgba(0,0,0,.08)}
.sg-pm td:first-child{font-weight:700}
.sg-pm .pills{display:flex;gap:8px;margin:14px 0 10px}
.sg-pm .pills span{min-width:46px;text-align:center;padding:8px 12px;border:1.5px solid rgba(0,0,0,.2);border-radius:var(--radius);font-size:13px}
.sg-pm .pills span.on{background:var(--accent);color:var(--accent-text);border-color:var(--accent)}
.sg-pm .cta{width:100%;text-align:center;padding:11px;background:var(--accent);color:var(--accent-text);border-radius:var(--radius);font-size:14px}
@media(max-width:900px){.sg-grid{grid-template-columns:1fr}}
`;

const csv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function Index() {
  const { config: initial } = useLoaderData();
  const fetcher = useFetcher();
  const [cfg, setCfg] = useState(initial);
  const [ti, setTi] = useState(0);
  const [dirty, setDirty] = useState(false);

  const saving = fetcher.state !== "idle";
  const result = fetcher.data;

  useEffect(() => {
    if (result?.ok) setDirty(false);
  }, [result]);

  const update = (fn) => {
    setCfg((c) => {
      const n = structuredClone(c);
      fn(n);
      return n;
    });
    setDirty(true);
  };

  const table = cfg.tables[Math.min(ti, cfg.tables.length - 1)];
  const tIdx = Math.min(ti, cfg.tables.length - 1);

  const save = () => {
    fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  };

  const addTable = () => {
    update((n) => {
      n.tables.push({
        id: "t" + Math.random().toString(36).slice(2, 8),
        name: "Nuova tabella",
        rules: { all: false, collections: [], tags: [], productIds: [] },
        columns: [
          { key: "height", label: "Altezza", unit: "cm" },
          { key: "weight", label: "Peso", unit: "kg" },
        ],
        rows: [{ size: "S", height: "", weight: "" }],
      });
    });
    setTi(cfg.tables.length);
  };

  const delTable = () => {
    if (cfg.tables.length < 2) return;
    update((n) => n.tables.splice(tIdx, 1));
    setTi(0);
  };

  const addColumn = () =>
    update((n) => {
      const k = "col_" + Math.random().toString(36).slice(2, 6);
      n.tables[tIdx].columns.push({ key: k, label: "Nuova colonna", unit: "cm" });
      n.tables[tIdx].rows.forEach((r) => (r[k] = ""));
    });

  const delColumn = (ci) =>
    update((n) => {
      const [c] = n.tables[tIdx].columns.splice(ci, 1);
      n.tables[tIdx].rows.forEach((r) => delete r[c.key]);
    });

  const addRow = () =>
    update((n) => {
      const row = { size: "" };
      n.tables[tIdx].columns.forEach((c) => (row[c.key] = ""));
      n.tables[tIdx].rows.push(row);
    });

  const themeVars = useMemo(
    () => ({
      "--accent": cfg.theme.accent,
      "--accent-text": cfg.theme.accentText,
      "--bg": cfg.theme.bg,
      "--text": cfg.theme.text,
      "--head": cfg.theme.head,
      "--radius": cfg.theme.radius + "px",
      "--font": cfg.theme.font,
    }),
    [cfg.theme],
  );

  const T = cfg.theme;

  return (
    <div className="sg-admin">
      <style>{css}</style>
      <div className="sg-top">
        <h1>📐 Guida Taglie</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {result?.ok && !dirty && <span className="sg-ok">✓ Salvato</span>}
          {result && !result.ok && <span className="sg-err">{result.error}</span>}
          {dirty && <span style={{ fontSize: 13, color: "#777" }}>Modifiche non salvate</span>}
          <button className="sg-btn p" onClick={save} disabled={saving || !dirty}>
            {saving ? "Salvo…" : "Salva"}
          </button>
        </div>
      </div>

      <div className="sg-grid">
        <div>
          <div className="sg-card">
            <h2>🎨 Aspetto</h2>
            {[
              ["accent", "Colore principale"],
              ["accentText", "Testo sui pulsanti"],
              ["bg", "Sfondo finestra"],
              ["text", "Colore testo"],
              ["head", "Intestazione tabella"],
            ].map(([k, l]) => (
              <div className="sg-fld" key={k}>
                <label>{l}</label>
                <input type="color" value={T[k]} onChange={(e) => update((n) => (n.theme[k] = e.target.value))} />
              </div>
            ))}
            <div className="sg-fld">
              <label>Arrotondamento angoli: {T.radius}px</label>
              <input type="range" min="0" max="24" value={T.radius} onChange={(e) => update((n) => (n.theme.radius = +e.target.value))} />
            </div>
            <div className="sg-fld">
              <label>Font</label>
              <select value={T.font} onChange={(e) => update((n) => (n.theme.font = e.target.value))}>
                {FONTS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sg-card">
            <h2>⚙️ Funzioni</h2>
            {Object.keys(FEATURE_LABELS).map((k) => (
              <div className="sg-tg" key={k}>
                <span>{FEATURE_LABELS[k]}</span>
                <input type="checkbox" checked={!!cfg.features[k]} onChange={(e) => update((n) => (n.features[k] = e.target.checked))} />
              </div>
            ))}
            <p className="sg-note">Testo e stile del pulsante in pagina prodotto si cambiano dal theme editor, nelle impostazioni del blocco "Guida Taglie".</p>
          </div>
        </div>

        <div>
          <div className="sg-card">
            <h2>📋 Tabelle taglie</h2>
            <div className="sg-tabs">
              {cfg.tables.map((t, i) => (
                <button key={t.id} className={i === tIdx ? "on" : ""} onClick={() => setTi(i)}>{t.name || "Senza nome"}</button>
              ))}
              <button onClick={addTable}>+ Nuova tabella</button>
            </div>

            <div className="sg-fld">
              <label>Nome tabella</label>
              <input type="text" value={table.name} onChange={(e) => update((n) => (n.tables[tIdx].name = e.target.value))} />
            </div>

            <div className="sg-tg">
              <span>Usa questa tabella per tutti i prodotti</span>
              <input type="checkbox" checked={!!table.rules.all} onChange={(e) => update((n) => (n.tables[tIdx].rules.all = e.target.checked))} />
            </div>
            {!table.rules.all && (
              <div className="sg-row2">
                <div className="sg-fld">
                  <label>Collezioni (handle, separati da virgola)</label>
                  <input type="text" value={(table.rules.collections || []).join(", ")} onChange={(e) => update((n) => (n.tables[tIdx].rules.collections = csv(e.target.value)))} placeholder="maglie, polo" />
                </div>
                <div className="sg-fld">
                  <label>Tag prodotto (separati da virgola)</label>
                  <input type="text" value={(table.rules.tags || []).join(", ")} onChange={(e) => update((n) => (n.tables[tIdx].rules.tags = csv(e.target.value)))} placeholder="tshirt-uomo" />
                </div>
              </div>
            )}
            <p className="sg-note">Se un prodotto corrisponde a più tabelle vince la prima in elenco. La tabella "per tutti i prodotti" fa da ripiego.</p>

            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table className="sg-tbl">
                <thead>
                  <tr>
                    <th>Taglia</th>
                    {table.columns.map((c, ci) => (
                      <th key={c.key}>
                        <input value={c.label} onChange={(e) => update((n) => (n.tables[tIdx].columns[ci].label = e.target.value))} />
                        <select value={c.unit} onChange={(e) => update((n) => (n.tables[tIdx].columns[ci].unit = e.target.value))} style={{ width: "100%", marginTop: 4, fontSize: 12 }}>
                          <option value="cm">cm</option>
                          <option value="kg">kg</option>
                          <option value="">nessuna</option>
                        </select>
                        <button className="sg-x" onClick={() => delColumn(ci)} title="Elimina colonna">×</button>
                      </th>
                    ))}
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r, ri) => (
                    <tr key={ri}>
                      <td><input value={r.size} onChange={(e) => update((n) => (n.tables[tIdx].rows[ri].size = e.target.value))} /></td>
                      {table.columns.map((c) => (
                        <td key={c.key}>
                          <input value={r[c.key] ?? ""} placeholder="es. 165-172" onChange={(e) => update((n) => (n.tables[tIdx].rows[ri][c.key] = e.target.value))} />
                        </td>
                      ))}
                      <td><button className="sg-x" onClick={() => update((n) => n.tables[tIdx].rows.splice(ri, 1))} title="Elimina riga">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="sg-btn" onClick={addRow}>+ Riga</button>
              <button className="sg-btn" onClick={addColumn}>+ Colonna</button>
              {cfg.tables.length > 1 && <button className="sg-btn d" onClick={delTable}>Elimina tabella</button>}
            </div>
            <p className="sg-note">Scrivi gli intervalli come "165-172". Il calcolatore usa le colonne Altezza e Peso, quindi non rinominare le prime due chiavi: puoi cambiare liberamente le etichette.</p>
          </div>

          <div className="sg-card">
            <h2>👁 Anteprima</h2>
            <div className="sg-prev">
              <div className="sg-pm" style={themeVars}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>Nome prodotto</div>
                <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 12 }}>Guida alle taglie</div>
                <table>
                  <thead>
                    <tr>
                      <th>Taglia</th>
                      {table.columns.map((c) => (
                        <th key={c.key}>{c.label}{c.unit ? ` (${c.unit})` : ""}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.size}</td>
                        {table.columns.map((c) => (
                          <td key={c.key}>{r[c.key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cfg.features.addToCart && (
                  <>
                    <div className="pills">
                      {table.rows.slice(0, 5).map((r, i) => (
                        <span key={i} className={i === 2 ? "on" : ""}>{r.size || "—"}</span>
                      ))}
                    </div>
                    <div className="cta">Aggiungi al carrello · Taglia {table.rows[2]?.size || table.rows[0]?.size}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
