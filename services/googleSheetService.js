const { google } = require('googleapis');
require('dotenv').config();

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function saveDataToSheet(records) {
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: '!A1', // Ajusta el rango según sea necesario
      valueInputOption: 'RAW',
      resource: {
        values: records,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error al guardar los datos en Google Sheets:', error);
    throw new Error('Error al guardar los datos en Google Sheets');
  }
}

module.exports = { saveDataToSheet };