import { useState, useRef, useEffect, useCallback } from "react";

const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
const KATEX_JS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
const H2I_JS = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js";
const loadScript = (src: string): Promise<void> => {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      res();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => res();
    script.onerror = () => rej(new Error(`Error script: ${src}`));
    document.head.appendChild(script);
  });
};

const loadCSS = (href: string): Promise<void> => {
  return new Promise((res, rej) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      res();
      return;
    }
    const link = document.createElement("link");
    link.href = href;
    link.rel = "stylesheet";
    link.onload = () => res();
    link.onerror = () => rej(new Error(`Error CSS: ${href}`));
    document.head.appendChild(link);
  });
};

const C_OPTIONS = [10, 100, 1000, 10000];
const fmt = n => n >= 1000 ? n.toLocaleString("es-PE") : String(n);

const INDICATORS = [
  {
    id: "porcentaje", label: "Porcentaje",
    defaults: { num: "\\text{Numerador}", den: "\\text{Denominador}" },
    fields: [{ key: "num", label: "Numerador" }, { key: "den", label: "Denominador" }],
    tex: v => `\\text{Porcentaje} = \\left[\\dfrac{${v.num}}{${v.den}}\\right] \\times 100`,
  },
  {
    id: "ratio", label: "Ratio",
    defaults: { num: "\\text{Numerador}", den: "\\text{Denominador}" },
    fields: [{ key: "num", label: "Numerador" }, { key: "den", label: "Denominador" }],
    tex: v => `\\text{Ratio} = \\left[\\dfrac{${v.num}}{${v.den}}\\right]`,
  },
  {
    id: "tasa", label: "Tasa",
    defaults: { num: "\\text{Numerador}", den: "\\text{Denominador}" },
    fields: [{ key: "num", label: "Numerador" }, { key: "den", label: "Denominador" }],
    hasC: true,
    tex: (v, c) => `\\text{Tasa} = \\left[\\dfrac{${v.num}}{${v.den}}\\right] \\times ${fmt(c)}`,
  },
  {
    id: "tasa_var", label: "Tasa de Variación",
    defaults: { Vt1: "V_{t_1}", Vt0: "V_{t_0}", t1: "t_1", t0: "t_0" },
    fields: [
      { key: "Vt1", label: "Valor período final (Vt₁)" },
      { key: "Vt0", label: "Valor período base (Vt₀)" },
      { key: "t1",  label: "Período final (t₁)" },
      { key: "t0",  label: "Período base (t₀)" },
    ],
    tex: v => `\\Delta\\% = \\left[\\left(\\dfrac{${v.Vt1}}{${v.Vt0}}\\right)^{\\!\\left(\\frac{1}{${v.t1}-${v.t0}}\\right)} - 1\\right] \\times 100`,
  },
  {
    id: "prom_simple", label: "Promedio Simple",
    defaults: { V: "V_i", n: "n" },
    fields: [{ key: "V", label: "Valor observado (Vᵢ)" }, { key: "n", label: "Nº observaciones (n)" }],
    tex: v => `\\bar{x} = \\dfrac{\\displaystyle\\sum_{i=1}^{${v.n}} ${v.V}}{${v.n}}`,
  },
  {
    id: "prom_pond", label: "Promedio Ponderado",
    defaults: { V: "V_i", w: "w_i" },
    fields: [{ key: "V", label: "Valor observado (Vᵢ)" }, { key: "w", label: "Peso / ponderación (wᵢ)" }],
    tex: v => `\\bar{x}_w = \\dfrac{\\displaystyle\\sum (${v.V} \\cdot ${v.w})}{\\displaystyle\\sum ${v.w}}`,
  },
  {
    id: "indice_simple", label: "Índice Simple",
    defaults: { Vi: "V_i", V0: "V_0" },
    fields: [{ key: "Vi", label: "Valor período i (Vᵢ)" }, { key: "V0", label: "Valor período base (V₀)" }],
    tex: v => `I = \\dfrac{${v.Vi}}{${v.V0}} \\times 100`,
  },
  {
    id: "indice_pond", label: "Índice Ponderado",
    defaults: { I: "I_i", w: "w_i" },
    fields: [{ key: "I", label: "Índice componente i (Iᵢ)" }, { key: "w", label: "Peso / ponderación (wᵢ)" }],
    tex: v => `I_w = \\dfrac{\\displaystyle\\sum (${v.I} \\cdot ${v.w})}{\\displaystyle\\sum ${v.w}}`,
  },
];

