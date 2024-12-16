require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const sheetsRoutes = require('./routes/sheets');

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
      range: 'contratista!A1:ZZ', // Ajusta el rango según sea necesario
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





// Ruta para obtener los datos
app.get('/api/data', async (req, res) => {
  const RANGE = 'registros!A:G';  // Define el rango de datos

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE, // Ajusta el rango si es necesario
    });

    if (response.data && response.data.values) {
      const [headers, ...rows] = response.data.values;
      const formattedData = rows.map(row =>
        headers.reduce((acc, key, index) => {
          acc[key] = row[index] || null;
          return acc;
        }, {})
      );
      return res.status(200).json(formattedData);  // Responde con los datos procesados
    } else {
      return res.status(200).json([]);  // Si no hay datos, devuelve un array vacío
    }
  } catch (error) {
    console.error('Error al obtener los datos de Google Sheets:', error);
    return res.status(500).json({ error: 'Error fetching data. Please try again later.' });
  }
});


app.get('/api/dropdown', async (req, res) => {
  try {
    // Hacemos la consulta a la hoja correspondiente para obtener las opciones
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'contratista!A1:ZZ', // Ajusta el rango según sea necesario
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

// Función para guardar los registros en Google Sheets
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
    return { status: 'error', message: error.message, details: error.stack };
  }
}


app.post('/api/getDataForIndex', async (req, res) => {
  const { index } = req.body;
  
  // Validación del índice
  if (index == null || isNaN(index) || index < 0) {
    return res.status(400).json({ message: 'Índice no válido.' });
  }

  let range = 'contratista!A1:ZZ1000';  // Rango de las celdas

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: range,
    });

    if (response.data && response.data.values) {
      const columnData = response.data.values.map(row => row[index] || '');  // Obtiene los datos de la columna especificada
      return res.json({ data: columnData });
    } else {
      return res.status(404).json({ message: 'No se encontraron datos para el índice proporcionado.' });
    }
  } catch (error) {
    console.error('Error al obtener datos de Google Sheets:', error);
    return res.status(500).json({ message: 'Error al procesar la solicitud. Intente nuevamente más tarde.' });
  }
});

app.post('/api/addVehicles', async (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ message: 'Invalid data format. Expecting an array.' });
  }

  const range = 'Rvehiculos!A1:F'; // Cambia el rango y la pestaña según tu configuración
  const url = `${GOOGLE_SHEETS_API}/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&key=${API_KEY}`;

  const body = {
    range,
    majorDimension: 'ROWS',
    values: data.map((item) => [
      item.Contratista,
      item.Tipo_carro,
      item.Matricula,
      item.Conductor,
      item.Fecha,
      item.Observaciones,
    ]),
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    res.status(200).json({ message: 'Data added successfully.', response: response.data });
  } catch (error) {
    console.error('Error adding vehicle data:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error adding vehicle data.', error: error.response?.data || error.message });
  }
});

app.get('/api/data/index/:index', async (req, res) => {
  try {
    const index = req.params.index;
    const range = `A${index}:Z${index}`; // Rango para obtener una fila
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const data = response.data.values ? response.data.values[0] : [];
    res.json(data);
  } catch (error) {
    console.error('Error fetching data for index:', error);
    res.status(500).json({ error: 'Error fetching data. Please try again later.' });
  }
});

// Ruta para obtener los datos de una columna
app.get('/api/data/column/:index', async (req, res) => {
  try {
    const index = req.params.index;
    const range = `A1:Z1000`; // Rango para obtener varias filas
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const columnData = response.data.values
      ? response.data.values.map(row => row[index]).filter(value => value !== undefined)
      : [];
    res.json(columnData);
  } catch (error) {
    console.error('Error fetching data for column index:', error);
    res.status(500).json({ error: 'Error fetching data. Please try again later.' });
  }
});

// Ruta para obtener las opciones de dropdown de vehículos
app.get('/api/data/vehicle-dropdown', async (req, res) => {
  try {
    const range = `A1:Z1`; // Rango para obtener la primera fila
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const firstRow = response.data.values ? response.data.values[0] : [];
    const dropdownOptions = firstRow.map((value, index) => ({
      value: `col_${index}`,
      label: value,
    }));

    res.json(dropdownOptions);
  } catch (error) {
    console.error('Error fetching vehicle dropdown options:', error);
    res.status(500).json({ error: 'Error fetching vehicle dropdown options. Please try again later.' });
  }
});

// Ruta para obtener las opciones de dropdown de conductores
app.get('/api/data/driver-dropdown', async (req, res) => {
  try {
    const range = `A2:Z1000`; // Rango para obtener varias filas (segunda fila en adelante)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const firstRow = response.data.values ? response.data.values[0] : [];
    const conductorColumnIndex = firstRow.findIndex(col => col.toLowerCase() === 'conductor');

    if (conductorColumnIndex === -1) {
      return res.status(404).json({ error: 'Conductor column not found' });
    }

    const driverNames = response.data.values
      ? response.data.values.map(row => row[conductorColumnIndex]).filter(name => name && name !== 'Conductor')
      : [];
    const dropdownOptions = driverNames.map((name, index) => ({
      value: String(index),
      label: name,
    }));

    res.json(dropdownOptions);
  } catch (error) {
    console.error('Error fetching driver dropdown options:', error);
    res.status(500).json({ error: 'Error fetching driver dropdown options. Please try again later.' });
  }
});


// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});