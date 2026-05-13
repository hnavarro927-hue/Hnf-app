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
    html,body,#root{background:#090c0a!important;color:#f7faf6!important}
    body *{box-sizing:border-box}
    .app{background:#090c0a!important;color:#f7faf6!important}
    aside{background:#060907!important;color:#f7faf6!important;border-right:1px solid rgba(120,255,170,.22)!important;box-shadow:18px 0 60px rgba(0,0,0,.42)!important}
    aside .brand{color:#fff!important;text-shadow:0 0 18px rgba(120,255,170,.25)!important}.brand span{color:#78ffaa!important}
    aside button{background:transparent!important;color:#b8c1ba!important;border-left-color:transparent!important;border-radius:13px!important;margin:2px 12px!important}
    aside button.active,aside button:hover{background:rgba(120,255,170,.10)!important;color:#fff!important;border-left-color:#78ffaa!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07),0 0 20px rgba(120,255,170,.10)!important}
    aside footer{border-top-color:rgba(255,255,255,.10)!important;color:#9ca6a0!important}
    main{background:#101411!important;color:#f7faf6!important}
    main>header{background:#151a17!important;color:#f7faf6!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:20px!important;padding:16px 18px!important;margin-bottom:20px!important;box-shadow:0 16px 45px rgba(0,0,0,.20)!important}
    h1,h2,h3,header h2{color:#ffffff!important}header p,section>p,.head p,.folder span,small{color:#8f9a93!important}
    .areas button,.kpis div,.budget,.clients div,.folder,.card,.jarvis,.preview,.rules,.alerts div,.table{background:#171d19!important;color:#f7faf6!important;border:1px solid rgba(255,255,255,.11)!important;border-radius:18px!important;box-shadow:0 16px 40px rgba(0,0,0,.24)!important}
    .areas button{border-left-width:6px!important}.areas button:hover,.kpis div:hover,.folder:hover,.budget:hover,.clients div:hover{border-color:rgba(120,255,170,.26)!important;box-shadow:0 18px 45px rgba(0,0,0,.28),0 0 24px rgba(120,255,170,.07)!important}
    .areas b,.areas strong,.areas em,.kpis span,.kpis b,.budget b{color:#f7faf6!important}.areas em,.kpis b{color:#78ffaa!important}
    button,.primary{background:#17221a!important;color:#f7faf6!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:12px!important}.primary{background:#10351f!important;border-color:rgba(120,255,170,.28)!important;color:#fff!important}
    .table{overflow:auto!important}table{background:#171d19!important;color:#f7faf6!important}thead,th{background:#0d120f!important;color:#eef6ef!important}td{background:transparent!important;color:#f7faf6!important;border-bottom-color:rgba(255,255,255,.08)!important}tr:hover td{background:rgba(120,255,170,.04)!important}
    input,select,textarea{background:#090c0a!important;color:#f7faf6!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:12px!important}input:focus,select:focus,textarea:focus{outline:none!important;border-color:rgba(120,255,170,.55)!important;box-shadow:0 0 0 3px rgba(120,255,170,.10)!important}
    .badge{border-radius:999px!important;font-weight:900!important}.warn{color:#fbbf24!important}.red{color:#f87171!important}.danger{background:#3b0d0d!important;color:#fecaca!important}
    .badge[style*='#0891b2'],.badge[style*='rgb(8, 145, 178)']{color:#38bdf8!important;border-color:rgba(56,189,248,.38)!important;background:rgba(56,189,248,.10)!important}
    .jarvis:before{content:'HNF IA LOCAL';display:block;color:#78ffaa;font-size:11px;font-weight:900;letter-spacing:.16em;margin-bottom:10px}
  `;
  document.head.appendChild(style);
};

requestAnimationFrame(applyHnfProTheme);
setTimeout(applyHnfProTheme, 250);
setTimeout(applyHnfProTheme, 1000);
setInterval(applyHnfProTheme, 2500);
