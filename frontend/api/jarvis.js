export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const { message, registros = [], history = [] } = req.body || {};
    if (!message) return res.status(400).json({ error: 'Falta message' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(200).json({ mode: 'local', reply: 'Jarvis está en modo local. Falta configurar OPENAI_API_KEY en Vercel para activar GPT real.' });
    const system = `Eres Jarvis GPT HNF, asistente estratégico y operativo de Hernan Navarro para HNF Servicios Integrales Chile. Responde breve, ejecutivo y accionable. Contexto: áreas Clima, Flota, Obras Civiles/SSGG y Lavado. Reglas: toda OT debe tener cliente, precio, costo, responsable y tiempo. Obras Civiles lo gestiona Emerson Silva. Lavado Tattersall Casa Matriz lo gestiona Andrés Celis. Clima lo gestiona Andrés Vilches. Bernabé Villegas y Yohonatan/Yohnatan Castillo están desvinculados y no deben asignarse. Flujo: solicitud, OT, evidencia, aprobación Hernan/Lyn, EDP, factura y cierre. Prioridad: cerrar, cobrar, facturar, controlar margen y no perder trazabilidad.`;
    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Registros actuales JSON resumido: ${JSON.stringify(registros).slice(0, 12000)}` },
        ...history.slice(-8),
        { role: 'user', content: message }
      ],
      temperature: 0.2
    };
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content || 'No pude generar respuesta GPT.';
    return res.status(200).json({ mode: 'gpt', reply });
  } catch (e) {
    return res.status(500).json({ error: 'Error Jarvis API', detail: e.message });
  }
}
