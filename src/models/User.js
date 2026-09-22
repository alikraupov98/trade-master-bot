import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: null },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    language: { type: String, enum: ['tg', 'ru', 'en'], default: 'tg' },

    subscription: {
      plan: { type: String, enum: ['free', 'silver', 'gold', 'diamond'], default: 'free' },
      expiresAt: { type: Date, default: null },
    },

    aiUsage: {
      requestsToday: { type: Number, default: 0 },
      lastResetDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
      totalRequests: { type: Number, default: 0 },
      totalTokensUsed: { type: Number, default: 0 },
    },

    progress: {
      completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
      currentCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
      xp: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
    },

    referral: {
      code: { type: String, unique: true, sparse: true },
      referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      referralCount: { type: Number, default: 0 },
      earnings: { type: Number, default: 0 },
    },

    isBanned: { type: Boolean, default: false },
    isBot: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ createdAt: -1 });

export default mongoose.model('User', userSchema);
