const multer = require('multer');
const path = require('path');

// Multer config for slip uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/slips');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadSlip = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowed = /jpeg|jpg|png|webpdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]) || file.mimetype === 'image/webp' || file.mimetype === 'application/pdf';
    if (ext || mime) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpg, png, webp) and PDF files are allowed'));
    }
  }
});

module.exports = { uploadSlip };
