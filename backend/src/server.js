const express = require('express');
const cors = require('cors');
const app = express();

// CONFIGURACIÓN DE PODER: Permite que Vercel y tu iPad se conecten sin errores
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Base de datos de prueba (Sincronizada con tu equipo)
let ots = [
  { id: 101, cliente: "Inmobiliaria HNF", estado: "Pendiente", precio: 2500000, modulo: "Clima", fecha: new Date() },
  { id: 102, cliente: "Logística Central", estado: "En Proceso", precio: 0, modulo: "Flota", fecha: new Date() }
];

// Endpoints solicitados
app.get('/api/health', (req, res) => res.json({ status: "ok", db: "connected" }));

app.get('/api/ots', (req, res) => {
  res.json(ots);
});

app.post('/api/ots', (req, res) => {
  const nuevaOT = { ...req.body, id: Date.now(), fecha: new Date() };
  ots.push(nuevaOT);
  res.status(201).json(nuevaOT);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HNF Backend activo en puerto ${PORT}`);
});
