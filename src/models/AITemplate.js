import mongoose from 'mongoose';

const aiTemplateSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['mentor', 'analyst', 'teacher', 'trader', 'translator'], required: true, index: true },
    language: { type: String, enum: ['tg', 'ru', 'en'], required: true },
    promptText: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true },
);

aiTemplateSchema.index({ role: 1, language: 1, isActive: 1 });

export default mongoose.model('AITemplate', aiTemplateSchema);
