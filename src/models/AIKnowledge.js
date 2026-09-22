import mongoose from 'mongoose';

// Векторизованные фрагменты учебных материалов для RAG.
// Поле embedding используется с MongoDB Atlas Vector Search (индекс задаётся отдельно в Atlas UI/API).
const aiKnowledgeSchema = new mongoose.Schema(
  {
    sourceType: { type: String, enum: ['course', 'lesson', 'document', 'manual'], default: 'manual' },
    sourceRef: { type: mongoose.Schema.Types.ObjectId, default: null }, // ссылка на Course/Lesson
    title: { type: String, required: true },
    chunkText: { type: String, required: true }, // сам фрагмент текста
    chunkIndex: { type: Number, default: 0 },
    embedding: { type: [Number], required: true }, // вектор эмбеддинга (Cohere, размерность из .env)
    language: { type: String, enum: ['tg', 'ru', 'en'], default: 'tg' },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

aiKnowledgeSchema.index({ sourceType: 1, sourceRef: 1 });

export default mongoose.model('AIKnowledge', aiKnowledgeSchema);
