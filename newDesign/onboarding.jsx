/* global React, Icon */
/* Wizard de onboarding post-registro · 7 pasos */

const { useState: useOnbState, useEffect: useOnbEffect } = React;

// ============================================================
// Shared bits
// ============================================================

const StepHeader = ({ eyebrow, title, subtitle }) => (
  <div style={{ marginBottom: 24 }}>
    {eyebrow && (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--brand-core)", textTransform: "uppercase", marginBottom: 10 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand-core)" }}></span>
        {eyebrow}
      </div>
    )}
    <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: 8, color: "var(--text-primary)" }} className="onb-title">{title}</h1>
    {subtitle && <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.5, maxWidth: 540 }} className="onb-subtitle">{subtitle}</p>}
  </div>
);

const FieldLabel = ({ children, optional = false, required = false }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
    {children}
    {optional && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-subtle)" }}>(opcional)</span>}
    {required && <span style={{ color: "#c0335c" }}>*</span>}
  </label>
);

const Hint = ({ children }) => (
  <p style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 6, lineHeight: 1.45 }}>{children}</p>
);

// Illustration placeholder — visible recuadro marcado para reemplazar después
const IllustrationSlot = ({ label, aspect = "4 / 3", style = {} }) => (
  <div style={{
    width: "100%",
    aspectRatio: aspect,
    background: "repeating-linear-gradient(135deg, rgba(45,82,168,0.04) 0 12px, rgba(45,82,168,0.08) 12px 13px)",
    border: "1.5px dashed var(--border-strong)",
    borderRadius: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-subtle)",
    gap: 6,
    ...style,
  }}>
    <Icon name="image" size={28} />
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Ilustración</div>
    <div style={{ fontSize: 11.5, fontWeight: 500 }}>{label}</div>
  </div>
);

// ============================================================
// Progress bar — three flavors via prop
// ============================================================

const ProgressBar = ({ steps, current, style = "bar" }) => {
  if (style === "stepper") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 0, justifyContent: "center" }}>
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <React.Fragment key={i}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: done ? "var(--brand-core)" : active ? "white" : "rgba(45,82,168,0.08)",
                  border: active ? "2px solid var(--brand-core)" : done ? "2px solid var(--brand-core)" : "2px solid transparent",
                  color: done ? "white" : active ? "var(--brand-core)" : "var(--text-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                  transition: "all 200ms ease", flexShrink: 0,
                }}>
                  {done ? <Icon name="check" size={14} /> : i + 1}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? "var(--text-primary)" : "var(--text-subtle)", whiteSpace: "nowrap", letterSpacing: "0.01em" }} className="onb-step-label">{s.short}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < current ? "var(--brand-core)" : "rgba(45,82,168,0.10)", margin: "0 6px", marginTop: -16, transition: "background 200ms ease", minWidth: 16, maxWidth: 56 }}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }
  if (style === "checklist") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Paso {current + 1} de {steps.length}</div>
        <div style={{ flex: 1, minWidth: 120, display: "flex", gap: 4 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              flex: 1, height: 6, borderRadius: 3,
              background: i < current ? "var(--brand-core)" : i === current ? "var(--brand-core)" : "rgba(45,82,168,0.10)",
              opacity: i === current ? 1 : i < current ? 1 : 0.5,
              transition: "background 200ms ease, opacity 200ms ease",
            }}></div>
          ))}
        </div>
      </div>
    );
  }
  // default "bar"
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{steps[current].short}</div>
        <div style={{ fontSize: 12, color: "var(--text-subtle)", fontVariantNumeric: "tabular-nums" }}>Paso {current + 1} <span style={{ opacity: 0.6 }}>/ {steps.length}</span></div>
      </div>
      <div style={{ height: 4, background: "rgba(45,82,168,0.10)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--brand-core)", borderRadius: 2, transition: "width 400ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}></div>
      </div>
    </div>
  );
};

// ============================================================
// Step 1: Bienvenida + tipo de cuenta
// ============================================================

