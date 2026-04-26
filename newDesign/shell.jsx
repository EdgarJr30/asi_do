/* global React, Icon */

const { useState, useEffect, useRef } = React;

// ====================
// Wordmark
// ====================
const Wordmark = ({ collapsed = false, light = false }) => {
  const src = light ? "assets/asi-logo-white.png" : "assets/asi-logo-blue.png";
  if (collapsed) {
    return (
      <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <img src={src} alt="ASI" style={{ width: 60, height: 60, objectFit: "contain", marginTop: -6 }} />
      </div>
    );
  }
  return (
    <img src={src} alt="ASI Rep. Dominicana" style={{ height: 56, width: "auto", display: "block", objectFit: "contain", marginLeft: -6 }} />
  );
};

// ====================
// Sidebar
// ====================
const NAV_GROUPS = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard", items: [
    { id: "overview", label: "Resumen", view: "dashboard" },
    { id: "activity", label: "Mi actividad", view: "dashboard" },
  ]},
  { id: "recruit", icon: "briefcase", label: "Reclutamiento", items: [
    { id: "jobs", label: "Vacantes", view: "jobs" },
    { id: "applications", label: "Aplicaciones", view: "candidates" },
    { id: "candidates", label: "Candidatos", view: "candidates" },
    { id: "talent", label: "Banco de talento", view: "candidates" },
  ]},
  { id: "pipeline", icon: "kanban", label: "Pipeline", items: [
    { id: "kanban", label: "Tablero Kanban", view: "pipeline" },
    { id: "screening", label: "Filtro inicial", view: "pipeline" },
    { id: "interviews", label: "Entrevistas", view: "pipeline" },
    { id: "offers", label: "Ofertas", view: "pipeline" },
  ]},
  { id: "reports", icon: "chart", label: "Reportes", items: [
    { id: "funnel", label: "Embudo de contratación", view: "dashboard" },
    { id: "tth", label: "Tiempo de contratación", view: "dashboard" },
    { id: "sources", label: "Análisis de fuentes", view: "dashboard" },
  ]},
  { id: "settings", icon: "settings", label: "Configuración", items: [
    { id: "company", label: "Perfil de empresa", view: "dashboard" },
    { id: "users", label: "Usuarios y roles", view: "dashboard" },
    { id: "integrations", label: "Integraciones", view: "dashboard" },
    { id: "templates", label: "Plantillas", view: "dashboard" },
  ]},
];

