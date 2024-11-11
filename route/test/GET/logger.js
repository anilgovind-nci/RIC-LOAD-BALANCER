const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'log/app.log');

function logInfo(message) {
    const logMessage = `[INFO] ${new Date().toISOString()}: ${message}\n`;
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.log(err)
            console.error('Error writing info log:', err);
        }
    });
}

function logError(error) {
    const logMessage = `[ERROR] ${new Date().toISOString()}: ${error}\n`;
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error('Error writing error log:', err);
        }
    });
}
module.exports = {logError,logInfo}