const StepWelcome = ({ accountType, setAccountType, copy }) => {
  const types = [
    { id: "company", icon: "office", title: "Empresa", desc: "Una organización con RNC que contrata para sí misma." },
    { id: "agency", icon: "users", title: "Agencia de reclutamiento", desc: "Buscas talento para múltiples empresas clientes." },
    { id: "individual", icon: "user", title: "Profesional individual", desc: "Reclutador independiente o headhunter freelance." },
  ];
  return (
    <div>
      <StepHeader
        eyebrow={copy.welcomeEyebrow}
        title={copy.welcomeTitle}
        subtitle={copy.welcomeSubtitle}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {types.map(t => {
          const active = accountType === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setAccountType(t.id)} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "16px 18px",
              borderRadius: 12,
              border: active ? "2px solid var(--brand-core)" : "1.5px solid var(--border)",
              background: active ? "rgba(45,82,168,0.04)" : "white",
              textAlign: "left",
              transition: "all 160ms ease",
              cursor: "pointer",
              boxShadow: active ? "0 0 0 4px rgba(45,82,168,0.10)" : "none",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: active ? "var(--brand-core)" : "rgba(45,82,168,0.08)",
                color: active ? "white" : "var(--brand-core)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                transition: "all 160ms ease",
              }}>
                <Icon name={t.icon} size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{t.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>{t.desc}</div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                border: active ? "6px solid var(--brand-core)" : "2px solid var(--border-strong)",
                background: "white", flexShrink: 0,
                transition: "all 160ms ease",
              }}></div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// Step 2: Datos de empresa (obligatorio)
// ============================================================

const StepCompany = ({ accountType, copy }) => {
  const isIndividual = accountType === "individual";
  const sectors = ["Tecnología y software", "Servicios financieros", "Manufactura", "Comercio / retail", "Salud", "Educación", "Construcción", "Hotelería y turismo", "Agropecuario", "Otro"];
  const sizes = ["1–10", "11–50", "51–200", "201–500", "500+"];

  return (
    <div>
      <StepHeader
        eyebrow={copy.companyEyebrow}
        title={isIndividual ? copy.companyTitleIndividual : copy.companyTitle}
        subtitle={isIndividual ? copy.companySubtitleIndividual : copy.companySubtitle}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <FieldLabel required>{isIndividual ? "Nombre profesional" : "Nombre de la empresa"}</FieldLabel>
          <input className="input" defaultValue={isIndividual ? "" : ""} placeholder={isIndividual ? "Ej: María Reyes Headhunter" : "Ej: Constructora Caribe"} style={{ width: "100%", height: 44, fontSize: 15 }} />
        </div>

        {!isIndividual && (
          <div className="onb-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel required>RNC</FieldLabel>
              <input className="input" placeholder="000-00000-0" style={{ width: "100%", height: 44, fontSize: 15, fontVariantNumeric: "tabular-nums" }} />
              <Hint>Validamos el RNC con la DGII automáticamente.</Hint>
            </div>
            <div>
              <FieldLabel optional>Razón social</FieldLabel>
              <input className="input" placeholder="Si difiere del nombre comercial" style={{ width: "100%", height: 44, fontSize: 15 }} />
            </div>
          </div>
        )}

        <div className="onb-grid-2" style={{ display: "grid", gridTemplateColumns: isIndividual ? "1fr" : "1fr 1fr", gap: 14 }}>
          <div>
            <FieldLabel required>{isIndividual ? "Especialidad" : "Sector"}</FieldLabel>
            <div style={{ position: "relative" }}>
              <select className="input" style={{ width: "100%", height: 44, fontSize: 15, appearance: "none", paddingRight: 36 }}>
                <option value="">Seleccionar…</option>
                {sectors.map(s => <option key={s}>{s}</option>)}
              </select>
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", pointerEvents: "none" }}><Icon name="chevron-down" size={16} /></span>
            </div>
          </div>
          {!isIndividual && (
            <div>
              <FieldLabel required>Tamaño</FieldLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {sizes.map((s, i) => (
                  <button key={s} type="button" style={{
                    flex: "1 1 0",
                    minWidth: 56,
                    height: 44,
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: i === 1 ? "2px solid var(--brand-core)" : "1px solid var(--border-strong)",
                    background: i === 1 ? "rgba(45,82,168,0.06)" : "white",
                    color: i === 1 ? "var(--brand-core)" : "var(--text-primary)",
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <FieldLabel optional>Sitio web</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-strong)", borderRadius: 6, background: "white", height: 44, overflow: "hidden" }}>
            <span style={{ padding: "0 10px 0 12px", fontSize: 13, color: "var(--text-subtle)", borderRight: "1px solid var(--border)" }}>https://</span>
            <input style={{ flex: 1, height: "100%", border: 0, outline: "none", padding: "0 12px", fontSize: 15, background: "transparent" }} placeholder="empresa.com.do" />
          </div>
        </div>

        <div>
          <FieldLabel optional>Ubicación principal</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }} className="onb-grid-2">
            <input className="input" placeholder="Santo Domingo, D.N." style={{ height: 44, fontSize: 15 }} />
            <select className="input" style={{ height: 44, fontSize: 15, appearance: "none" }}>
              <option>Distrito Nacional</option>
              <option>Santiago</option>
              <option>La Vega</option>
              <option>Otra provincia</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Step 3: Logo + branding
// ============================================================

const StepBrand = ({ copy }) => {
  const [color, setColor] = useOnbState("#2d52a8");
  const presets = ["#2d52a8", "#1a3b88", "#0f6b66", "#9c2a3a", "#7e3a9c", "#3a3a3a", "#c8932a"];
  return (
    <div>
      <StepHeader
        eyebrow={copy.brandEyebrow}
        title={copy.brandTitle}
        subtitle={copy.brandSubtitle}
      />
      <div className="onb-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <FieldLabel optional>Logo de la empresa</FieldLabel>
            <div style={{
              border: "1.5px dashed var(--border-strong)",
              borderRadius: 12,
              padding: 20,
              background: "var(--bg-wash)",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 10,
                background: "white",
                border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-subtle)",
                flexShrink: 0,
              }}><Icon name="image" size={24} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Sube tu logo</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>PNG o SVG con fondo transparente · Mínimo 200×200px</div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>Examinar</button>
            </div>
          </div>

          <div>
            <FieldLabel optional>Color principal</FieldLabel>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              {presets.map(p => (
                <button key={p} type="button" onClick={() => setColor(p)} style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: p,
                  border: color === p ? "3px solid white" : "1px solid var(--border)",
                  boxShadow: color === p ? `0 0 0 2px ${p}` : "none",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }} aria-label={p}></button>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", height: 36, borderRadius: 8, border: "1px solid var(--border-strong)", background: "white" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: color, border: "1px solid rgba(0,0,0,0.1)" }}></div>
                <input value={color} onChange={e => setColor(e.target.value)} style={{ width: 76, border: 0, outline: "none", fontSize: 13, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)", textTransform: "uppercase" }} />
              </div>
            </div>
            <Hint>Usaremos este color en el portal de candidatos y en correos automáticos.</Hint>
          </div>
        </div>

        <div className="onb-preview-col">
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Vista previa</div>
          <div style={{
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 8px 28px rgba(15,30,70,0.08)",
          }}>
            <div style={{ height: 56, background: color, display: "flex", alignItems: "center", padding: "0 18px", color: "white", transition: "background 200ms ease" }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, marginRight: 10 }}>A</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Portal de candidatos</div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Únete a nuestro equipo</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>Estamos buscando talento que mueva al país hacia adelante.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["Desarrollador Backend Senior", "Diseñador UX/UI", "Gerente de Operaciones"].map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, transition: "background 200ms ease" }}></div>
                    <span style={{ flex: 1, fontWeight: 500, color: "var(--text-primary)" }}>{t}</span>
                    <span style={{ fontSize: 10, color: "var(--text-subtle)" }}>Aplicar →</span>
                  </div>
                ))}
              </div>
              <button style={{
                marginTop: 16, width: "100%", height: 36, borderRadius: 8,
                background: color, color: "white", fontWeight: 600, fontSize: 13,
                border: 0, cursor: "pointer", transition: "background 200ms ease",
              }}>Ver todas las vacantes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Step 4: Perfil personal
// ============================================================

const StepProfile = ({ copy }) => {
  return (
    <div>
      <StepHeader
        eyebrow={copy.profileEyebrow}
        title={copy.profileTitle}
        subtitle={copy.profileSubtitle}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: 20, background: "var(--bg-wash)", border: "1px solid var(--border)", borderRadius: 12 }} className="onb-profile-row">
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, #4869b6, #8aa2d8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 26, fontWeight: 700,
            flexShrink: 0,
            boxShadow: "0 6px 18px rgba(45,82,168,0.20)",
            position: "relative",
          }}>
            MR
            <button style={{
              position: "absolute", bottom: -2, right: -2,
              width: 28, height: 28, borderRadius: "50%",
              background: "white", border: "2px solid var(--bg-wash)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--brand-core)", cursor: "pointer",
              boxShadow: "0 2px 6px rgba(15,30,70,0.16)",
            }} aria-label="Subir foto"><Icon name="plus" size={14} /></button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>Foto de perfil</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.45 }}>Una foto profesional ayuda a que los candidatos te reconozcan en correos y entrevistas.</div>
          </div>
        </div>

        <div className="onb-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <FieldLabel required>Nombre</FieldLabel>
            <input className="input" defaultValue="María" style={{ width: "100%", height: 44, fontSize: 15 }} />
          </div>
          <div>
            <FieldLabel required>Apellido</FieldLabel>
            <input className="input" defaultValue="Reyes" style={{ width: "100%", height: 44, fontSize: 15 }} />
          </div>
        </div>

        <div>
          <FieldLabel required>Cargo en la empresa</FieldLabel>
          <input className="input" placeholder="Ej: Reclutadora Senior" style={{ width: "100%", height: 44, fontSize: 15 }} />
        </div>

        <div className="onb-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <FieldLabel optional>Teléfono</FieldLabel>
            <div style={{ display: "flex", border: "1px solid var(--border-strong)", borderRadius: 6, background: "white", height: 44, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "0 10px", borderRight: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>🇩🇴 +1</div>
              <input style={{ flex: 1, border: 0, outline: "none", padding: "0 12px", fontSize: 15, background: "transparent" }} placeholder="809-555-1234" />
            </div>
          </div>
          <div>
            <FieldLabel optional>Zona horaria</FieldLabel>
            <select className="input" style={{ width: "100%", height: 44, fontSize: 15, appearance: "none" }}>
              <option>América/Santo Domingo (GMT-4)</option>
              <option>América/Nueva York (GMT-5)</option>
              <option>América/Los Ángeles (GMT-8)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Step 5: Invitar equipo
// ============================================================

const StepTeam = ({ copy }) => {
  const [rows, setRows] = useOnbState([
    { email: "", role: "Reclutador" },
    { email: "", role: "Reclutador" },
  ]);
  const update = (i, k, v) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const add = () => setRows([...rows, { email: "", role: "Reclutador" }]);
  const remove = (i) => setRows(rows.filter((_, j) => j !== i));

  return (
    <div>
      <StepHeader
        eyebrow={copy.teamEyebrow}
        title={copy.teamTitle}
        subtitle={copy.teamSubtitle}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r, i) => (
          <div key={i} className="onb-team-row" style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 10, alignItems: "stretch" }}>
            <input className="input" placeholder="correo@empresa.com.do" value={r.email} onChange={e => update(i, "email", e.target.value)} style={{ height: 44, fontSize: 14 }} />
            <select className="input" value={r.role} onChange={e => update(i, "role", e.target.value)} style={{ height: 44, fontSize: 14, appearance: "none" }}>
              <option>Admin</option>
              <option>Reclutador</option>
              <option>Hiring Manager</option>
              <option>Solo lectura</option>
            </select>
            <button type="button" onClick={() => remove(i)} aria-label="Eliminar" style={{
              width: 44, height: 44, borderRadius: 6,
              border: "1px solid var(--border)", background: "white",
              color: "var(--text-subtle)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}><Icon name="trash" size={16} /></button>
          </div>
        ))}
        <button type="button" onClick={add} style={{
          height: 44, borderRadius: 8,
          border: "1.5px dashed var(--border-strong)",
          background: "transparent", color: "var(--brand-core)",
          fontWeight: 600, fontSize: 13, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Icon name="plus" size={14} /> Agregar otra invitación
        </button>
      </div>

      <div style={{
        marginTop: 22,
        padding: "14px 16px",
        background: "rgba(45,82,168,0.05)",
        borderRadius: 10,
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand-core)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="info" size={14} />
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Cada miembro recibe un correo con un enlace para crear su contraseña. Puedes invitar más personas en cualquier momento desde <strong style={{ color: "var(--text-primary)" }}>Configuración → Equipo</strong>.
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Step 6: Conectar correo
// ============================================================

const StepEmail = ({ copy }) => {
  const [connected, setConnected] = useOnbState(null);
  const providers = [
    { id: "google", title: "Gmail / Google Workspace", desc: "Conecta tu cuenta de Google para enviar correos desde tu dirección personal.", logo: "G", color: "#ea4335" },
    { id: "microsoft", title: "Outlook / Microsoft 365", desc: "Compatible con cuentas corporativas de Microsoft 365 y Outlook.com.", logo: "M", color: "#0078d4" },
  ];
  return (
    <div>
      <StepHeader
        eyebrow={copy.emailEyebrow}
        title={copy.emailTitle}
        subtitle={copy.emailSubtitle}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {providers.map(p => {
          const isConnected = connected === p.id;
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: 18,
              borderRadius: 12,
              border: isConnected ? "2px solid #1f8a5a" : "1.5px solid var(--border)",
              background: isConnected ? "rgba(31,138,90,0.05)" : "white",
              transition: "all 160ms ease",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: p.color, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, flexShrink: 0,
              }}>{p.logo}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{p.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.4 }}>{isConnected ? "Conectado como maria@constructora.com.do" : p.desc}</div>
              </div>
              {isConnected ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#1f8a5a", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                  <Icon name="check-circle" size={16} /> Conectado
                </div>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConnected(p.id)} style={{ flexShrink: 0 }}>Conectar</button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 22,
        padding: "14px 16px",
        background: "var(--bg-wash)",
        borderRadius: 10,
        border: "1px solid var(--border)",
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <div style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }}>
          <Icon name="info" size={16} />
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          También puedes usar nuestro relay <strong style={{ color: "var(--text-primary)" }}>asi-mail</strong> sin conectar nada — los candidatos verán los correos como provenientes de tu cuenta verificada.
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Step 7: Tour / Listo
// ============================================================

const StepDone = ({ copy, onFinish }) => {
  const items = [
    { icon: "users", label: "Tablero Kanban", desc: "Mueve candidatos entre etapas con drag & drop." },
    { icon: "briefcase", label: "Crear vacante", desc: "Publica tu primera oferta en menos de 2 minutos." },
    { icon: "search", label: "Banco de talento", desc: "Importa tu base existente o búscala con filtros." },
  ];
  return (
    <div style={{ textAlign: "center", maxWidth: 540, margin: "0 auto" }}>
      <div style={{
        width: 84, height: 84, borderRadius: "50%",
        background: "linear-gradient(135deg, #1f8a5a, #65d99e)",
        margin: "0 auto 24px",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white",
        boxShadow: "0 12px 36px rgba(31,138,90,0.30)",
      }}>
        <Icon name="check" size={40} />
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 10 }} className="onb-title">{copy.doneTitle}</h1>
      <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 32 }} className="onb-subtitle">{copy.doneSubtitle}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left", marginBottom: 32 }} className="onb-tour-list">
        {items.map((it, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 16px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "white",
            transition: "all 160ms ease",
            cursor: "pointer",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--brand-core)"; e.currentTarget.style.transform = "translateX(2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateX(0)"; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(45,82,168,0.08)", color: "var(--brand-core)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={it.icon} size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 1 }}>{it.label}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.4 }}>{it.desc}</div>
            </div>
            <span style={{ color: "var(--text-subtle)", flexShrink: 0 }}><Icon name="chevron-right" size={18} /></span>
          </div>
        ))}
      </div>

      <button type="button" onClick={onFinish} className="btn btn-primary" style={{ height: 48, padding: "0 28px", fontSize: 15, fontWeight: 600 }}>
        Ir a mi dashboard <Icon name="arrow-right" size={16} />
      </button>
    </div>
  );
};

