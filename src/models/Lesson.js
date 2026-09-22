import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: Map, of: String, required: true },
    content: { type: Map, of: String, default: {} }, // текст урока по языкам
    type: {
      type: String,
      enum: ['photo', 'video', 'text', 'infographic', 'voice', 'pdf', 'ai_interactive'],
      default: 'text',
    },
    mediaUrls: [{ type: String }],
    order: { type: Number, default: 0 },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', default: null },
    aiInteractivePrompt: { type: String, default: null }, // системный промпт для AI-интерактивного урока
    generatedByAI: { type: Boolean, default: false },
  },
  { timestamps: true },
);

lessonSchema.index({ course: 1, order: 1 });

export default mongoose.model('Lesson', lessonSchema);
