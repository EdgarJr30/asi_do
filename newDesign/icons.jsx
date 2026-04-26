/* global React */
// Icon component — inline SVG, single source of truth.
// All icons 1.5px stroke, 20px viewBox, currentColor.

const Icon = ({ name, size = 20, ...rest }) => {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...rest,
  };
  switch (name) {
    case "dashboard":
      return (<svg {...props}><rect x="2.5" y="2.5" width="6.5" height="8" rx="1.4"/><rect x="2.5" y="13" width="6.5" height="4.5" rx="1.4"/><rect x="11" y="2.5" width="6.5" height="4.5" rx="1.4"/><rect x="11" y="9.5" width="6.5" height="8" rx="1.4"/></svg>);
    case "briefcase":
      return (<svg {...props}><rect x="2.5" y="5.5" width="15" height="11" rx="1.6"/><path d="M7 5.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 4v1.5"/><path d="M2.5 10h15"/></svg>);
    case "users":
      return (<svg {...props}><circle cx="7.5" cy="7" r="3"/><path d="M2 16.5a5.5 5.5 0 0 1 11 0"/><path d="M13 4.5a3 3 0 0 1 0 5.6"/><path d="M14 16.5a5.5 5.5 0 0 0-1.5-3.8"/></svg>);
    case "kanban":
      return (<svg {...props}><rect x="2.5" y="2.5" width="4" height="15" rx="1"/><rect x="8" y="2.5" width="4" height="10" rx="1"/><rect x="13.5" y="2.5" width="4" height="7" rx="1"/></svg>);
    case "chart":
      return (<svg {...props}><path d="M3 17h14"/><path d="M5.5 14V9.5"/><path d="M9 14V6"/><path d="M12.5 14v-6"/><path d="M16 14V4"/></svg>);
    case "settings":
      return (<svg {...props}><circle cx="10" cy="10" r="2.5"/><path d="M16.2 11.6l1.5.8-1 1.7-1.6-.5a5.5 5.5 0 0 1-1.6.9l-.3 1.7h-2l-.3-1.7a5.5 5.5 0 0 1-1.6-.9l-1.6.5-1-1.7 1.5-.8a5.5 5.5 0 0 1 0-1.8l-1.5-.8 1-1.7 1.6.5a5.5 5.5 0 0 1 1.6-.9l.3-1.7h2l.3 1.7a5.5 5.5 0 0 1 1.6.9l1.6-.5 1 1.7-1.5.8a5.5 5.5 0 0 1 0 1.8z"/></svg>);
    case "search":
      return (<svg {...props}><circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/></svg>);
    case "bell":
      return (<svg {...props}><path d="M5 8a5 5 0 0 1 10 0v3l1.5 3h-13L5 11z"/><path d="M8 16.5a2 2 0 0 0 4 0"/></svg>);
    case "chevron-down":
      return (<svg {...props}><path d="m5 7.5 5 5 5-5"/></svg>);
    case "chevron-right":
      return (<svg {...props}><path d="m7.5 5 5 5-5 5"/></svg>);
    case "chevron-left":
      return (<svg {...props}><path d="m12.5 5-5 5 5 5"/></svg>);
    case "chevron-up":
      return (<svg {...props}><path d="m5 12.5 5-5 5 5"/></svg>);
    case "plus":
      return (<svg {...props}><path d="M10 4v12M4 10h12"/></svg>);
    case "x":
      return (<svg {...props}><path d="m5 5 10 10M15 5 5 15"/></svg>);
    case "filter":
      return (<svg {...props}><path d="M3 5h14l-5.5 7v4l-3 1.5V12L3 5z"/></svg>);
    case "more":
      return (<svg {...props}><circle cx="5" cy="10" r="1.2" fill="currentColor"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/></svg>);
    case "menu":
      return (<svg {...props}><path d="M3 5h14M3 10h14M3 15h14"/></svg>);
    case "mail":
      return (<svg {...props}><rect x="2.5" y="4.5" width="15" height="11" rx="1.5"/><path d="m3 6 7 5 7-5"/></svg>);
    case "phone":
      return (<svg {...props}><path d="M5 3h2l1.5 4-2 1a8 8 0 0 0 5.5 5.5l1-2 4 1.5v2a2 2 0 0 1-2 2 13 13 0 0 1-12-12 2 2 0 0 1 2-2z"/></svg>);
    case "map-pin":
      return (<svg {...props}><path d="M10 17s5-5.5 5-9.5a5 5 0 0 0-10 0c0 4 5 9.5 5 9.5z"/><circle cx="10" cy="7.5" r="1.8"/></svg>);
    case "calendar":
      return (<svg {...props}><rect x="2.5" y="4" width="15" height="13" rx="1.5"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3"/></svg>);
    case "star":
      return (<svg {...props}><path d="m10 2.5 2.4 5 5.4.8-3.9 3.8 1 5.4L10 15l-4.9 2.5 1-5.4-3.9-3.8 5.4-.8z"/></svg>);
    case "check":
      return (<svg {...props}><path d="m4 10.5 4 4 8-9"/></svg>);
    case "check-circle":
      return (<svg {...props}><circle cx="10" cy="10" r="7.5"/><path d="m6.5 10 2.5 2.5L14 7.5"/></svg>);
    case "alert":
      return (<svg {...props}><circle cx="10" cy="10" r="7.5"/><path d="M10 6.5v4.5M10 13.5v.5"/></svg>);
    case "info":
      return (<svg {...props}><circle cx="10" cy="10" r="7.5"/><path d="M10 9v4.5M10 6.5v.5"/></svg>);
    case "clock":
      return (<svg {...props}><circle cx="10" cy="10" r="7.5"/><path d="M10 6v4l2.5 2"/></svg>);
    case "drag":
      return (<svg {...props} stroke="none" fill="currentColor"><circle cx="7" cy="5" r="1.2"/><circle cx="13" cy="5" r="1.2"/><circle cx="7" cy="10" r="1.2"/><circle cx="13" cy="10" r="1.2"/><circle cx="7" cy="15" r="1.2"/><circle cx="13" cy="15" r="1.2"/></svg>);
    case "logout":
      return (<svg {...props}><path d="M12 4.5h2.5A1.5 1.5 0 0 1 16 6v8a1.5 1.5 0 0 1-1.5 1.5H12"/><path d="M9 7 6 10l3 3"/><path d="M6 10h8"/></svg>);
    case "eye":
      return (<svg {...props}><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/></svg>);
    case "eye-off":
      return (<svg {...props}><path d="M3 3l14 14"/><path d="M7.5 7.5A2.5 2.5 0 0 0 10 12.5"/><path d="M5 5.5C3 7 2 10 2 10s3 5.5 8 5.5c1.5 0 2.8-.4 4-1"/><path d="M9 4.5c.3 0 .6 0 1 0 5 0 8 5.5 8 5.5s-.7 1.3-2 2.7"/></svg>);
    case "google":
      return (<svg width={size} height={size} viewBox="0 0 20 20" fill="none"><path d="M19.6 10.2c0-.7-.1-1.3-.2-1.9H10v3.6h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z" fill="#4285F4"/><path d="M10 20c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H1.1v2.6A10 10 0 0 0 10 20z" fill="#34A853"/><path d="M4.4 12c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V5.4H1.1A10 10 0 0 0 0 10c0 1.6.4 3.1 1.1 4.6L4.4 12z" fill="#FBBC04"/><path d="M10 4c1.5 0 2.8.5 3.8 1.5l2.9-2.9C14.9 1 12.7 0 10 0 6 0 2.6 2.3 1.1 5.4L4.4 8C5.2 5.7 7.4 4 10 4z" fill="#EA4335"/></svg>);
    case "linkedin":
      return (<svg width={size} height={size} viewBox="0 0 20 20" fill="#0A66C2"><path d="M17 0H3a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V3a3 3 0 0 0-3-3zM6 16H3.5V8H6v8zM4.7 6.7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM17 16h-2.5v-4c0-1-.4-1.7-1.3-1.7s-1.5.6-1.5 1.7v4H9V8h2.5v1c.4-.7 1.4-1.3 2.6-1.3 2 0 3 1.3 3 3.6V16z"/></svg>);
    case "trend-up":
      return (<svg {...props}><path d="m3 14 5-5 3 3 6-6"/><path d="M13 6h4v4"/></svg>);
    case "trend-down":
      return (<svg {...props}><path d="m3 6 5 5 3-3 6 6"/><path d="M13 14h4v-4"/></svg>);
    case "edit":
      return (<svg {...props}><path d="M12.5 4 16 7.5l-9 9H3.5V13z"/><path d="M11 5.5 14.5 9"/></svg>);
    case "trash":
      return (<svg {...props}><path d="M3.5 5.5h13M8 5.5V4a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 12 4v1.5"/><path d="M5 5.5 5.5 17h9L15 5.5"/></svg>);
    case "download":
      return (<svg {...props}><path d="M10 3v9M6 9l4 4 4-4"/><path d="M3.5 16.5h13"/></svg>);
    case "send":
      return (<svg {...props}><path d="m17.5 2.5-15 7 6 2 2 6z"/><path d="m17.5 2.5-9 9"/></svg>);
    default:
      return null;
  }
};

window.Icon = Icon;
