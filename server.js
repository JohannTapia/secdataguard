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

// Base de datos en memoria (Cloud Fallback) con datos corporativos de prueba
const usuariosMock = [
    { email: 'analista@secdataguard.cl', password: 'admin123', nombre: 'Analista Principal', rol: 'SOC Level 2' }
];

const mockIncidentes = [
    {
        id_incidente: 101,
        titulo: "Infección de Ransomware Bloqueada",
        categoria: "Malware",
        severidad: "Crítica",
        estado: "Mitigado",
        descripcion: "Ejecutable malicioso neutralizado en el Servidor de Archivos Principal por el agente EDR.",
        fecha_registro: new Date().toISOString()
    },
    {
        id_incidente: 102,
        titulo: "Intento de Inyección SQL (WAF Alert)",
        categoria: "Inyección SQL",
        severidad: "Alta",
        estado: "En Análisis",
        descripcion: "Peticiones maliciosas detectadas en endpoint /api/v1/auth. IP de origen bloqueada.",
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
        connectTimeout: 4000
    }
};

sql.connect(dbConfig)
    .then(() => {
        isDbConnected = true;
        console.log('Conectado a SQL Server local exitosamente.');
    })
    .catch(err => {
        isDbConnected = false;
        console.log('Servidor iniciado en modo Cloud Fallback para Render.');
    });

// Ruta Principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API REST: Obtener Incidentes
app.get('/api/v1/incidentes', async (req, res) => {
    if (isDbConnected) {
        try {
            const result = await sql.query('SELECT * FROM INCIDENTES ORDER BY id_incidente DESC');
            return res.json(result.recordset);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    } else {
        return res.json(mockIncidentes);
    }
});

// API REST: Registrar Nuevo Incidente
app.post('/api/v1/incidentes', async (req, res) => {
    const { titulo, categoria, severidad, descripcion } = req.body;
    
    const nuevoIncidente = {
        id_incidente: Math.floor(100 + Math.random() * 900),
        titulo: titulo || "Amenaza Incalculada",
        categoria: categoria || "General",
        severidad: severidad || "Alta",
        estado: "En Análisis",
        descripcion: descripcion || "Sin detalle adjunto.",
        fecha_registro: new Date().toISOString()
    };

    if (isDbConnected) {
        try {
            await sql.query(`INSERT INTO INCIDENTES (titulo, descripcion) VALUES ('${nuevoIncidente.titulo}', '${nuevoIncidente.descripcion}')`);
        } catch (err) {
            console.error("Error insertando en SQL Server:", err);
        }
    } else {
        mockIncidentes.unshift(nuevoIncidente);
    }

    // Notificar por WebSockets a todos los clientes en tiempo real
    io.emit('nuevo_incidente', nuevoIncidente);

    return res.status(201).json({ status: 'ok', data: nuevoIncidente });
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

// API REST: Crear Cuenta (Registro)
app.post('/api/v1/register', (req, res) => {
    const { nombre, email, password, rol } = req.body;

    const existe = usuariosMock.some(u => u.email === email);
    if (existe) {
        return res.status(400).json({ status: 'error', message: 'El correo electrónico ya se encuentra registrado.' });
    }

    const nuevoUsuario = {
        nombre: nombre || 'Analista Nuevo',
        email,
        password,
        rol: rol || 'Analista SOC Level 1'
    };

    usuariosMock.push(nuevoUsuario);

    return res.status(201).json({
        status: 'ok',
        message: 'Cuenta creada con éxito',
        usuario: { nombre: nuevoUsuario.nombre, email: nuevoUsuario.email, rol: nuevoUsuario.rol }
    });
});

io.on('connection', (socket) => {
    console.log('Cliente SOC conectado vía WebSockets:', socket.id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SecDataGuard backend ejecutándose en puerto ${PORT}`);
});