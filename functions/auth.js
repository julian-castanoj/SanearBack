const express = require('express');
const jwt = require('jsonwebtoken');
const { getSheetData } = require('./sheets');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const rows = await getSheetData('festivos!BV:BW'); // Cambiar rango según necesidad
    const headers = rows[0];
    const data = rows.slice(1);

    const userIndex = headers.indexOf('USUARIOS');
    const passwordIndex = headers.indexOf('CONTRASEÑAS');

    const userRow = data.find(
      (row) => row[userIndex]?.trim() === username && row[passwordIndex]?.trim() === password
    );

    if (!userRow) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.json({ token });
  } catch (error) {
    console.error('Error durante la autenticación:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;