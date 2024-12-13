require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Google Sheets Setup
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  // Cambia el scope a uno que permita escritura:
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Helper Function: Fetch Data from Google Sheets
async function fetchSheetData(range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: range, // Cambia la hoja dependiendo de lo que necesites
    });
    const rows = response.data.values;

    if (rows.length) {
      const [headers, ...data] = rows;
      return data.map(row => {
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index];
        });
        return rowData;
      });
    } else {
      return [];
    }
  } catch (error) {
    console.error('Error al obtener datos de Google Sheets:', error);
    throw error;
  }
}

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña requeridos.' });
  }

  try {
    const users = await fetchSheetData('festivos'); // Usamos la hoja 'festivos' para el login
    const user = users.find(
      u => u['USUARIOS']?.trim() === username && u['CONTRASEÑAS']?.trim() === password
    );

    if (user) {
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return res.json({ token });
    } else {
      return res.status(401).json({ message: 'Nombre o contraseña invalidos.' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// Verify Token Middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(403).json({ message: 'Token no proporcionado.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Token inválido o expirado.' });
    }
    req.user = decoded;
    next();
  });
}

// Endpoint para obtener opciones del dropdown
app.get('/api/dropdown-options', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'contratista!A1:Z', // Ajusta el rango según sea necesario
    });

    const rows = response.data.values;

    if (rows && rows.length) {
      // Encuentra la primera fila no vacía
      const firstRowWithData = rows.find(row => row.some(cell => cell && cell.trim() !== ''));

      if (firstRowWithData) {
        // Crea las opciones como un array de objetos con 'value' y 'label'
        const formattedData = firstRowWithData
          .filter(value => value && value.trim() !== '') // Filtra celdas no vacías
          .map((value, index) => ({
            value: `col-${index + 1}`,  // Ajusta el valor según lo que necesites
            label: value.trim() || 'Sin valor' // Etiqueta con el valor de la celda
          }));

        return res.json(formattedData); // Responde con los datos correctamente formateados
      } else {
        return res.status(404).json({ message: 'No se encontraron filas con datos para Dropdown.' });
      }
    } else {
      return res.status(404).json({ message: 'La hoja de cálculo está vacía.' });
    }
  } catch (error) {
    console.error('Error al obtener datos para Dropdown:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Endpoint para obtener columnas filtradas
app.post('/api/filtered-columns', async (req, res) => {
  const columnIndices = req.body.columnIndices;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'contratista!A1:ZZ100', // Ajusta el rango de la hoja
    });

    const rows = response.data.values;

    if (rows && rows.length) {
      const selectedNames = [];

      // Filtramos solo el primer valor de cada bloque de 3 columnas
      rows.forEach(row => {
        let groupedColumns = [];
        for (let i = 0; i < row.length; i += 3) {
          // Solo tomamos el primer valor de cada grupo de 3 columnas
          groupedColumns.push(row[i]);
        }
        // Agregar solo el nombre (primer valor) a la lista final
        selectedNames.push(...groupedColumns);
      });

      return res.json({ status: 'success', data: selectedNames });
    } else {
      return res.status(404).json({ status: 'error', message: 'No se encontraron datos' });
    }
  } catch (error) {
    console.error('Error al obtener datos de Google Sheets:', error);
    return res.status(500).json({ status: 'error', message: 'Error al procesar los datos' });
  }
});

app.post('/api/register-records', async (req, res) => {
  const records = req.body;

  // Asegúrate de que el cuerpo de la solicitud contiene datos
  if (!records || records.length === 0) {
    return res.status(400).json({ message: 'No se recibieron registros' });
  }

  try {
    // Procesar los datos y guardarlos en Google Sheets
    const response = await saveDataToSheet(records);
    return res.status(200).json({ status: 'success', message: 'Registros guardados correctamente', data: response });
  } catch (error) {
    console.error('Error al guardar registros:', error);
    return res.status(500).json({ status: 'error', message: 'Error al guardar los registros' });
  }
});

async function saveDataToSheet(data) {
  try {
    const spreadsheetId = SHEET_ID; // Asegúrate de usar tu ID de Google Sheets
    const range = 'registros!A1'; // Asegúrate de que el rango esté configurado correctamente
    const valueInputOption = 'RAW'; // O 'USER_ENTERED'

    const resource = {
      values: data.map(record => [
        record.Contratista,
        record.Transportista,
        record.Fecha,
        record.Nombre,
        record.Entrada,
        record.Salida,
        record.Observaciones
      ]), // Formatea los registros según los datos que quieres guardar
    };

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption,
      resource,
    });

    console.log('Datos guardados con éxito en Google Sheets:', response.data);
    return response.data; // Devolver la respuesta de Google Sheets
  } catch (error) {
    console.error('Error al guardar datos en Google Sheets:', error);
    // Imprime más detalles del error para que puedas ver qué está fallando
    return { status: 'error', message: error.message, details: error.stack };
  }
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});