const Sidebar = ({ collapsed, onToggle, currentView, currentItem, onNavigate, mobileOpen, onMobileClose }) => {
  const [openGroups, setOpenGroups] = useState({ dashboard: true, recruit: true, pipeline: true });

  const toggleGroup = (id) => {
    if (collapsed) return;
    setOpenGroups(g => ({ ...g, [id]: !g[id] }));
  };

  const sidebarStyle = {
    width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-w)",
    background: "var(--brand-deepest)",
    color: "white",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    transition: "width 220ms cubic-bezier(0.4, 0, 0.2, 1)",
    flexShrink: 0,
    position: "relative",
    zIndex: 30,
  };

  return (
    <aside style={sidebarStyle} className={mobileOpen ? "sidebar-mobile-open" : ""}>
      {/* Logo header */}
      <div style={{ height: 76, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", padding: collapsed ? 0 : "0 16px 0 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Wordmark collapsed={collapsed} light />
        {!collapsed && (
          <button onClick={onToggle} className="sidebar-collapse-btn" style={{ color: "rgba(255,255,255,0.62)", padding: 6, borderRadius: 6 }} aria-label="Colapsar">
            <Icon name="chevron-left" size={18} />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={onToggle} style={{ color: "rgba(255,255,255,0.62)", padding: "10px 0", margin: "8px 12px 0", borderRadius: 6 }} aria-label="Expandir">
          <Icon name="chevron-right" size={18} />
        </button>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: collapsed ? "12px 8px" : "12px 12px" }}>
        {NAV_GROUPS.map(group => {
          const isOpen = openGroups[group.id];
          const groupActive = group.items.some(i => i.id === currentItem);
          return (
            <div key={group.id} style={{ marginBottom: 4 }}>
              <button
                onClick={() => {
                  if (collapsed) {
                    onNavigate(group.items[0].view, group.items[0].id);
                  } else {
                    toggleGroup(group.id);
                  }
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: collapsed ? 0 : 12,
                  justifyContent: collapsed ? "center" : "space-between",
                  padding: collapsed ? "10px 0" : "9px 10px",
                  borderRadius: 8,
                  color: groupActive ? "white" : "rgba(255,255,255,0.74)",
                  background: groupActive && collapsed ? "rgba(255,255,255,0.08)" : "transparent",
                  transition: "background 120ms ease, color 120ms ease",
                  fontSize: 13.5,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                }}
                title={collapsed ? group.label : ""}
                onMouseEnter={e => { if (!groupActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { if (!groupActive || !collapsed) e.currentTarget.style.background = (groupActive && collapsed) ? "rgba(255,255,255,0.08)" : "transparent"; }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Icon name={group.icon} size={18} />
                  {!collapsed && <span>{group.label}</span>}
                </span>
                {!collapsed && (
                  <span style={{ opacity: 0.5, transition: "transform 200ms ease", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>
                    <Icon name="chevron-down" size={14} />
                  </span>
                )}
              </button>
              {!collapsed && isOpen && (
                <div style={{ paddingLeft: 30, paddingTop: 2, paddingBottom: 4, display: "flex", flexDirection: "column", gap: 1 }}>
                  {group.items.map(item => {
                    const active = item.id === currentItem;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.view, item.id)}
                        style={{
                          textAlign: "left",
                          padding: "7px 12px",
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: active ? 600 : 500,
                          color: active ? "white" : "rgba(255,255,255,0.62)",
                          background: active ? "rgba(255,255,255,0.10)" : "transparent",
                          borderLeft: active ? "2px solid #8aa2d8" : "2px solid transparent",
                          marginLeft: -2,
                          letterSpacing: "-0.005em",
                        }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "white"; } }}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.62)"; } }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User card at bottom */}
      <div style={{ padding: collapsed ? 8 : 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "8px 0" : 8, justifyContent: collapsed ? "center" : "flex-start", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
          <div className="avatar avatar-sm" style={{ background: "linear-gradient(135deg, #4869b6, #8aa2d8)" }}>MR</div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>María Reyes</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Reclutadora Senior</div>
            </div>
          )}
          {!collapsed && (
            <button style={{ color: "rgba(255,255,255,0.55)", padding: 4, borderRadius: 4 }} aria-label="Salir">
              <Icon name="logout" size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

// ====================
// Top navbar
// ====================
const Navbar = ({ breadcrumb, onMobileMenu, onNotifBell }) => {
  const [searchFocus, setSearchFocus] = useState(false);
  return (
    <header style={{
      height: "var(--navbar-h)",
      background: "white",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 24px",
      gap: 16,
      flexShrink: 0,
      zIndex: 20,
    }}>
      {onMobileMenu && (
        <button className="navbar-mobile-menu" onClick={onMobileMenu} style={{ color: "var(--text-muted)", padding: 6, display: "none" }} aria-label="Menú">
          <Icon name="menu" size={20} />
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        {breadcrumb.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: "var(--text-subtle)", fontSize: 13 }}>/</span>}
            <span style={{
              fontSize: 14,
              color: i === breadcrumb.length - 1 ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: i === breadcrumb.length - 1 ? 600 : 500,
              letterSpacing: "-0.005em",
            }}>{b}</span>
          </React.Fragment>
        ))}
      </div>

      <div style={{ position: "relative", width: 280 }} className="navbar-search">
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", pointerEvents: "none" }}>
          <Icon name="search" size={16} />
        </span>
        <input
          className="input"
          placeholder="Buscar candidatos, vacantes…"
          style={{ paddingLeft: 34, height: 36, fontSize: 13, background: searchFocus ? "white" : "var(--bg-wash)" }}
          onFocus={() => setSearchFocus(true)}
          onBlur={() => setSearchFocus(false)}
        />
        <kbd style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 600, padding: "2px 6px", background: "white", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-subtle)", fontFamily: "var(--font-body)" }}>⌘ K</kbd>
      </div>

      <button className="btn-icon" onClick={onNotifBell} aria-label="Notificaciones" style={{ position: "relative" }}>
        <Icon name="bell" size={18} />
        <span style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "#e54972", border: "2px solid white" }}></span>
      </button>

      <div style={{ width: 1, height: 24, background: "var(--border)" }}></div>

      <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 4px 4px", borderRadius: 999, transition: "background 120ms ease" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg-wash)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <div className="avatar avatar-sm" style={{ background: "linear-gradient(135deg, #4869b6, #8aa2d8)" }}>MR</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }} className="navbar-user-name">María R.</span>
        <span style={{ color: "var(--text-subtle)" }}><Icon name="chevron-down" size={14} /></span>
      </button>
    </header>
  );
};

// ====================
// Mobile bottom nav
// ====================
const MobileBottomNav = ({ currentView, onNavigate, onMore }) => {
  const items = [
    { id: "dashboard", label: "Inicio", icon: "dashboard" },
    { id: "jobs", label: "Vacantes", icon: "briefcase" },
    { id: "candidates", label: "Candidatos", icon: "users" },
    { id: "pipeline", label: "Pipeline", icon: "kanban" },
    { id: "more", label: "Más", icon: "more" },
  ];
  return (
    <nav style={{
      height: "var(--bottom-nav-h)",
      background: "white",
      borderTop: "1px solid var(--border)",
      display: "flex",
      alignItems: "stretch",
      flexShrink: 0,
      padding: "4px 0",
    }}>
      {items.map(item => {
        const active = item.id === currentView;
        return (
          <button
            key={item.id}
            onClick={() => item.id === "more" ? onMore() : onNavigate(item.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color: active ? "var(--brand-core)" : "var(--text-muted)",
              fontSize: 10,
              fontWeight: active ? 600 : 500,
              letterSpacing: "-0.005em",
              transition: "color 120ms ease",
            }}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// ====================
// Toast system
// ====================
const ToastContainer = ({ toasts, onDismiss }) => {
  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      zIndex: 1000,
      pointerEvents: "none",
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px 10px 12px",
            background: "white",
            borderRadius: 10,
            boxShadow: "0 10px 28px rgba(15,30,70,0.14), 0 1px 0 var(--border)",
            border: "1px solid var(--border)",
            minWidth: 280,
            maxWidth: 420,
            animation: "toastIn 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            pointerEvents: "auto",
          }}
        >
          <span style={{ color: t.type === "danger" ? "var(--danger-fg)" : t.type === "info" ? "var(--brand-core)" : "var(--success-fg)", flexShrink: 0 }}>
            <Icon name={t.type === "danger" ? "alert" : t.type === "info" ? "info" : "check-circle"} size={18} />
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", flex: 1, lineHeight: 1.35 }}>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} style={{ color: "var(--text-subtle)", padding: 2 }} aria-label="Cerrar">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

// Toast hook
const useToasts = () => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const push = (message, type = "success") => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  const dismiss = (id) => setToasts(t => t.filter(x => x.id !== id));
  return { toasts, push, dismiss };
};

Object.assign(window, { Wordmark, Sidebar, Navbar, MobileBottomNav, ToastContainer, useToasts });
