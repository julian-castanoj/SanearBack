const express = require('express');
const { saveDataToSheet } = require('../app');  // Ajusta el path al servicio real

const router = express.Router();

// Ruta para manejar el POST a /register-records
router.post('/register-records', async (req, res) => {
  const records = req.body; // Esperamos que el frontend envíe los datos a través de un POST

  try {
      const formattedRecords = records.map(record => [
          record.Contratista,
          record.Transportista,
          record.Fecha,
          record.Nombre,
          record.Entrada,
          record.Salida,
          record.Observaciones,
      ]);

      const result = await saveDataToSheet(formattedRecords);
      res.status(200).send(result); // Responder con los datos del Google Sheets
  } catch (error) {
      console.error('Error al guardar los datos en Google Sheets:', error);
      res.status(500).send('Error al guardar los datos en Google Sheets');
  }
});

module.exports = router;