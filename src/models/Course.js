import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    title: { type: Map, of: String, required: true }, // { tg: '...', ru: '...', en: '...' }
    description: { type: Map, of: String, default: {} },
    category: {
      type: String,
      enum: [
        'basics', 'forex', 'crypto', 'technical_analysis',
        'fundamental_analysis', 'psychology', 'risk_management', 'ai_trading',
      ],
      required: true,
    },
    coverImage: { type: String, default: null },
    requiredPlan: { type: String, enum: ['free', 'silver', 'gold', 'diamond'], default: 'free' },
    lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    generatedByAI: { type: Boolean, default: false },
  },
  { timestamps: true },
);

courseSchema.index({ category: 1, order: 1 });

export default mongoose.model('Course', courseSchema);
