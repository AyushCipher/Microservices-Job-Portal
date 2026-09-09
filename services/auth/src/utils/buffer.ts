import DataUriParser from "datauri/parser.js";  // Imports a library for converting file buffers into Data URI representations
import path from "path";

const getBuffer = (file: any) => {
  const parser = new DataUriParser();

  const extName = path.extname(file.originalname).toString();

  return parser.format(extName, file.buffer);   // It combines the file extension and raw buffer into a single data URI string, which can be used to upload the file to cloud storage services like AWS S3 or cloudinary
};

export default getBuffer;