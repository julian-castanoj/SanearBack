const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(403).json({ message: 'Token no proporcionado.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Token inválido o expirado.' });
    }

    // Agregar una verificación para asegurarse de que solo sea válido en una ruta específica
    if (req.originalUrl !== '/consolidado') {
      return res.status(403).json({ message: 'Token no autorizado para esta ruta.' });
    }

    req.user = decoded;
    next();
  });
}

module.exports = verifyToken;