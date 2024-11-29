const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./functions/auth'); // Rutas de autenticación

dotenv.config(); // Carga variables de entorno desde .env

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Rutas
app.use('/api/auth', authRoutes);

// Configuración para local o producción
if (process.env.NODE_ENV === 'development') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor local corriendo en http://localhost:${PORT}`);
  });
} else {
  const serverless = require('serverless-http');
  module.exports.handler = serverless(app); // Exporta como función para Netlify
}