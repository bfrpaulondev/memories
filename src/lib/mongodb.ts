import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null, failed: false };
}

async function dbConnect(): Promise<typeof mongoose | null> {
  // If previously failed, don't retry frequently (wait 30 seconds)
  if (cached.failed && Date.now() - cached.failedAt < 30000) {
    return null;
  }

  if (cached.conn) return cached.conn;

  if (!MONGODB_URI) {
    cached.failed = true;
    cached.failedAt = Date.now();
    return null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 5000,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((m) => {
        cached.failed = false;
        return m;
      })
      .catch((e) => {
        cached.promise = null;
        cached.failed = true;
        cached.failedAt = Date.now();
        console.warn('MongoDB connection failed:', e.message?.substring(0, 100));
        return null;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch {
    return null;
  }
}

export default dbConnect;
