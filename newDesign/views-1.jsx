/* global React, Icon, MOCK */

const { useState } = React;

// ====================
// Stage Badge
// ====================
const StageBadge = ({ stage }) => {
  const s = MOCK.STAGES.find(s => s.id === stage);
  if (!s) return null;
  return <span className={`badge badge-${s.color}`}>{s.label}</span>;
};

// ====================
// Score chip
// ====================
const ScoreChip = ({ score }) => {
  const color = score >= 90 ? "var(--success-fg)" : score >= 80 ? "var(--brand-core)" : score >= 70 ? "var(--warn-fg)" : "var(--text-muted)";
  const bg = score >= 90 ? "var(--success-bg)" : score >= 80 ? "var(--info-bg)" : score >= 70 ? "var(--warn-bg)" : "#f1f3f8";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, color, background: bg, fontVariantNumeric: "tabular-nums" }}>
      {score}%
    </span>
  );
};

// ====================
// Avatar
// ====================
const Avatar = ({ id, name, size = "md" }) => (
  <div className={`avatar avatar-${size}`} style={{ background: MOCK.avatarBg(id) }}>
    {MOCK.initials(name)}
  </div>
);

// ====================
// DASHBOARD
// ====================
const Dashboard = ({ onCandidateClick, onNavigate, onPostJob }) => {
  const stats = [
    { label: "Vacantes abiertas", value: 12, delta: "+2", trend: "up", sub: "vs. semana pasada" },
    { label: "Candidatos activos", value: 162, delta: "+18", trend: "up", sub: "esta semana" },
    { label: "Entrevistas esta semana", value: 9, delta: "+3", trend: "up", sub: "vs. semana pasada" },
    { label: "Ofertas enviadas", value: 4, delta: "−1", trend: "down", sub: "vs. semana pasada" },
  ];

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Buenos días, María</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Lunes, 26 de abril · Tienes 3 entrevistas programadas hoy.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => onNavigate("pipeline")}>
            <Icon name="kanban" size={16} /> Ver pipeline
          </button>
          <button className="btn btn-primary" onClick={onPostJob}>
            <Icon name="plus" size={16} /> Publicar vacante
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} className="card" style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500, marginBottom: 6 }}>{s.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 600, color: s.trend === "up" ? "var(--success-fg)" : "var(--danger-fg)" }}>
                <Icon name={s.trend === "up" ? "trend-up" : "trend-down"} size={12} /> {s.delta}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16 }} className="dashboard-grid">
        {/* Recent applications + funnel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Hiring funnel */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Embudo de contratación</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Últimos 30 días · todas las vacantes</p>
              </div>
              <button className="btn btn-ghost btn-sm">Ver detalles</button>
            </div>
            <div className="funnel-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {MOCK.FUNNEL.map((f, i) => {
                const grad = `linear-gradient(90deg, ${[
                  "#2d52a8", "#4869b6", "#6f88c3", "#8aa2d8", "#1f8a5a", "#146c3a"
                ][i]} 0%, ${[
                  "#4869b6", "#6f88c3", "#8aa2d8", "#a8bce0", "#3aa874", "#1f8a5a"
                ][i]} 100%)`;
                return (
                  <div key={i} className="funnel-row">
                    <span className="funnel-label">{f.stage}</span>
                    <div className="funnel-bar">
                      <div style={{ width: `${f.pct}%`, height: "100%", background: grad, borderRadius: 6, transition: "width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}></div>
                    </div>
                    <span className="funnel-count" style={{ fontVariantNumeric: "tabular-nums" }}>{f.count}</span>
                    <span className="funnel-pct" style={{ fontVariantNumeric: "tabular-nums" }}>{f.pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent applications table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Aplicaciones recientes</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{MOCK.CANDIDATES.length} candidatos esta semana</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("candidates")}>Ver todos <Icon name="chevron-right" size={14} /></button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ background: "var(--bg-wash)" }}>
                    {["Candidato", "Posición", "Etapa", "Score", "Fecha", ""].map((h, i) => (
                      <th key={i} style={{ padding: "10px 16px", textAlign: i === 5 ? "right" : "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK.CANDIDATES.slice(0, 6).map(c => (
                    <tr key={c.id} className="app-row" onClick={() => onCandidateClick(c)} style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar id={c.id} name={c.name} size="sm" />
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>{c.location}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>{c.position}</td>
                      <td style={{ padding: "12px 16px" }}><StageBadge stage={c.stage} /></td>
                      <td style={{ padding: "12px 16px" }}><ScoreChip score={c.score} /></td>
                      <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--text-muted)" }}>{c.applied}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); }}><Icon name="more" size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="card activity-card" style={{ padding: 20, alignSelf: "start" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Actividad reciente</h3>
            <button className="btn-icon"><Icon name="more" size={16} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {MOCK.ACTIVITY.map((a, i) => (
              <div key={a.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < MOCK.ACTIVITY.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 8, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.type === "stage" ? "var(--brand-core)" : a.type === "note" ? "var(--purple-fg)" : a.type === "event" ? "var(--warn-fg)" : a.type === "post" ? "var(--success-fg)" : "var(--text-subtle)" }}></span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600 }}>{a.who}</span>{" "}
                    <span style={{ color: "var(--text-muted)" }}>{a.action}</span>{" "}
                    <span style={{ fontWeight: 500 }}>{a.target}</span>
                    {a.to && <> <span className="badge badge-offer" style={{ marginLeft: 4 }}>{a.to}</span></>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>{a.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================
// CANDIDATES LIST
// ====================
const CandidatesList = ({ onCandidateClick }) => {
  const [activeStage, setActiveStage] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");

  let filtered = MOCK.CANDIDATES.filter(c => {
    if (activeStage !== "all" && c.stage !== activeStage) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.position.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  if (sort === "score") filtered = [...filtered].sort((a, b) => b.score - a.score);

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Candidatos</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>{filtered.length} candidatos · {MOCK.CANDIDATES.length} en total</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary"><Icon name="download" size={16} /> Exportar</button>
          <button className="btn btn-primary"><Icon name="plus" size={16} /> Agregar candidato</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", pointerEvents: "none" }}>
            <Icon name="search" size={16} />
          </span>
          <input className="input" placeholder="Buscar por nombre o posición…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34, height: 36 }} />
        </div>

        {/* Stage filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ id: "all", label: "Todos" }, ...MOCK.STAGES].map(s => {
            const active = s.id === activeStage;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStage(s.id)}
                style={{
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: active ? "var(--brand-core)" : "white",
                  color: active ? "white" : "var(--text-muted)",
                  border: active ? "1px solid var(--brand-core)" : "1px solid var(--border-strong)",
                  transition: "all 120ms ease",
                  letterSpacing: "-0.005em",
                }}
              >
                {s.label}
                {s.id !== "all" && (
                  <span style={{ marginLeft: 6, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
                    {MOCK.CANDIDATES.filter(c => c.stage === s.id).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ordenar:</span>
          <select className="input" style={{ width: "auto", height: 32, paddingRight: 30, fontSize: 12.5 }} value={sort} onChange={e => setSort(e.target.value)}>
            <option value="recent">Más recientes</option>
            <option value="score">Mejor score</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ background: "var(--bg-wash)" }}>
                {["Candidato", "Posición", "Etapa", "Score", "Fuente", "Aplicó", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i === 6 ? "right" : "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="app-row" onClick={() => onCandidateClick(c)} style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar id={c.id} name={c.name} size="md" />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>{c.position}</td>
                  <td style={{ padding: "12px 16px" }}><StageBadge stage={c.stage} /></td>
                  <td style={{ padding: "12px 16px" }}><ScoreChip score={c.score} /></td>
                  <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--text-muted)" }}>{c.source}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--text-muted)" }}>{c.applied}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button className="btn-icon" onClick={(e) => e.stopPropagation()}><Icon name="more" size={16} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No hay coincidencias</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-subtle)" }}>Prueba ajustar los filtros o la búsqueda.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

window.StageBadge = StageBadge;
window.ScoreChip = ScoreChip;
window.Avatar = Avatar;
window.Dashboard = Dashboard;
window.CandidatesList = CandidatesList;
