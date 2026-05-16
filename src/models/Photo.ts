import mongoose from 'mongoose';

const PhotoSchema = new mongoose.Schema({
  cloudinaryId: { type: String, required: true },
  cloudinaryUrl: { type: String, required: true },
  originalName: { type: String, default: 'photo.jpg' },
  guestName: { type: String, default: 'Convidado' },
  mimeType: { type: String, default: 'image/jpeg' },
  size: { type: Number, default: 0 },
  frame: { type: String, enum: ['classic', 'floral', 'modern'], default: 'classic' },
  message: { type: String, default: '' },
  isSignature: { type: Boolean, default: false },
  signatureForPhotoId: { type: String, default: null },
}, { timestamps: true });

export default mongoose.models.Photo || mongoose.model('Photo', PhotoSchema);
