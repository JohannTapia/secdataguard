const express = require('express');
const router = express.Router();

// READ (GET)
router.get('/', (req, res) => {
    res.json(req.app.get('mockCategorias') || []);
});

// CREATE (POST)
router.post('/', (req, res) => {
    const { nombre_categoria, nivel_criticidad } = req.body;
    let mockCategorias = req.app.get('mockCategorias') || [];
    const nextId = mockCategorias.length > 0 ? Math.max(...mockCategorias.map(c => c.categoria_id)) + 1 : 1;

    const nuevaCategoria = {
        categoria_id: nextId,
        nombre_categoria: nombre_categoria || "Nueva Amenaza",
        nivel_criticidad: nivel_criticidad || "Media"
    };

    mockCategorias.push(nuevaCategoria);
    req.app.set('mockCategorias', mockCategorias);
    return res.status(201).json({ status: 'ok', data: nuevaCategoria });
});

// UPDATE (PUT)
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { nombre_categoria, nivel_criticidad } = req.body;
    let mockCategorias = req.app.get('mockCategorias') || [];

    let cat = mockCategorias.find(c => c.categoria_id == id);
    if (!cat) return res.status(404).json({ status: 'error', message: 'Categoría no encontrada' });

    if (nombre_categoria) cat.nombre_categoria = nombre_categoria;
    if (nivel_criticidad) cat.nivel_criticidad = nivel_criticidad;

    return res.json({ status: 'ok', message: 'Categoría actualizada', data: cat });
});

// DELETE (DELETE)
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    let mockCategorias = req.app.get('mockCategorias') || [];
    mockCategorias = mockCategorias.filter(c => c.categoria_id != id);
    req.app.set('mockCategorias', mockCategorias);
    return res.json({ status: 'ok', message: 'Categoría eliminada' });
});

module.exports = router;