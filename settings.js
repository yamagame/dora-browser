const port = 5000;
const path = require('path');

module.exports = {
  port,
  robot_public_key: process.env.ROBOT_PUBLIC_KEY || null,
  picture_directory: process.env.ROBOT_PICTURE_DIR || path.join(__dirname, 'picture'),
  printer_name: process.env.ROBOT_PRINTER_NAME || '',
}
