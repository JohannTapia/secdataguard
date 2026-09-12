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

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Estado de conexión a BD
let isDbConnected = false;

// Datos Mock para cuando la base de datos cloud no esté disponible
const mockIncidentes = [
    {
        id_incidente: 1,
        titulo: "Infección de Ransomware (Modo Cloud)",
        descripcion: "Detección de ejecutable malicioso en servidor principal.",
        id_categoria: 1,
        id_usuario_registra: 1,
        fecha_registro: new Date().toISOString()
    }
];

// Configuración de conexión
const dbConfig = {
    user: process.env.DB_USER || 'node_app',
    password: process.env.DB_PASSWORD || 'SecData2026*',
    server: process.env.DB_SERVER || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE || 'secdataguard',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000 // Timeout corto para no congelar la app
    }
};

// Intento de conexión
sql.connect(dbConfig)
    .then(() => {
        isDbConnected = true;
        console.log('Conectado a SQL Server exitosamente.');
    })
    .catch(err => {
        isDbConnected = false;
        console.log('Servidor iniciado en modo Cloud Fallback (Sin SQL Server local).');
    });

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint API REST: Obtener incidentes
app.get('/api/v1/incidentes', async (req, res) => {
    if (isDbConnected) {
        try {
            const result = await sql.query('SELECT * FROM INCIDENTES');
            return res.json(result.recordset);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    } else {
        // Respuesta fallback para la nube
        return res.json(mockIncidentes);
    }
});

// WebSockets
io.on('connection', (socket) => {
    console.log('Cliente conectado vía WebSockets:', socket.id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});