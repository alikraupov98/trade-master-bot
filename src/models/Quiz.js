import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    questions: [
      {
        text: { type: Map, of: String, required: true },
        options: [{ type: Map, of: String }],
        correctIndex: { type: Number, required: true },
        explanation: { type: Map, of: String, default: {} },
      },
    ],
    generatedByAI: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    answers: [{ type: Number }],
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
  },
  { timestamps: true },
);

export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
export default mongoose.model('Quiz', quizSchema);
