const express = require('express');
const http = require('http');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let isDbConnected = false;

// --------------------------------------------------------------------------
// 1. USUARIOS Y PERFILES DIFERENCIADOS (RBAC) - CRUD USUARIOS
// --------------------------------------------------------------------------
let usuariosMock = [
    { usuario_id: 1, email: 'admin@secdataguard.cl', password: 'admin123', nombre: 'Administrador SOC', rol: 'Administrador', estado: 'Activo' },
    { usuario_id: 2, email: 'analista@secdataguard.cl', password: 'admin123', nombre: 'Analista Operador', rol: 'Analista', estado: 'Activo' },
    { usuario_id: 3, email: 'jtapia@secdataguard.cl', password: 'admin123', nombre: 'Johann Tapia', rol: 'Administrador', estado: 'Activo' }
];

// --------------------------------------------------------------------------
// 2. BASES DE DATOS EN MEMORIA (FALLBACK MOCK PARA RENDER / CLOUD ENGINE)
// --------------------------------------------------------------------------

// CRUD 1: INCIDENTES
let mockIncidentes = [
    {
        incidente_id: 993,
        titulo: "Intento de Inyección SQL Detectado",
        categoria_id: 1,
        categoria: "Inyección SQL",
        fuente_id: 1,
        fuente: "WAF Perimetral",
        severidad: "Alta",
        estado: "ACTIVO",
        descripcion: "Peticiones maliciosas detectadas en endpoint /api/v1/auth. IP de origen bloqueada.",
        fecha_registro: new Date().toISOString()
    },
    {
        incidente_id: 101,
        titulo: "Infección de Ransomware Bloqueada",
        categoria_id: 2,
        categoria: "Malware/Ransomware",
        fuente_id: 2,
        fuente: "EDR Endpoint",
        severidad: "Crítica",
        estado: "MITIGADO",
        descripcion: "Ejecutable malicioso neutralizado en el Servidor de Archivos Principal por el agente EDR.",
        fecha_registro: new Date(Date.now() - 3600000).toISOString()
    }
];

// CRUD 2: CATEGORÍAS DE AMENAZAS
let mockCategorias = [
    { categoria_id: 1, nombre_categoria: "Inyección SQL", nivel_criticidad: "Alta" },
    { categoria_id: 2, nombre_categoria: "Malware/Ransomware", nivel_criticidad: "Crítica" },
    { categoria_id: 3, nombre_categoria: "Ataque DDoS", nivel_criticidad: "Alta" },
    { categoria_id: 4, nombre_categoria: "Acceso No Autorizado", nivel_criticidad: "Media" }
];

// CRUD 3: FUENTES DE DETECCIÓN (SENSORES)
let mockFuentes = [
    { fuente_id: 1, nombre_fuente: "WAF Perimetral", direccion_ip: "192.168.1.254" },
    { fuente_id: 2, nombre_fuente: "EDR Endpoint", direccion_ip: "10.0.0.15" },
    { fuente_id: 3, nombre_fuente: "Firewall L7", direccion_ip: "192.168.1.1" }
];

// Compartir recursos globales con los módulos de la carpeta routes/
app.set('mockIncidentes', mockIncidentes);
app.set('mockCategorias', mockCategorias);
app.set('mockFuentes', mockFuentes);
app.set('usuariosMock', usuariosMock);
app.set('io', io);
app.set('sql', sql);
app.set('getIsDbConnected', () => isDbConnected);

// --------------------------------------------------------------------------
// 3. CONFIGURACIÓN E INTENTO DE CONEXIÓN A SQL SERVER
// --------------------------------------------------------------------------
const dbConfig = {
    user: process.env.DB_USER || 'node_app',
    password: process.env.DB_PASSWORD || 'SecData2026*',
    server: process.env.DB_SERVER || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE || 'secdataguard',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 2000
    }
};

sql.connect(dbConfig)
    .then(() => {
        isDbConnected = true;
        console.log('Conectado a SQL Server local exitosamente.');
    })
    .catch(() => {
        isDbConnected = false;
        console.log('Servidor iniciado en modo Cloud Native (Mock Engine Active) para Render.');
    });

