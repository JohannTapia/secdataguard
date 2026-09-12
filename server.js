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

// Servir archivos estáticos del frontend si existen en la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de conexión a SQL Server
const dbConfig = {
    user: 'node_app',
    password: 'SecData2026*',
    server: '127.0.0.1',
    port: 1433,
    database: 'secdataguard',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Conexión a la base de datos
sql.connect(dbConfig)
    .then(() => console.log('Conectado a SQL Server exitosamente.'))
    .catch(err => console.error('Error conectando a BD:', err));

// Servir la interfaz gráfica principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint API REST: Obtener incidentes
app.get('/api/v1/incidentes', async (req, res) => {
    try {
        const result = await sql.query('SELECT * FROM INCIDENTES');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Evento Socket.IO en tiempo real
io.on('connection', (socket) => {
    console.log('Cliente conectado vía WebSockets:', socket.id);
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});