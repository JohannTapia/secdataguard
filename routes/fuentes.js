const express = require('express');
const router = express.Router();

// READ (GET)
router.get('/', (req, res) => {
    res.json(req.app.get('mockFuentes') || []);
});

// CREATE (POST)
router.post('/', (req, res) => {
    const { nombre_fuente, direccion_ip } = req.body;
    let mockFuentes = req.app.get('mockFuentes') || [];
    const nextId = mockFuentes.length > 0 ? Math.max(...mockFuentes.map(f => f.fuente_id)) + 1 : 1;

    const nuevaFuente = {
        fuente_id: nextId,
        nombre_fuente: nombre_fuente || "Sensor de Red",
        direccion_ip: direccion_ip || "127.0.0.1"
    };

    mockFuentes.push(nuevaFuente);
    req.app.set('mockFuentes', mockFuentes);
    return res.status(201).json({ status: 'ok', data: nuevaFuente });
});

// UPDATE (PUT)
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { nombre_fuente, direccion_ip } = req.body;
    let mockFuentes = req.app.get('mockFuentes') || [];

    let fuente = mockFuentes.find(f => f.fuente_id == id);
    if (!fuente) return res.status(404).json({ status: 'error', message: 'Fuente no encontrada' });

    if (nombre_fuente) fuente.nombre_fuente = nombre_fuente;
    if (direccion_ip) fuente.direccion_ip = direccion_ip;

    return res.json({ status: 'ok', message: 'Fuente actualizada', data: fuente });
});

// DELETE (DELETE)
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    let mockFuentes = req.app.get('mockFuentes') || [];
    mockFuentes = mockFuentes.filter(f => f.fuente_id != id);
    req.app.set('mockFuentes', mockFuentes);
    return res.json({ status: 'ok', message: 'Fuente eliminada' });
});

module.exports = router;