const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// CONFIGURACIÓN POWER: Permite todas las conexiones y métodos
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Datos de prueba con lógica de responsables integrada
let ots = [
  { id: 101, cliente: "Inmobiliaria HNF", estado: "Pendiente", precio: 1500000, modulo: "Clima" },
  { id: 102, cliente: "Logística Gery", estado: "En Proceso", precio: 0, modulo: "Flota" }
];

app.get('/api/ots', (req, res) => {
  // Entregamos ordenadas por precio de mayor a menor
  const ordenadas = [...ots].sort((a, b) => b.precio - a.precio);
  res.status(200).json(ordenadas);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor HNF OS activo en puerto ${PORT}`);
});
