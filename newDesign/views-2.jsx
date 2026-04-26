/* global React, Icon, MOCK, Avatar, StageBadge, ScoreChip */

const { useState: useState2, useRef: useRef2 } = React;

// ====================
// PIPELINE / KANBAN with drag-and-drop
// ====================
const Pipeline = ({ candidates, onCandidateMove, onCandidateClick }) => {
  const [draggingId, setDraggingId] = useState2(null);
  const [dragOverStage, setDragOverStage] = useState2(null);

  const onDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragEnd = () => { setDraggingId(null); setDragOverStage(null); };
  const onDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageId) setDragOverStage(stageId);
  };
  const onDrop = (e, stageId) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    if (id) onCandidateMove(id, stageId);
    setDraggingId(null);
    setDragOverStage(null);
  };

  return (
    <div style={{ padding: "24px 24px 40px", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12, padding: "0 8px" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Pipeline</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Arrastra los candidatos para moverlos entre etapas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary"><Icon name="filter" size={16} /> Filtrar</button>
          <button className="btn btn-secondary"><Icon name="briefcase" size={16} /> Todas las vacantes <Icon name="chevron-down" size={14} /></button>
          <button className="btn btn-primary"><Icon name="plus" size={16} /> Agregar candidato</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, overflowX: "auto", flex: 1, paddingBottom: 16, paddingLeft: 8, paddingRight: 8 }}>
        {MOCK.STAGES.map(stage => {
          const stageCandidates = candidates.filter(c => c.stage === stage.id);
          const isOver = dragOverStage === stage.id;
          return (
            <div
              key={stage.id}
              onDragOver={(e) => onDragOver(e, stage.id)}
              onDrop={(e) => onDrop(e, stage.id)}
              onDragLeave={() => { if (dragOverStage === stage.id) setDragOverStage(null); }}
              style={{
                width: 280,
                flexShrink: 0,
                background: isOver ? "rgba(45, 82, 168, 0.06)" : "var(--card)",
                border: isOver ? "1.5px dashed var(--brand-core)" : "1px solid var(--border)",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                transition: "background 120ms ease, border-color 120ms ease",
                maxHeight: "100%",
              }}
            >
              <div style={{ padding: "14px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge badge-${stage.color} badge-dot`}>{stage.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{stageCandidates.length}</span>
                </div>
                <button className="btn-icon" style={{ width: 28, height: 28 }}><Icon name="plus" size={14} /></button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {stageCandidates.map(c => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, c.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => onCandidateClick(c)}
                    style={{
                      background: "white",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 12,
                      boxShadow: "0 1px 2px rgba(45,82,168,0.04)",
                      cursor: "grab",
                      transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
                      opacity: draggingId === c.id ? 0.4 : 1,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(45,82,168,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(45,82,168,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                      <Avatar id={c.id} name={c.name} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.25, marginBottom: 1 }}>{c.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.position}</div>
                      </div>
                      <span style={{ color: "var(--text-subtle)", marginTop: 2 }} aria-label="Arrastrar"><Icon name="drag" size={14} /></span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-subtle)" }}>
                        <Icon name="clock" size={11} /> {c.daysInStage}d en etapa
                      </span>
                      <ScoreChip score={c.score} />
                    </div>
                  </div>
                ))}
                {stageCandidates.length === 0 && (
                  <div style={{ padding: "24px 12px", textAlign: "center", fontSize: 11.5, color: "var(--text-subtle)", border: "1px dashed var(--border)", borderRadius: 8 }}>
                    Sin candidatos
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ====================
// JOB OPENINGS
// ====================
const JobOpenings = () => {
  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Vacantes</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>{MOCK.POSITIONS.filter(p => p.status === "Activa").length} activas · {MOCK.POSITIONS.length} en total</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary"><Icon name="download" size={16} /> Exportar</button>
          <button className="btn btn-primary"><Icon name="plus" size={16} /> Publicar vacante</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {MOCK.POSITIONS.map(p => (
          <div key={p.id} className="card" style={{ padding: 18, transition: "border-color 120ms, transform 120ms, box-shadow 120ms", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(45,82,168,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span className={p.status === "Activa" ? "badge badge-offer badge-dot" : "badge badge-screening badge-dot"}>{p.status}</span>
              <button className="btn-icon" onClick={e => e.stopPropagation()} style={{ width: 28, height: 28 }}><Icon name="more" size={14} /></button>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{p.title}</h3>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>{p.dept}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "var(--text-muted)", marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="map-pin" size={13} /> {p.location}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={13} /> {p.type}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.02em", color: "var(--brand-core)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{p.applicants}</div>
                <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>aplicaciones</div>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-subtle)", textAlign: "right" }}>{p.openSince}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ====================
// CANDIDATE DETAIL (full page) + slide-in version
// ====================
const CandidateDetailContent = ({ candidate, onAdvance, onReject, full = false }) => {
  const [tab, setTab] = useState2("perfil");
  if (!candidate) return null;
  const c = candidate;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: full ? "24px 32px 0" : "20px 24px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <Avatar id={c.id} name={c.name} size={full ? "xl" : "lg"} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: full ? 24 : 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{c.name}</h2>
              <ScoreChip score={c.score} />
            </div>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 10 }}>{c.position}</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="mail" size={13} /> {c.email}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="phone" size={13} /> {c.phone}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="map-pin" size={13} /> {c.location}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Etapa actual:</span>
            <StageBadge stage={c.stage} />
            <span style={{ fontSize: 12, color: "var(--text-subtle)", marginLeft: 4 }}>· {c.daysInStage} días</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={onReject}>Rechazar</button>
            <button className="btn btn-primary btn-sm" onClick={onAdvance}><Icon name="check" size={14} /> Avanzar etapa</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          {[{ id: "perfil", label: "Perfil" }, { id: "actividad", label: "Actividad" }, { id: "notas", label: "Notas" }, { id: "evaluaciones", label: "Evaluaciones" }].map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--brand-core)" : "var(--text-muted)",
                borderBottom: active ? "2px solid var(--brand-core)" : "2px solid transparent",
                marginBottom: -1,
              }}>{t.label}</button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: full ? "20px 32px 32px" : "16px 24px 24px" }}>
        {tab === "perfil" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Section title="Resumen">
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55, margin: 0 }}>
                Profesional con {c.experience} de experiencia en su área. Aplicó vía {c.source} hace {c.applied.replace("Hace ", "")}.
                Match score de {c.score}% basado en perfil técnico y requisitos de la vacante.
              </p>
            </Section>
            <DetailGrid items={[
              { label: "Posición aplicada", value: c.position },
              { label: "Experiencia", value: c.experience },
              { label: "Ubicación", value: c.location },
              { label: "Fuente", value: c.source },
              { label: "Aplicó", value: c.applied },
              { label: "Match score", value: `${c.score}%` },
            ]} />
            <Section title="Habilidades">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["JavaScript", "React", "Node.js", "TypeScript", "PostgreSQL", "AWS", "Docker"].map(s => (
                  <span key={s} style={{ padding: "5px 10px", background: "var(--info-bg)", color: "var(--info-fg)", borderRadius: 6, fontSize: 12, fontWeight: 500 }}>{s}</span>
                ))}
              </div>
            </Section>
            <Section title="Documentos">
              {[
                { name: "CV - " + c.name + ".pdf", size: "284 KB" },
                { name: "Carta de presentación.pdf", size: "98 KB" },
              ].map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--info-bg)", color: "var(--info-fg)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="download" size={14} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>{d.size}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm">Descargar</button>
                </div>
              ))}
            </Section>
          </div>
        )}
        {tab === "actividad" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {MOCK.ACTIVITY.slice(0, 4).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 8, paddingTop: 6 }}><span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: "var(--brand-core)" }}></span></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}><b>{a.who}</b> {a.action} <b>{c.name}</b></div>
                  <div style={{ fontSize: 11.5, color: "var(--text-subtle)", marginTop: 2 }}>{a.when}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "notas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <textarea className="input" placeholder="Agregar nota interna…" style={{ minHeight: 80, padding: 12, height: "auto", resize: "vertical" }}></textarea>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary btn-sm">Guardar nota</button>
            </div>
            <div style={{ padding: 14, background: "var(--bg-wash)", borderRadius: 10, fontSize: 13, color: "var(--text-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Avatar id="x1" name="Carla M" size="sm" />
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Carla M.</span>
                <span style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>hace 1 h</span>
              </div>
              Excelente entrevista técnica. Demostró sólidos conocimientos en arquitectura de sistemas y comunicación clara.
            </div>
          </div>
        )}
        {tab === "evaluaciones" && (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sin evaluaciones aún</div>
            <div style={{ fontSize: 12.5, color: "var(--text-subtle)", marginBottom: 14 }}>Programa una entrevista para comenzar a evaluar.</div>
            <button className="btn btn-secondary btn-sm"><Icon name="plus" size={14} /> Programar evaluación</button>
          </div>
        )}
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div>
    <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{title}</h4>
    {children}
  </div>
);

const DetailGrid = ({ items }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, padding: 16, background: "var(--bg-wash)", borderRadius: 10 }}>
    {items.map((i, idx) => (
      <div key={idx}>
        <div style={{ fontSize: 11, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 }}>{i.label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{i.value}</div>
      </div>
    ))}
  </div>
);

// Slide-in panel
const CandidatePanel = ({ candidate, onClose, onAdvance, onReject }) => {
  if (!candidate) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15, 30, 70, 0.32)", zIndex: 100, animation: "fadeIn 200ms ease" }} />
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(560px, 100%)",
        background: "white",
        boxShadow: "var(--shadow-panel)",
        zIndex: 101,
        animation: "slideInRight 280ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{ position: "absolute", top: 16, right: 16, zIndex: 1 }}>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={18} /></button>
        </div>
        <CandidateDetailContent candidate={candidate} onAdvance={onAdvance} onReject={onReject} full={false} />
      </div>
    </>
  );
};

window.Pipeline = Pipeline;
window.JobOpenings = JobOpenings;
window.CandidatePanel = CandidatePanel;
window.CandidateDetailContent = CandidateDetailContent;
