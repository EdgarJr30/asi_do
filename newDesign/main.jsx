/* global React, ReactDOM, MOCK,
   Sidebar, Navbar, MobileBottomNav, ToastContainer, useToasts,
   Dashboard, CandidatesList, Pipeline, JobOpenings, CandidatePanel,
   Login, Register, Icon */

const { useState: useStateApp, useEffect: useEffectApp } = React;

const VIEWS = {
  dashboard: { breadcrumb: ["Dashboard", "Resumen"], navItem: "overview" },
  jobs: { breadcrumb: ["Reclutamiento", "Vacantes"], navItem: "jobs" },
  candidates: { breadcrumb: ["Reclutamiento", "Candidatos"], navItem: "candidates" },
  pipeline: { breadcrumb: ["Pipeline", "Tablero Kanban"], navItem: "kanban" },
};

const App = ({ initialView = "dashboard", initialAuth = "app", forceCollapsed = null, isMobile = false, mobileSidebarOpen: mobileSidebarOpenInit = false, embedded = false }) => {
  const [auth, setAuth] = useStateApp(initialAuth); // "login" | "register" | "app"
  const [view, setView] = useStateApp(initialView);
  const [navItem, setNavItem] = useStateApp(VIEWS[initialView]?.navItem || "overview");
  const [collapsed, setCollapsed] = useStateApp(forceCollapsed === null ? false : forceCollapsed);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useStateApp(mobileSidebarOpenInit);
  const [selectedCandidate, setSelectedCandidate] = useStateApp(null);
  const [candidates, setCandidates] = useStateApp(MOCK.CANDIDATES);
  const { toasts, push, dismiss } = useToasts();

  const navigate = (v, item) => {
    setView(v);
    if (item) setNavItem(item);
    else setNavItem(VIEWS[v]?.navItem || "overview");
    setMobileSidebarOpen(false);
  };

  const moveCandidate = (id, newStage) => {
    setCandidates(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (c.stage === newStage) return c;
      const stageObj = MOCK.STAGES.find(s => s.id === newStage);
      push(`${c.name} movido a ${stageObj.label}`, "success");
      return { ...c, stage: newStage, daysInStage: 0 };
    }));
  };

  const advanceCandidate = (c) => {
    const idx = MOCK.STAGES.findIndex(s => s.id === c.stage);
    if (idx < MOCK.STAGES.length - 1) {
      moveCandidate(c.id, MOCK.STAGES[idx + 1].id);
      setSelectedCandidate({ ...c, stage: MOCK.STAGES[idx + 1].id });
    }
  };

  const rejectCandidate = (c) => {
    push(`${c.name} marcado como rechazado`, "danger");
    setSelectedCandidate(null);
  };

  if (auth === "login") {
    return <Login onLogin={() => { setAuth("app"); push("Sesión iniciada como María Reyes", "success"); }} onGoToRegister={() => setAuth("register")} />;
  }
  if (auth === "register") {
    return <Register onRegister={() => { setAuth("app"); push("¡Cuenta creada con éxito!", "success"); }} onGoToLogin={() => setAuth("login")} />;
  }

  const v = VIEWS[view] || VIEWS.dashboard;

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", background: "var(--bg-wash)", overflow: "hidden", position: "relative" }} className={isMobile ? "app-mobile" : ""}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          currentView={view}
          currentItem={navItem}
          onNavigate={navigate}
        />
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && mobileSidebarOpen && (
        <>
          <div onClick={() => setMobileSidebarOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(15, 30, 70, 0.42)", zIndex: 40, animation: "fadeIn 200ms ease" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, zIndex: 41, animation: "slideInRightLeft 240ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
            <Sidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} currentView={view} currentItem={navItem} onNavigate={navigate} />
          </div>
        </>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!isMobile ? (
          <Navbar breadcrumb={v.breadcrumb} onNotifBell={() => push("3 notificaciones nuevas", "info")} />
        ) : (
          <MobileTopBar title={v.breadcrumb[v.breadcrumb.length - 1]} onMenu={() => setMobileSidebarOpen(true)} />
        )}

        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {view === "dashboard" && (
            <Dashboard
              onCandidateClick={setSelectedCandidate}
              onNavigate={navigate}
              onPostJob={() => push("Editor de vacante abierto", "info")}
            />
          )}
          {view === "candidates" && <CandidatesList onCandidateClick={setSelectedCandidate} />}
          {view === "pipeline" && (
            <Pipeline candidates={candidates} onCandidateMove={moveCandidate} onCandidateClick={setSelectedCandidate} />
          )}
          {view === "jobs" && <JobOpenings />}
        </main>

        {isMobile && <MobileBottomNav currentView={view === "candidates" || view === "jobs" || view === "pipeline" || view === "dashboard" ? view : "dashboard"} onNavigate={navigate} onMore={() => setMobileSidebarOpen(true)} />}
      </div>

      {/* Slide-in candidate detail */}
      {selectedCandidate && (
        <CandidatePanel
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onAdvance={() => advanceCandidate(selectedCandidate)}
          onReject={() => rejectCandidate(selectedCandidate)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

const MobileTopBar = ({ title, onMenu }) => (
  <header style={{ height: 56, background: "white", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 12px", gap: 8, flexShrink: 0 }}>
    <button onClick={onMenu} className="btn-icon" aria-label="Menú"><Icon name="menu" size={20} /></button>
    <h2 style={{ flex: 1, fontSize: 16, fontWeight: 700, letterSpacing: "-0.005em" }}>{title}</h2>
    <button className="btn-icon" aria-label="Buscar"><Icon name="search" size={18} /></button>
    <button className="btn-icon" aria-label="Notificaciones" style={{ position: "relative" }}>
      <Icon name="bell" size={18} />
      <span style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "#e54972", border: "2px solid white" }}></span>
    </button>
    <div className="avatar avatar-sm" style={{ background: "linear-gradient(135deg, #4869b6, #8aa2d8)" }}>MR</div>
  </header>
);

window.App = App;
