import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

const applyHnfProTheme = () => {
  const old = document.getElementById('hnf-pro-force-theme');
  if (old) old.remove();
  const style = document.createElement('style');
  style.id = 'hnf-pro-force-theme';
  style.textContent = `
    body{background:#06111f!important;color:#e5f6ff!important}
    .app{background:radial-gradient(circle at 20% 0%,rgba(34,211,238,.16),transparent 34%),linear-gradient(135deg,#06111f,#020617)!important;color:#e5f6ff!important}
    aside{background:linear-gradient(180deg,#020617,#071526)!important;border-right:1px solid rgba(103,232,249,.35)!important;color:#dff7ff!important;box-shadow:18px 0 60px rgba(0,0,0,.35)!important}
    aside .brand{color:#fff!important;text-shadow:0 0 22px rgba(34,211,238,.42)!important}.brand span{color:#22d3ee!important;text-shadow:0 0 14px rgba(34,211,238,.45)!important}
    aside button{color:#a8c6d9!important;margin:2px 12px!important;border-radius:12px!important;border-left-color:transparent!important;background:transparent!important}
    aside button.active,aside button:hover{background:linear-gradient(90deg,rgba(34,211,238,.22),rgba(37,99,235,.12))!important;color:white!important;border-left-color:#22d3ee!important;box-shadow:0 0 24px rgba(34,211,238,.18),inset 0 0 0 1px rgba(103,232,249,.18)!important}
    aside footer{border-top-color:rgba(103,232,249,.16)!important;color:#8aa4b8!important}main{background:transparent!important;color:#e5f6ff!important}
    main>header,.areas button,.kpis div,.budget,.clients div,.folder,.card,.jarvis,.preview,.rules,.alerts div,.table{background:linear-gradient(145deg,rgba(15,23,42,.94),rgba(8,18,32,.9))!important;color:#e5f6ff!important;border:1px solid rgba(103,232,249,.28)!important;border-radius:18px!important;box-shadow:0 16px 45px rgba(0,0,0,.28),0 0 28px rgba(34,211,238,.10)!important}
    main>header{padding:16px 18px!important;margin-bottom:20px!important}h1,h2,h3,header h2{color:#f8fbff!important}header p,section>p,.head p,.folder span{color:#8aa4b8!important}
    button,.primary{border-color:rgba(103,232,249,.30)!important;background:#0f172a!important;color:#e5f6ff!important}.primary{background:linear-gradient(135deg,#0891b2,#1d4ed8)!important;color:white!important}
    .areas em,.kpis b,.budget b{color:#67e8f9!important;text-shadow:0 0 12px rgba(34,211,238,.25)!important}.table{overflow:auto!important}table{color:#dff7ff!important}thead,th{background:#081827!important;color:#8bdff0!important}td{border-bottom-color:rgba(148,163,184,.12)!important}tr:hover td{background:rgba(34,211,238,.055)!important}
    input,select,textarea{background:#020617!important;color:#e5f6ff!important;border:1px solid rgba(103,232,249,.25)!important;border-radius:12px!important}input:focus,select:focus,textarea:focus{border-color:rgba(103,232,249,.72)!important;box-shadow:0 0 0 3px rgba(34,211,238,.12)!important}
    .badge{border-radius:999px!important;font-weight:900!important}.jarvis:before{content:'HNF IA LOCAL';display:block;color:#67e8f9;font-size:11px;font-weight:900;letter-spacing:.16em;margin-bottom:10px}.danger{background:rgba(127,29,29,.55)!important;color:#fecaca!important}
  `;
  document.body.appendChild(style);
};

requestAnimationFrame(applyHnfProTheme);
setTimeout(applyHnfProTheme, 250);