// ============================================================
// Wizard shell
// ============================================================

const COPY = {
  warm: {
    welcomeEyebrow: "¡Hola!",
    welcomeTitle: "Bienvenida a ASI ATS, María 👋",
    welcomeSubtitle: "Antes de empezar a contratar, vamos a configurar tu cuenta. Toma 3 minutos y la mayoría de los pasos son opcionales.",
    companyEyebrow: "Sobre tu organización",
    companyTitle: "Cuéntanos de tu empresa",
    companyTitleIndividual: "Cuéntanos de ti",
    companySubtitle: "Solo necesitamos lo esencial. Puedes editar todo después en Configuración.",
    companySubtitleIndividual: "Esto aparecerá en tus correos a candidatos y en el portal público.",
    brandEyebrow: "Tu marca",
    brandTitle: "Hagamos que se vea como tú",
    brandSubtitle: "Tu logo y color aparecen en el portal de candidatos, correos y compartibles. Esto es opcional — puedes saltarlo.",
    profileEyebrow: "Tu perfil",
    profileTitle: "Y un poco sobre ti",
    profileSubtitle: "Tus datos aparecen cuando contactas candidatos. Una foto profesional siempre ayuda.",
    teamEyebrow: "Tu equipo",
    teamTitle: "¿Quién más va a reclutar?",
    teamSubtitle: "Invita a tu equipo ahora o hazlo después. Cada persona puede tener su propio rol y permisos.",
    emailEyebrow: "Comunicación",
    emailTitle: "Conecta tu correo (opcional)",
    emailSubtitle: "Para que los correos a candidatos lleguen desde tu dirección y tengas hilos sincronizados.",
    doneTitle: "¡Todo listo, María!",
    doneSubtitle: "Tu cuenta está configurada. Te dejamos algunos lugares populares por donde empezar.",
  },
  formal: {
    welcomeEyebrow: "Bienvenida",
    welcomeTitle: "Configuración inicial",
    welcomeSubtitle: "Complete los siguientes pasos para activar su cuenta. La duración estimada es de 3 minutos.",
    companyEyebrow: "Datos generales",
    companyTitle: "Información de la empresa",
    companyTitleIndividual: "Información profesional",
    companySubtitle: "Estos datos pueden ser modificados posteriormente en el panel de configuración.",
    companySubtitleIndividual: "Estos datos aparecerán en sus comunicaciones con candidatos.",
    brandEyebrow: "Identidad visual",
    brandTitle: "Configuración de marca",
    brandSubtitle: "Logo y color principal aplicados al portal de candidatos y comunicaciones automáticas.",
    profileEyebrow: "Perfil del usuario",
    profileTitle: "Datos del administrador",
    profileSubtitle: "Información que aparece en sus comunicaciones con candidatos.",
    teamEyebrow: "Equipo",
    teamTitle: "Invitación de usuarios",
    teamSubtitle: "Agregue colaboradores con sus respectivos roles. Este paso es opcional.",
    emailEyebrow: "Integraciones",
    emailTitle: "Configuración de correo",
    emailSubtitle: "Vincule su buzón corporativo para sincronizar comunicaciones con candidatos.",
    doneTitle: "Configuración completada",
    doneSubtitle: "Su cuenta está lista para operar. Acceda al panel principal para comenzar.",
  },
  educational: {
    welcomeEyebrow: "Paso 0 · Bienvenida",
    welcomeTitle: "Vamos a entender qué tipo de cuenta necesitas",
    welcomeSubtitle: "Cada tipo de cuenta tiene flujos optimizados — un reclutador independiente trabaja distinto a una agencia. Elige el que más se parezca a ti.",
    companyEyebrow: "Por qué pedimos esto",
    companyTitle: "Datos de tu empresa",
    companyTitleIndividual: "Tu información profesional",
    companySubtitle: "El RNC nos permite validar tu empresa con la DGII y aparece en facturas y reportes legales. El sector ayuda al algoritmo a recomendar candidatos similares.",
    companySubtitleIndividual: "Estos datos aparecen en cada correo automático que sale del sistema.",
    brandEyebrow: "Marca · por qué importa",
    brandTitle: "Personaliza tu portal de candidatos",
    brandSubtitle: "Los candidatos confían 3× más en portales que tienen el branding de la empresa. Tu color principal se usa en CTAs, links y headers.",
    profileEyebrow: "Tu identidad",
    profileTitle: "Cómo te van a ver los candidatos",
    profileSubtitle: "Tu foto y cargo aparecen en cada invitación a entrevista. Los candidatos responden 40% más a correos con foto.",
    teamEyebrow: "Colaboración",
    teamTitle: "Construye tu equipo de reclutamiento",
    teamSubtitle: "Los roles definen permisos: Admin ve todo, Reclutador maneja candidatos, Hiring Manager solo ve sus vacantes, Solo lectura es para auditoría.",
    emailEyebrow: "Por qué conectar correo",
    emailTitle: "Sincroniza tu bandeja de entrada",
    emailSubtitle: "Cuando conectas tu correo, podemos asociar respuestas automáticamente a cada candidato y sus correos no caen en spam.",
    doneTitle: "¡Cuenta configurada con éxito!",
    doneSubtitle: "Aprendiste lo básico. Ahora explora el dashboard — cada sección tiene tooltips contextuales si tienes dudas.",
  },
};

