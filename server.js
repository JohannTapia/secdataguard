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

// Usuarios precargados para Render
const usuariosMock = [
    { email: 'analista@secdataguard.cl', password: 'admin123', nombre: 'Analista Principal', rol: 'SOC Level 2' },
    { email: 'admin@secdataguard.cl', password: 'admin123', nombre: 'Administrador SOC', rol: 'SOC Level 2' },
    { email: 'jtapia@secdataguard.cl', password: 'admin123', nombre: 'Johann Tapia', rol: 'SOC Level 2' }
];

// Base de datos en memoria para Render (Cloud Operations)
let mockIncidentes = [
    {
        incidente_id: 993,
        titulo: "Intento de Inyección SQL Detectado",
        categoria: "Inyección SQL",
        severidad: "Alta",
        estado: "ACTIVO",
        descripcion: "Peticiones maliciosas detectadas en endpoint /api/v1/auth. IP de origen bloqueada.",
        fecha_registro: new Date().toISOString()
    },
    {
        incidente_id: 101,
        titulo: "Infección de Ransomware Bloqueada",
        categoria: "Malware",
        severidad: "Crítica",
        estado: "MITIGADO",
        descripcion: "Ejecutable malicioso neutralizado en el Servidor de Archivos Principal por el agente EDR.",
        fecha_registro: new Date(Date.now() - 3600000).toISOString()
    }
];

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

// Intentar conexión a SQL Server (Si no se puede, usa Cloud Engine sin colapsar)
sql.connect(dbConfig)
    .then(() => {
        isDbConnected = true;
        console.log('Conectado a SQL Server local exitosamente.');
    })
    .catch(err => {
        isDbConnected = false;
        console.log('Servidor iniciado en modo Cloud Native para Render.');
    });

// Ruta Principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API REST: Obtener Incidentes
app.get('/api/v1/incidentes', async (req, res) => {
    if (isDbConnected) {
        try {
            const result = await sql.query('SELECT * FROM INCIDENTES ORDER BY incidente_id DESC');
            return res.json(result.recordset);
        } catch (err) {
            return res.json(mockIncidentes);
        }
    } else {
        return res.json(mockIncidentes);
    }
});

// API REST: Registrar Nuevo Incidente
app.post('/api/v1/incidentes', async (req, res) => {
    const { titulo, categoria, severidad, descripcion } = req.body;
    
    // Generar ID correlativo
    const nextId = mockIncidentes.length > 0 ? Math.max(...mockIncidentes.map(i => i.incidente_id)) + 1 : 100;

    const nuevoIncidente = {
        incidente_id: nextId,
        titulo: titulo || "Amenaza Detectada en Red",
        categoria: categoria || "Inyección SQL",
        severidad: severidad || "Alta",
        estado: "ACTIVO",
        descripcion: descripcion || "Vector de ataque aislado por reglas del WAF.",
        fecha_registro: new Date().toISOString()
    };

    if (isDbConnected) {
        try {
            await sql.query(`
                INSERT INTO INCIDENTES (fecha_registro, categoria_id, fuente_id, usuario_reporta_id, estado, descripcion) 
                VALUES (GETDATE(), 1, 1, 1, 'ACTIVO', '${nuevoIncidente.titulo}: ${nuevoIncidente.descripcion}')
            `);
        } catch (err) {
            console.error("Modo Cloud: Persistiendo en memoria activa.");
        }
    }

    // Guardar siempre en memoria activa para Render
    mockIncidentes.unshift(nuevoIncidente);

    // Transmisión inmediata vía WebSockets a la web
    io.emit('nuevo_incidente', nuevoIncidente);

    return res.status(201).json({ status: 'ok', data: nuevoIncidente });
});

// Endpoints compatibles
app.get('/api/incidentes', (req, res) => res.json(mockIncidentes));
app.post('/api/incidentes', async (req, res) => {
    req.url = '/api/v1/incidentes';
    return app._router.handle(req, res);
});

// API REST: Autenticación (Login)
app.post('/api/v1/login', (req, res) => {
    const { email, password } = req.body;
    const user = usuariosMock.find(u => u.email === email && u.password === password);

    if (user) {
        return res.json({
            status: 'ok',
            message: 'Autenticación exitosa',
            usuario: { nombre: user.nombre, email: user.email, rol: user.rol }
        });
    } else {
        return res.status(401).json({ status: 'error', message: 'Credenciales inválidas o cuenta inexistente.' });
    }
});

// Sockets
io.on('connection', (socket) => {
    console.log('Cliente SOC conectado vía WebSockets:', socket.id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SecDataGuard ejecutándose en puerto ${PORT}`);
});