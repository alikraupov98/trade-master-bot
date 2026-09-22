import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['signal', 'subscription_expiring', 'daily_digest', 'ai_news', 'broadcast', 'lesson_reminder'],
      required: true,
    },
    title: { type: String, default: '' },
    text: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    delivered: { type: Boolean, default: true },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, type: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