// Ruta Principal Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --------------------------------------------------------------------------
// 4. RUTAS MODULARES DE LA CARPETA routes/ (CRUDs)
// --------------------------------------------------------------------------
const incidentesRoutes = require('./routes/incidentes');
const categoriasRoutes = require('./routes/categorias');
const fuentesRoutes = require('./routes/fuentes');

app.use('/api/v1/incidentes', incidentesRoutes);
app.use('/api/v1/categorias', categoriasRoutes);
app.use('/api/v1/fuentes', fuentesRoutes);

// --------------------------------------------------------------------------
// 5. RUTAS CRUD DE GESTIÓN DE USUARIOS
// --------------------------------------------------------------------------

// Obteners usuarios (READ)
app.get('/api/v1/usuarios', (req, res) => {
    res.json(usuariosMock.map(u => ({
        usuario_id: u.usuario_id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
        estado: u.estado || 'Activo'
    })));
});

// Registrar nuevo usuario (CREATE)
app.post('/api/v1/register', (req, res) => {
    const { nombre, email, password, rol } = req.body;
    
    if (!email || !password || !nombre) {
        return res.status(400).json({ status: 'error', message: 'Faltan datos obligatorios.' });
    }

    const existe = usuariosMock.find(u => u.email === email);
    if (existe) {
        return res.status(400).json({ status: 'error', message: 'El correo ya se encuentra registrado.' });
    }

    const nuevoUsuario = {
        usuario_id: Date.now(),
        nombre,
        email,
        password,
        rol: rol || 'Analista',
        estado: 'Activo'
    };

    usuariosMock.push(nuevoUsuario);
    res.status(201).json({
        status: 'ok',
        message: 'Usuario creado exitosamente',
        usuario: { usuario_id: nuevoUsuario.usuario_id, nombre, email, rol: nuevoUsuario.rol }
    });
});

// Cambiar estado / Bloquear usuario (UPDATE)
app.patch('/api/v1/usuarios/:id/estado', (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    
    const usuario = usuariosMock.find(u => u.usuario_id == id);
    if (usuario) {
        usuario.estado = estado;
        return res.json({ status: 'ok', message: `Estado actualizado a ${estado}`, usuario });
    }
    res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
});

// Eliminar usuario (DELETE)
app.delete('/api/v1/usuarios/:id', (req, res) => {
    const { id } = req.params;
    usuariosMock = usuariosMock.filter(u => u.usuario_id != id);
    res.json({ status: 'ok', message: 'Usuario eliminado del sistema.' });
});

// --------------------------------------------------------------------------
// 6. AUTENTICACIÓN (RBAC) Y COMPATIBILIDAD HEREDADA
// --------------------------------------------------------------------------
app.post('/api/v1/login', (req, res) => {
    const { email, password } = req.body;
    const user = usuariosMock.find(u => u.email === email && u.password === password);

    if (user) {
        if (user.estado === 'Bloqueado') {
            return res.status(403).json({ status: 'error', message: 'Esta cuenta se encuentra suspendida o bloqueada.' });
        }
        return res.json({
            status: 'ok',
            message: 'Autenticación exitosa',
            usuario: { usuario_id: user.usuario_id, nombre: user.nombre, email: user.email, rol: user.rol, estado: user.estado }
        });
    } else {
        return res.status(401).json({ status: 'error', message: 'Credenciales inválidas o cuenta inexistente.' });
    }
});

// Endpoints heredados
app.get('/api/incidentes', (req, res) => res.json(app.get('mockIncidentes')));
app.post('/api/incidentes', (req, res) => {
    req.url = '/api/v1/incidentes';
    return app._router.handle(req, res);
});

// WebSockets
io.on('connection', (socket) => {
    console.log('Cliente SOC conectado vía WebSockets:', socket.id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SecDataGuard ejecutándose en puerto ${PORT}`);
});