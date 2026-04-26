/* global React, Icon */

const { useState: useStateAuth } = React;

const AuthShell = ({ children, title, subtitle }) => (
  <div style={{
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    background: "var(--bg-wash)",
  }} className="auth-shell">
    {/* Left: form */}
    <div style={{ display: "flex", flexDirection: "column", padding: "40px 56px", overflow: "auto" }} className="auth-form-side">
      <div style={{ marginBottom: 40 }}>
        <img src="assets/asi-logo-blue.png" alt="ASI Rep. Dominicana" className="auth-logo" style={{ height: 48, width: "auto", display: "block", objectFit: "contain" }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 400, width: "100%", margin: "0 auto" }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 28, lineHeight: 1.5 }}>{subtitle}</p>
        {children}
      </div>

      <div style={{ fontSize: 12, color: "var(--text-subtle)", textAlign: "center", marginTop: 32 }}>
        © 2026 ASI Rep. Dominicana · <a href="#" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Privacidad</a> · <a href="#" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Términos</a>
      </div>
    </div>

    {/* Right: brand panel */}
    <div className="auth-brand-side" style={{
      background: "linear-gradient(135deg, #1a3b88 0%, #2d52a8 50%, #4869b6 100%)",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "56px",
      color: "white",
    }}>
      {/* Decorative grid */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.08 }}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Glow */}
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(138, 162, 216, 0.4), transparent 70%)", top: -150, right: -150 }}></div>
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255, 255, 255, 0.12), transparent 70%)", bottom: -100, left: -100 }}></div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,0.10)", borderRadius: 999, fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", border: "1px solid rgba(255,255,255,0.16)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#65d99e" }}></span>
          ATS · Edición 2026
        </div>
        <img src="assets/asi-logo-white.png" alt="ASI" style={{ height: 56, width: "auto", objectFit: "contain", opacity: 0.95 }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 460 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 18 }}>
          Talento que mueve a República Dominicana.
        </div>
        <p style={{ fontSize: 15, opacity: 0.78, lineHeight: 1.55, marginBottom: 32 }}>
          La plataforma operativa para gestionar vacantes, candidatos y procesos de contratación en una sola vista.
        </p>

        {/* Mini stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { value: "12,4k", label: "Candidatos" },
            { value: "340", label: "Empresas" },
            { value: "98%", label: "Uptime" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "14px 14px", background: "rgba(255,255,255,0.08)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(6px)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 11.5, opacity: 0.7 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, fontSize: 12, opacity: 0.55 }}>
        Diseñado para equipos de RR.HH. en el Caribe.
      </div>
    </div>
  </div>
);

const FieldLabel = ({ children }) => (
  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, display: "block", letterSpacing: "-0.005em" }}>{children}</label>
);

const Login = ({ onLogin, onGoToRegister }) => {
  const [email, setEmail] = useStateAuth("maria.reyes@asi.com.do");
  const [password, setPassword] = useStateAuth("••••••••");
  const [showPw, setShowPw] = useStateAuth(false);
  const [remember, setRemember] = useStateAuth(true);

  return (
    <AuthShell title="Bienvenida de vuelta" subtitle="Inicia sesión para gestionar tus procesos de contratación.">
      <form onSubmit={(e) => { e.preventDefault(); onLogin(); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button type="button" className="btn btn-secondary" style={{ height: 44, fontSize: 14 }}>
          <Icon name="google" size={18} /> Continuar con Google
        </button>
        <button type="button" className="btn btn-secondary" style={{ height: 44, fontSize: 14 }}>
          <Icon name="linkedin" size={18} /> Continuar con LinkedIn
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }}></div>
          <span style={{ fontSize: 11, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>o continúa con</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }}></div>
        </div>

        <div>
          <FieldLabel>Correo corporativo</FieldLabel>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@empresa.com" style={{ height: 44 }} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <FieldLabel>Contraseña</FieldLabel>
            <a href="#" style={{ fontSize: 12, color: "var(--brand-core)", textDecoration: "none", fontWeight: 600 }}>¿Olvidaste tu contraseña?</a>
          </div>
          <div style={{ position: "relative" }}>
            <input className="input" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ height: 44, paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", padding: 6 }}>
              <Icon name={showPw ? "eye-off" : "eye"} size={16} />
            </button>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--brand-core)" }} />
          Mantener sesión iniciada
        </label>

        <button type="submit" className="btn btn-primary" style={{ height: 44, fontSize: 14 }}>Iniciar sesión</button>

        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>
          ¿No tienes una cuenta? <a href="#" onClick={(e) => { e.preventDefault(); onGoToRegister(); }} style={{ color: "var(--brand-core)", fontWeight: 600, textDecoration: "none" }}>Regístrate</a>
        </p>
      </form>
    </AuthShell>
  );
};

const Register = ({ onRegister, onGoToLogin }) => {
  const [step, setStep] = useStateAuth(1);
  return (
    <AuthShell title="Crea tu espacio" subtitle="Configura tu cuenta de ASI ATS en menos de un minuto.">
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {[1, 2].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? "var(--brand-core)" : "var(--border)", transition: "background 200ms" }}></div>
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="auth-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>Nombre</FieldLabel>
              <input className="input" placeholder="María" style={{ height: 44 }} defaultValue="María" />
            </div>
            <div>
              <FieldLabel>Apellido</FieldLabel>
              <input className="input" placeholder="Reyes" style={{ height: 44 }} defaultValue="Reyes" />
            </div>
          </div>
          <div>
            <FieldLabel>Correo corporativo</FieldLabel>
            <input className="input" type="email" placeholder="tu@empresa.com" style={{ height: 44 }} />
          </div>
          <div>
            <FieldLabel>Contraseña</FieldLabel>
            <input className="input" type="password" placeholder="Mínimo 8 caracteres" style={{ height: 44 }} />
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 3, background: i <= 2 ? "var(--brand-core)" : "var(--border)", borderRadius: 2 }}></div>)}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: 44, fontSize: 14, marginTop: 8 }}>Continuar <Icon name="chevron-right" size={16} /></button>
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>
            ¿Ya tienes cuenta? <a href="#" onClick={(e) => { e.preventDefault(); onGoToLogin(); }} style={{ color: "var(--brand-core)", fontWeight: 600, textDecoration: "none" }}>Inicia sesión</a>
          </p>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); onRegister(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel>Nombre de la empresa</FieldLabel>
            <input className="input" placeholder="ASI Rep. Dominicana" style={{ height: 44 }} defaultValue="ASI Rep. Dominicana" />
          </div>
          <div>
            <FieldLabel>Tamaño del equipo</FieldLabel>
            <select className="input" style={{ height: 44 }}>
              <option>1–10 empleados</option>
              <option>11–50 empleados</option>
              <option>51–200 empleados</option>
              <option>201–500 empleados</option>
              <option>500+ empleados</option>
            </select>
          </div>
          <div>
            <FieldLabel>Industria</FieldLabel>
            <select className="input" style={{ height: 44 }}>
              <option>Servicios profesionales</option>
              <option>Tecnología</option>
              <option>Manufactura</option>
              <option>Turismo y hospitalidad</option>
              <option>Finanzas</option>
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer", marginTop: 4 }}>
            <input type="checkbox" defaultChecked style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--brand-core)" }} />
            Acepto los <a href="#" style={{ color: "var(--brand-core)" }}>términos de servicio</a> y la <a href="#" style={{ color: "var(--brand-core)" }}>política de privacidad</a>.
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} style={{ height: 44 }}>Atrás</button>
            <button type="submit" className="btn btn-primary" style={{ height: 44, flex: 1 }}>Crear cuenta</button>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

window.Login = Login;
window.Register = Register;
