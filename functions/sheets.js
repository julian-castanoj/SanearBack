const { google } = require('googleapis');

const authenticateGoogle = () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY, // Ruta del archivo JSON de la cuenta de servicio
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return auth;
};

const getSheetData = async (range) => {
  const auth = authenticateGoogle();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID, // ID de la hoja desde variable de entorno
    range,
  });

  return response.data.values;
};

module.exports = { getSheetData };