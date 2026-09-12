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

// Array en memoria para guardar e informar incidentes en la nube
const mockIncidentes = [
    {
        id_incidente: 1,
        titulo: "Infección de Ransomware (Modo Cloud)",
        descripcion: "Detección de ejecutable malicioso en servidor principal.",
        fecha_registro: new Date().toISOString()
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
        console.log('Conectado a SQL Server exitosamente.');
    })
    .catch(err => {
        isDbConnected = false;
        console.log('Servidor iniciado en modo Cloud Fallback.');
    });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// GET: Obtener incidentes
app.get('/api/v1/incidentes', async (req, res) => {
    if (isDbConnected) {
        try {
            const result = await sql.query('SELECT * FROM INCIDENTES');
            return res.json(result.recordset);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    } else {
        return res.json(mockIncidentes);
    }
});

// POST: Registrar nuevo incidente desde el formulario
app.post('/api/v1/incidentes', async (req, res) => {
    const { titulo, descripcion } = req.body;
    
    const nuevoIncidente = {
        id_incidente: mockIncidentes.length + 1,
        titulo: titulo || "Amenaza Registrada",
        descripcion: descripcion || "Sin detalle técnico proporcionado",
        fecha_registro: new Date().toISOString()
    };

    if (isDbConnected) {
        try {
            await sql.query(`INSERT INTO INCIDENTES (titulo, descripcion) VALUES ('${nuevoIncidente.titulo}', '${nuevoIncidente.descripcion}')`);
        } catch (err) {
            console.error("Error guardando en BD:", err);
        }
    } else {
        mockIncidentes.unshift(nuevoIncidente);
    }

    // EMISIÓN EN TIEMPO REAL VÍA WEBSOCKETS A TODOS LOS NAVEGADORES CONECTADOS
    io.emit('nuevo_incidente', nuevoIncidente);

    return res.status(201).json({ status: 'ok', data: nuevoIncidente });
});

io.on('connection', (socket) => {
    console.log('Cliente conectado vía WebSockets:', socket.id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});