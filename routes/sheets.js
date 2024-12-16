const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Middleware para parsear el cuerpo de las solicitudes
app.use(bodyParser.json());

// Rutas
app.post('/api/data/index', (req, res) => {
  const index = req.body.index;
  // Simulamos que obtenemos los datos desde alguna fuente
  console.log('Index recibido:', index);
  const data = getDataFromIndex(index); // Esta función debe obtener los datos según el índice
  res.json(data);
});

app.post('/api/data/column', (req, res) => {
  const index = req.body.index;
  console.log('Index recibido para columna:', index);
  const columnData = getColumnData(index); // Función para obtener los datos de la columna
  res.json(columnData);
});

app.post('/api/data/vehicle-dropdown', (req, res) => {
  console.log('Petición para obtener opciones de vehículos');
  const dropdownOptions = getVehicleDropdownOptions(); // Función para obtener las opciones
  res.json(dropdownOptions);
});

app.post('/api/data/driver-dropdown', (req, res) => {
  console.log('Petición para obtener opciones de conductores');
  const driverDropdown = getDriverDropdownOptions(); // Función para obtener las opciones de conductores
  res.json(driverDropdown);
});

// Funciones de ejemplo para obtener datos
function getDataFromIndex(index) {
  // Aquí deberías implementar la lógica para obtener los datos de acuerdo al índice
  return [{ id: index, data: `Data for index ${index}` }];
}

function getColumnData(index) {
  // Aquí implementas la lógica para obtener los datos de una columna según el índice
  return [`Column data for index ${index}`];
}

function getVehicleDropdownOptions() {
  // Lógica para obtener las opciones de vehículos
  return [{ value: '1', label: 'Vehicle 1' }, { value: '2', label: 'Vehicle 2' }];
}

function getDriverDropdownOptions() {
  // Lógica para obtener las opciones de conductores
  return [{ value: '1', label: 'Driver 1' }, { value: '2', label: 'Driver 2' }];
}

// Arrancar el servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});