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
    body{background:#0b0f0d!important;color:#f5f7f4!important}
    .app{background:radial-gradient(circle at 18% 0%,rgba(34,197,94,.10),transparent 32%),linear-gradient(135deg,#0b0f0d,#151a17)!important;color:#f5f7f4!important}
    aside{background:linear-gradient(180deg,#07110c,#0d1812)!important;border-right:1px solid rgba(74,222,128,.22)!important;color:#eef7ef!important;box-shadow:18px 0 60px rgba(0,0,0,.36)!important}
    aside .brand{color:#fff!important;text-shadow:0 0 18px rgba(74,222,128,.28)!important}.brand span{color:#6ee787!important;text-shadow:0 0 12px rgba(74,222,128,.34)!important}
    aside button{color:#b8c7bc!important;margin:2px 12px!important;border-radius:12px!important;border-left-color:transparent!important;background:transparent!important}
    aside button.active,aside button:hover{background:linear-gradient(90deg,rgba(74,222,128,.16),rgba(255,255,255,.035))!important;color:white!important;border-left-color:#6ee787!important;box-shadow:0 0 22px rgba(74,222,128,.13),inset 0 0 0 1px rgba(255,255,255,.07)!important}
    aside footer{border-top-color:rgba(255,255,255,.10)!important;color:#9ca8a0!important}main{background:transparent!important;color:#f5f7f4!important}
    main>header,.areas button,.kpis div,.budget,.clients div,.folder,.card,.jarvis,.preview,.rules,.alerts div,.table{background:linear-gradient(145deg,rgba(25,31,27,.96),rgba(12,16,14,.93))!important;color:#f5f7f4!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:18px!important;box-shadow:0 16px 45px rgba(0,0,0,.25),0 0 24px rgba(74,222,128,.055)!important}
    main>header{padding:16px 18px!important;margin-bottom:20px!important}h1,h2,h3,header h2{color:#f8faf7!important}header p,section>p,.head p,.folder span{color:#87928b!important}
    button,.primary{border-color:rgba(255,255,255,.12)!important;background:#18211b!important;color:#f5f7f4!important}.primary{background:linear-gradient(135deg,#12351f,#0f2418)!important;color:white!important;border-color:rgba(74,222,128,.26)!important}
    .areas em,.kpis b,.budget b{color:#6ee787!important;text-shadow:0 0 10px rgba(74,222,128,.20)!important}.table{overflow:auto!important}table{color:#f5f7f4!important}thead,th{background:#0d1812!important;color:#dce8de!important}td{border-bottom-color:rgba(255,255,255,.09)!important}tr:hover td{background:rgba(74,222,128,.045)!important}
    input,select,textarea{background:#0b0f0d!important;color:#f5f7f4!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:12px!important}input:focus,select:focus,textarea:focus{border-color:rgba(74,222,128,.55)!important;box-shadow:0 0 0 3px rgba(74,222,128,.10)!important}
    .badge{border-radius:999px!important;font-weight:900!important}.jarvis:before{content:'HNF IA LOCAL';display:block;color:#6ee787;font-size:11px;font-weight:900;letter-spacing:.16em;margin-bottom:10px}.danger{background:rgba(127,29,29,.55)!important;color:#fecaca!important}
    .badge[style*='#0891b2'],.badge[style*='rgb(8, 145, 178)']{color:#38bdf8!important;border-color:rgba(56,189,248,.35)!important;background:rgba(56,189,248,.10)!important}
  `;
  document.body.appendChild(style);
};

requestAnimationFrame(applyHnfProTheme);
setTimeout(applyHnfProTheme, 250);
