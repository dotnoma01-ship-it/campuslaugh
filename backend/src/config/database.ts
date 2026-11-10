import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.connection.on('disconnected', () => console.warn('MongoDB connection closed.'));
mongoose.connection.on('reconnected', () => console.info('MongoDB connection restored.'));

export async function connectDatabase() {
  try {
    await mongoose.connect(env.mongo, { serverSelectionTimeoutMS: 10_000 });
    // Create declared model indexes without dropping or synchronizing away existing indexes.
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).createIndexes()));
    console.info('MongoDB connected and model indexes verified.');
  } catch {
    await mongoose.disconnect().catch(() => undefined);
    throw new Error('MongoDB connection or index initialization failed. Verify database availability and existing unique values.');
  }
}
