const express = require('express');
const { login } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/consolidado', verifyToken, (req, res) => {
    // Verifica si el token es válido
    res.json({ message: 'You have access to this protected route.', user: req.user });
  });

  app.post('/renew-token', authenticateMiddleware, (req, res) => {
    // Lógica para renovar el token
    const newToken = generateNewToken(req.user);
    res.json({ token: newToken });
  });

  const express = require('express');
  const googleSheetsController = require('../controllers/googleSheetsController');
  
  
  
  // Ruta para obtener las opciones del dropdown
  router.get('/dropdown-options', googleSheetsController.getDropdownOptions);
  
  

module.exports = router;