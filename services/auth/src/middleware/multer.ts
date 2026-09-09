import multer from "multer";                // Multer handles: multipart/form-data

const storage = multer.memoryStorage();     // Keep the uploaded file in RAM rather than saving it to disk

const uploadFile = multer({ storage }).single("file");

export default uploadFile;
