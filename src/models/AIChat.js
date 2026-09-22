import mongoose from 'mongoose';

// Хранит полную историю диалогов пользователя с AI (для контекста и админ-мониторинга)
const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    tokensUsed: { type: Number, default: 0 },
    provider: { type: String, default: 'groq' }, // groq | openrouter | gemini | together | cache
    ratedGood: { type: Boolean, default: null }, // 👍/👎 от пользователя
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const aiChatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['mentor', 'analyst', 'teacher', 'trader', 'translator'], default: 'mentor' },
    messages: [messageSchema],
    escalatedToHuman: { type: Boolean, default: false },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', default: null },
  },
  { timestamps: true },
);

aiChatSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('AIChat', aiChatSchema);