const DEFAULT_TWEAKS = {
  tone: "warm",          // warm | formal | educational
  progressStyle: "bar",  // bar | stepper | checklist
  accent: "blue",        // blue | warm | mono
  decoration: "clean",   // clean | pattern | screenshot
};

const ACCENTS = {
  blue: { core: "#2d52a8", deep: "#1a3b88", deepest: "#162e75", aside: "linear-gradient(160deg, #1a3b88 0%, #2d52a8 50%, #4869b6 100%)" },
  warm: { core: "#c8602a", deep: "#a04518", deepest: "#7a3210", aside: "linear-gradient(160deg, #7a3210 0%, #c8602a 55%, #e89868 100%)" },
  mono: { core: "#15203b", deep: "#0a1024", deepest: "#050810", aside: "linear-gradient(160deg, #050810 0%, #15203b 60%, #2a3658 100%)" },
};

const OnboardingWizard = ({ onFinish, isMobile = false, tweaks: tweaksProp = DEFAULT_TWEAKS }) => {
  const t = { ...DEFAULT_TWEAKS, ...tweaksProp };
  const copy = COPY[t.tone] || COPY.warm;
  const accent = ACCENTS[t.accent] || ACCENTS.blue;

  const [step, setStep] = useOnbState(0);
  const [accountType, setAccountType] = useOnbState("company");

  // Apply accent override scoped to wizard
  useOnbEffect(() => {
    let el = document.getElementById("onb-accent-override");
    if (!el) { el = document.createElement("style"); el.id = "onb-accent-override"; document.head.appendChild(el); }
    el.textContent = `
      .onb-scope { --brand-core: ${accent.core}; --brand-deep: ${accent.deep}; --brand-deepest: ${accent.deepest}; --focus-ring: ${accent.core}40; --border: ${accent.core}24; --border-strong: ${accent.core}3a; }
      .onb-scope .btn-primary { background: ${accent.core}; }
      .onb-scope .btn-primary:hover { background: ${accent.deep}; }
    `;
  }, [t.accent]);

  const STEPS = [
    { short: "Bienvenida", required: false, render: () => <StepWelcome accountType={accountType} setAccountType={setAccountType} copy={copy} /> },
    { short: "Empresa", required: true, render: () => <StepCompany accountType={accountType} copy={copy} /> },
    { short: "Marca", required: false, render: () => <StepBrand copy={copy} /> },
    { short: "Perfil", required: false, render: () => <StepProfile copy={copy} /> },
    { short: "Equipo", required: false, render: () => <StepTeam copy={copy} /> },
    { short: "Correo", required: false, render: () => <StepEmail copy={copy} /> },
    { short: "Listo", required: false, render: () => <StepDone copy={copy} onFinish={onFinish} /> },
  ];

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const current = STEPS[step];

  const next = () => { if (step < STEPS.length - 1) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };
  const skip = () => next();

  return (
    <div className="onb-scope" style={{
      minHeight: "100%",
      width: "100%",
      background: t.decoration === "pattern"
        ? `radial-gradient(1200px circle at 20% -10%, ${accent.core}14, transparent 60%), radial-gradient(900px circle at 110% 110%, ${accent.core}10, transparent 50%), var(--bg-wash)`
        : "var(--bg-wash)",
      display: "flex", flexDirection: "column",
      position: "relative",
    }}>
      {/* Optional decorative pattern */}
      {t.decoration === "pattern" && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }}>
          <defs>
            <pattern id="onb-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke={accent.core} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#onb-grid)" />
        </svg>
      )}

      {/* Top bar */}
      <header style={{
        height: isMobile ? 56 : 64,
        padding: isMobile ? "0 16px" : "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(8px)",
        flexShrink: 0,
        position: "relative", zIndex: 2,
      }}>
        <img src="assets/asi-logo-blue.png" alt="ASI" style={{ height: isMobile ? 28 : 36, width: "auto", display: "block", objectFit: "contain" }} />
        {!isLast && (
          <button type="button" onClick={onFinish} style={{
            fontSize: 13, fontWeight: 600, color: "var(--text-muted)",
            background: "transparent", border: 0, cursor: "pointer",
            padding: "8px 12px", borderRadius: 6,
          }}>Saltar onboarding</button>
        )}
      </header>

      {/* Progress */}
      {!isLast && (
        <div style={{
          padding: isMobile ? "16px 16px 0" : "20px 32px 0",
          maxWidth: t.progressStyle === "stepper" ? 880 : 720,
          width: "100%",
          margin: "0 auto",
          position: "relative", zIndex: 2,
        }}>
          <ProgressBar steps={STEPS} current={step} style={t.progressStyle} />
        </div>
      )}

      {/* Content */}
      <main style={{
        flex: 1,
        display: "flex", flexDirection: "column",
        padding: isMobile ? "20px 16px 100px" : "32px 32px 24px",
        maxWidth: 720,
        width: "100%",
        margin: "0 auto",
        position: "relative", zIndex: 2,
      }} className="onb-main">
        <div key={step} style={{ animation: "onbFadeIn 280ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
          {current.render()}
        </div>
      </main>

      {/* Footer / nav */}
      {!isLast && (
        <footer className="onb-footer" style={{
          padding: isMobile ? "12px 16px" : "16px 32px",
          borderTop: "1px solid var(--border)",
          background: "white",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          flexShrink: 0,
          position: isMobile ? "sticky" : "relative",
          bottom: 0,
          zIndex: 3,
        }}>
          <button type="button" onClick={prev} disabled={isFirst} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "10px 14px", fontSize: 14, fontWeight: 600,
            color: isFirst ? "var(--text-subtle)" : "var(--text-muted)",
            background: "transparent", border: 0,
            cursor: isFirst ? "not-allowed" : "pointer",
            opacity: isFirst ? 0.4 : 1,
            borderRadius: 6,
          }}>
            <Icon name="chevron-left" size={16} /> Atrás
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!current.required && step > 0 && (
              <button type="button" onClick={skip} className="btn btn-ghost btn-sm onb-skip-btn">Saltar este paso</button>
            )}
            <button type="button" onClick={next} className="btn btn-primary" style={{ height: 44, padding: "0 22px", fontSize: 14, fontWeight: 600 }}>
              {step === STEPS.length - 2 ? "Finalizar" : "Continuar"} <Icon name="arrow-right" size={15} />
            </button>
          </div>
        </footer>
      )}

      <style>{`
        @keyframes onbFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 720px) {
          .onb-grid-2 { grid-template-columns: 1fr !important; }
          .onb-team-row { grid-template-columns: 1fr 130px auto !important; gap: 6px !important; }
          .onb-title { font-size: 22px !important; }
          .onb-subtitle { font-size: 14px !important; }
          .onb-step-label { display: none !important; }
          .onb-tour-list { gap: 6px !important; }
          .onb-skip-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
};

// ============================================================
// Variation B: Checklist on dashboard
// ============================================================

const OnboardingChecklist = ({ onDismiss, accent: accentColor = "#2d52a8" }) => {
  const items = [
    { id: "company", title: "Datos de tu empresa", desc: "RNC, sector, tamaño y ubicación.", time: "2 min", done: true, icon: "office" },
    { id: "brand", title: "Logo y colores", desc: "Personaliza el portal de candidatos.", time: "1 min", done: true, icon: "image" },
    { id: "profile", title: "Tu perfil", desc: "Foto, cargo y teléfono.", time: "1 min", done: false, icon: "user" },
    { id: "team", title: "Invitar al equipo", desc: "Agrega reclutadores y hiring managers.", time: "2 min", done: false, icon: "users" },
    { id: "email", title: "Conectar correo", desc: "Sincroniza Gmail u Outlook.", time: "1 min", done: false, icon: "mail" },
    { id: "first-job", title: "Publicar tu primera vacante", desc: "Crea una oferta y compártela.", time: "3 min", done: false, icon: "briefcase" },
  ];
  const completed = items.filter(i => i.done).length;
  const pct = (completed / items.length) * 100;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", border: `1px solid ${accentColor}22` }}>
      <div style={{
        padding: "20px 22px",
        background: `linear-gradient(135deg, ${accentColor}10, ${accentColor}04)`,
        borderBottom: `1px solid ${accentColor}18`,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: accentColor, textTransform: "uppercase", marginBottom: 6 }}>
              <Icon name="zap" size={12} /> Configuración
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Termina de configurar tu cuenta</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.45 }}>Has completado {completed} de {items.length} pasos. Solo te toma unos minutos más.</p>
          </div>
          <button onClick={onDismiss} className="btn-icon" aria-label="Ocultar"><Icon name="x" size={16} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: `${accentColor}18`, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: accentColor, transition: "width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}></div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</div>
        </div>
      </div>

      <div style={{ padding: "8px 0" }}>
        {items.map((it, i) => (
          <button key={it.id} type="button" style={{
            width: "100%",
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 22px",
            background: "transparent", border: 0,
            cursor: "pointer", textAlign: "left",
            borderTop: i > 0 ? "1px solid var(--border)" : "0",
            transition: "background 120ms ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-wash)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: it.done ? `2px solid #1f8a5a` : `2px solid ${accentColor}3a`,
              background: it.done ? "#1f8a5a" : "white",
              color: it.done ? "white" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              {it.done && <Icon name="check" size={14} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textDecoration: it.done ? "line-through" : "none", opacity: it.done ? 0.6 : 1, marginBottom: 1 }}>{it.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{it.desc}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-subtle)", fontVariantNumeric: "tabular-nums" }}>{it.time}</span>
              {!it.done && <span style={{ color: accentColor }}><Icon name="chevron-right" size={16} /></span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

window.OnboardingWizard = OnboardingWizard;
window.OnboardingChecklist = OnboardingChecklist;
