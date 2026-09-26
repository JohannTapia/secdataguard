const express = require('express');
const router = express.Router();

// READ (GET)
router.get('/', (req, res) => {
    // Si usas app.js para importar mockIncidentes o DB
    res.json(req.app.get('mockIncidentes') || []);
});

// CREATE (POST)
router.post('/', (req, res) => {
    const { titulo, categoria_id, fuente_id, severidad, descripcion } = req.body;
    let mockIncidentes = req.app.get('mockIncidentes') || [];
    let mockCategorias = req.app.get('mockCategorias') || [];
    let mockFuentes = req.app.get('mockFuentes') || [];

    const catEncontrada = mockCategorias.find(c => c.categoria_id == categoria_id) || { categoria_id: 1, nombre_categoria: 'Inyección SQL' };
    const fuenteEncontrada = mockFuentes.find(f => f.fuente_id == fuente_id) || { fuente_id: 1, nombre_fuente: 'WAF Perimetral' };
    const nextId = mockIncidentes.length > 0 ? Math.max(...mockIncidentes.map(i => i.incidente_id)) + 1 : 100;

    const nuevoIncidente = {
        incidente_id: nextId,
        titulo: titulo || "Amenaza Detectada en Red",
        categoria_id: catEncontrada.categoria_id,
        categoria: catEncontrada.nombre_categoria,
        fuente_id: fuenteEncontrada.fuente_id,
        fuente: fuenteEncontrada.nombre_fuente,
        severidad: severidad || "Alta",
        estado: "ACTIVO",
        descripcion: descripcion || "Vector de ataque aislado por reglas del WAF.",
        fecha_registro: new Date().toISOString()
    };

    mockIncidentes.unshift(nuevoIncidente);
    req.app.set('mockIncidentes', mockIncidentes);

    const io = req.app.get('io');
    if (io) io.emit('nuevo_incidente', nuevoIncidente);

    return res.status(201).json({ status: 'ok', data: nuevoIncidente });
});

// UPDATE (PUT)
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { estado, descripcion } = req.body;
    let mockIncidentes = req.app.get('mockIncidentes') || [];

    let incidente = mockIncidentes.find(i => i.incidente_id == id);
    if (!incidente) return res.status(404).json({ status: 'error', message: 'Incidente no encontrado' });

    if (estado) incidente.estado = estado;
    if (descripcion) incidente.descripcion = descripcion;

    const io = req.app.get('io');
    if (io) io.emit('incidente_actualizado', incidente);

    return res.json({ status: 'ok', message: 'Incidente actualizado', data: incidente });
});

// DELETE (DELETE)
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    let mockIncidentes = req.app.get('mockIncidentes') || [];
    mockIncidentes = mockIncidentes.filter(i => i.incidente_id != id);
    req.app.set('mockIncidentes', mockIncidentes);

    const io = req.app.get('io');
    if (io) io.emit('incidente_eliminado', id);

    return res.json({ status: 'ok', message: 'Incidente eliminado exitosamente' });
});

module.exports = router;