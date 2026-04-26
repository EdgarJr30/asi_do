/* eslint-disable no-unused-vars, no-undef */
/* global React */
// Mock data for the ASI ATS — Spanish, Dominican Republic context

const POSITIONS = [
  { id: "p1", title: "Desarrollador Full-Stack Senior", dept: "Tecnología", location: "Santo Domingo", type: "Tiempo completo", applicants: 47, openSince: "Hace 12 días", status: "Activa" },
  { id: "p2", title: "Gerente de Operaciones", dept: "Operaciones", location: "Santiago", type: "Tiempo completo", applicants: 23, openSince: "Hace 6 días", status: "Activa" },
  { id: "p3", title: "Diseñador UX/UI", dept: "Producto", location: "Remoto", type: "Tiempo completo", applicants: 31, openSince: "Hace 18 días", status: "Activa" },
  { id: "p4", title: "Analista Financiero", dept: "Finanzas", location: "Santo Domingo", type: "Tiempo completo", applicants: 14, openSince: "Hace 3 días", status: "Activa" },
  { id: "p5", title: "Coordinador de RR.HH.", dept: "Recursos Humanos", location: "Santo Domingo", type: "Medio tiempo", applicants: 19, openSince: "Hace 22 días", status: "Pausada" },
  { id: "p6", title: "Ejecutivo de Ventas B2B", dept: "Ventas", location: "Punta Cana", type: "Tiempo completo", applicants: 28, openSince: "Hace 9 días", status: "Activa" },
];

const STAGES = [
  { id: "applied", label: "Aplicaron", color: "applied" },
  { id: "screening", label: "Filtro inicial", color: "screening" },
  { id: "interview", label: "Entrevista", color: "interview" },
  { id: "test", label: "Prueba técnica", color: "test" },
  { id: "offer", label: "Oferta", color: "offer" },
  { id: "hired", label: "Contratado", color: "hired" },
];

// Avatar gradient palette — brand-anchored
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #2d52a8, #4869b6)",
  "linear-gradient(135deg, #1a3b88, #4869b6)",
  "linear-gradient(135deg, #6f88c3, #2d52a8)",
  "linear-gradient(135deg, #214494, #6f88c3)",
  "linear-gradient(135deg, #4869b6, #8aa2d8)",
  "linear-gradient(135deg, #2d52a8, #1a3b88)",
  "linear-gradient(135deg, #5a76c4, #1a3b88)",
  "linear-gradient(135deg, #3a5db0, #6f88c3)",
];

const initials = (name) => name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
const avatarBg = (id) => AVATAR_GRADIENTS[Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_GRADIENTS.length];

const CANDIDATES = [
  { id: "c1", name: "María Fernández Peña", position: "Desarrollador Full-Stack Senior", positionId: "p1", stage: "interview", score: 92, applied: "Hace 5 días", location: "Santo Domingo", email: "maria.fernandez@gmail.com", phone: "+1 809 555 0142", source: "LinkedIn", experience: "7 años", daysInStage: 3 },
  { id: "c2", name: "Carlos Mateo Rodríguez", position: "Diseñador UX/UI", positionId: "p3", stage: "screening", score: 86, applied: "Hace 2 días", location: "Santiago", email: "c.mateo@outlook.com", phone: "+1 829 555 0193", source: "Referido", experience: "4 años", daysInStage: 1 },
  { id: "c3", name: "Ana Sofía Reyes", position: "Gerente de Operaciones", positionId: "p2", stage: "offer", score: 95, applied: "Hace 12 días", location: "Santo Domingo", email: "ana.reyes@gmail.com", phone: "+1 809 555 0271", source: "Portal de empleo", experience: "9 años", daysInStage: 2 },
  { id: "c4", name: "Luis Manuel Jiménez", position: "Desarrollador Full-Stack Senior", positionId: "p1", stage: "test", score: 88, applied: "Hace 8 días", location: "Santiago", email: "luis.jimenez@hotmail.com", phone: "+1 849 555 0309", source: "LinkedIn", experience: "5 años", daysInStage: 4 },
  { id: "c5", name: "Patricia Núñez Almonte", position: "Analista Financiero", positionId: "p4", stage: "applied", score: 78, applied: "Hace 1 día", location: "Santo Domingo", email: "p.nunez@gmail.com", phone: "+1 809 555 0428", source: "Portal de empleo", experience: "3 años", daysInStage: 1 },
  { id: "c6", name: "Roberto Santana", position: "Ejecutivo de Ventas B2B", positionId: "p6", stage: "interview", score: 82, applied: "Hace 4 días", location: "Punta Cana", email: "roberto.santana@gmail.com", phone: "+1 809 555 0556", source: "Referido", experience: "6 años", daysInStage: 2 },
  { id: "c7", name: "Génesis Polanco Tavárez", position: "Diseñador UX/UI", positionId: "p3", stage: "applied", score: 81, applied: "Hace 1 día", location: "Remoto", email: "genesis.polanco@gmail.com", phone: "+1 829 555 0617", source: "Behance", experience: "3 años", daysInStage: 1 },
  { id: "c8", name: "Daniel Eduardo Rosario", position: "Desarrollador Full-Stack Senior", positionId: "p1", stage: "screening", score: 84, applied: "Hace 3 días", location: "Santo Domingo", email: "d.rosario@gmail.com", phone: "+1 809 555 0788", source: "GitHub", experience: "5 años", daysInStage: 2 },
];

const ACTIVITY = [
  { id: "a1", who: "Tú", action: "moviste a", target: "Ana Sofía Reyes", to: "Oferta", when: "hace 18 min", type: "stage" },
  { id: "a2", who: "Carla M.", action: "agregó nota a", target: "Luis Manuel Jiménez", when: "hace 1 h", type: "note" },
  { id: "a3", who: "Sistema", action: "programó entrevista con", target: "María Fernández", when: "hace 2 h", type: "event" },
  { id: "a4", who: "Tú", action: "publicaste", target: "Analista Financiero", when: "hace 3 h", type: "post" },
  { id: "a5", who: "Pedro G.", action: "calificó a", target: "Roberto Santana — 82%", when: "hace 5 h", type: "score" },
  { id: "a6", who: "Sistema", action: "recibió aplicación de", target: "Génesis Polanco", when: "hace 8 h", type: "apply" },
];

const FUNNEL = [
  { stage: "Aplicaron", count: 162, pct: 100 },
  { stage: "Filtro inicial", count: 84, pct: 52 },
  { stage: "Entrevista", count: 41, pct: 25 },
  { stage: "Prueba técnica", count: 22, pct: 14 },
  { stage: "Oferta", count: 9, pct: 6 },
  { stage: "Contratado", count: 5, pct: 3 },
];

window.MOCK = { POSITIONS, STAGES, CANDIDATES, ACTIVITY, FUNNEL, initials, avatarBg };
