const googleSheetsService = require('../services/googleSheetsService');

// Ruta para obtener las opciones del dropdown
exports.getDropdownOptions = async (req, res) => {
  try {
    const options = await googleSheetsService.getDropdownOptions();
    res.json(options);  // Devuelve las opciones al frontend
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener opciones del dropdown', error });
  }
};