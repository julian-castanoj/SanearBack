const jwt = require('jsonwebtoken');
const { fetchSheetData } = require('../services/googleSheetService');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña requeridos.' });
  }

  try {
    const users = await fetchSheetData();
    const user = users.find(
      u => u['USUARIOS']?.trim() === username && u['CONTRASEÑAS']?.trim() === password
    );

    if (user) {
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return res.json({ token });
    } else {
      return res.status(401).json({ message: 'Nombre de usuario o contraseña inválidos.' });
    }
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.renewToken = (req, res) => {
  const { username } = req.user;

  try {
    const newToken = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token: newToken });
  } catch (error) {
    console.error('Error al renovar token:', error);
    res.status(500).json({ message: 'Error al renovar el token.' });
  }
};