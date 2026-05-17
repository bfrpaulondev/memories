import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dhsuwosfd';
const apiKey = process.env.CLOUDINARY_API_KEY || '533928869964219';
const apiSecret = process.env.CLOUDINARY_API_SECRET || 'OhUowpf7MfQE12ELIHo6FzlyiFc';

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

console.log(`[Cloudinary] Configured with cloud_name: ${cloudName}, api_key: ${apiKey ? 'set' : 'missing'}`);

export default cloudinary;