function KatexSpan({ tex }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!ref.current || !window.katex) return;
    try {
      window.katex.render(tex, ref.current, { displayMode: true, throwOnError: false, trust: true });
    } catch {}
  }, [tex]);
  return <span ref={ref} />;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [selId, setSelId] = useState("porcentaje");
  const [vars, setVars] = useState({});
  const [C, setC] = useState(1000);
  const [exporting, setExporting] = useState(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const ind = INDICATORS.find(i => i.id === selId);

  useEffect(() => {
    loadCSS(KATEX_CSS);
    Promise.all([loadScript(KATEX_JS), loadScript(H2I_JS)]).then(() => {
      setReady(true);
    }).catch(err => console.error("Error cargando librerías:", err));
  }, []);

  function select(id) {
    setSelId(id);
    setVars({});
  }

  const get = k => (vars[k] !== undefined ? vars[k] : ind.defaults[k]);
  const allVars = Object.fromEntries(ind.fields.map(f => [f.key, get(f.key)]));
  const tex = ready ? ind.tex(allVars, C) : "";

  async function exportPNG() {
    if (!previewRef.current || !window.htmlToImage) return;
    setExporting("png");
    try {
      const blob = await window.htmlToImage.toBlob(previewRef.current, {
        pixelRatio: 3,
        backgroundColor: null,
        style: { padding: "36px 52px" },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `formula_${selId}.png`; a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(null); }
  }

  async function exportSVG() {
    if (!previewRef.current || !window.htmlToImage) return;
    setExporting("svg");
    try {
      const svg = await window.htmlToImage.toSvg(previewRef.current, {
        backgroundColor: null,
        style: { padding: "36px 52px" },
      });
      const a = document.createElement("a"); a.href = svg; a.download = `formula_${selId}.svg`; a.click();
    } finally { setExporting(null); }
  }

  const btnBase = (selected: boolean): React.CSSProperties => ({
  padding: '6px',
  borderRadius: '4px',
  textAlign: 'center', // Al agregar React.CSSProperties arriba, esto se arregla automáticamente
  cursor: 'pointer',
  backgroundColor: selected ? '#0070f3' : '#fff',
  color: selected ? '#fff' : '#000',
  border: '1px solid #ccc'
});

  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "1rem 0.5rem", maxWidth: 680 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: 26, fontWeight: 700, color: "#0a1a3b", letterSpacing: ".02em", lineHeight: 1.2 }}>
          Imāgo Fórmula
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#6b7a99", marginTop: 4, letterSpacing: ".04em", fontStyle: "italic" }}>
          concepción: Néstor Ledesma
        </div>
      </div>

      {/* Selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>
          Tipo de indicador
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INDICATORS.map(i => (
            <button key={i.id} onClick={() => select(i.id)} style={btnBase(i.id === selId)}>
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>
          ✏️ Personalizar variables
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px 16px" }}>
          {ind.fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 3 }}>{f.label}</label>
              <input
                type="text"
                value={get(f.key)}
                onChange={e => setVars(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={ind.defaults[f.key]}
                style={{ width: "100%", fontSize: 13, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }}
              />
            </div>
          ))}
          {ind.hasC && (
            <div>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 3 }}>Constante C</label>
              <select
                value={C}
                onChange={e => setC(Number(e.target.value))}
                style={{ fontSize: 13, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", width: "100%" }}
              >
                {C_OPTIONS.map(c => <option key={c} value={c}>{fmt(c)}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "6px 14px", background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Vista previa</span>
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{ind.label}</span>
        </div>
        <div
          ref={previewRef}
          style={{ padding: "36px 52px", background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", minHeight: 130 }}
        >
          <div style={{ fontSize: 12, color: "#999", marginBottom: 12, fontFamily: "Georgia, serif", letterSpacing: ".04em" }}>{ind.label}</div>
          {ready
            ? <KatexSpan tex={tex} />
            : <span style={{ color: "#bbb", fontSize: 13 }}>Cargando KaTeX…</span>
          }
        </div>
      </div>

      {/* Export */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {[
          { label: "Descargar PNG", icon: "🖼️", fn: exportPNG, key: "png" },
          { label: "Descargar SVG", icon: "⬡", fn: exportSVG, key: "svg" },
        ].map(btn => (
          <button
            key={btn.key}
            onClick={btn.fn}
            disabled={!ready || !!exporting}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 18px", borderRadius: 8,
              border: "0.5px solid var(--color-border-secondary)",
              background: exporting === btn.key ? "var(--color-background-secondary)" : "var(--color-background-primary)",
              color: "var(--color-text-primary)", cursor: ready && !exporting ? "pointer" : "default",
              fontSize: 13, fontWeight: 500, transition: "all .15s",
            }}
          >
            <span>{btn.icon}</span>
            {exporting === btn.key ? "Exportando…" : btn.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          PNG fondo transparente · SVG vectorial
        </span>
      </div>
    </div>
  );
}
