import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true }, // например 'first_lesson', 'streak_7', 'quiz_master'
    title: { type: Map, of: String, required: true },
    description: { type: Map, of: String, default: {} },
    icon: { type: String, default: '🏆' },
    unlockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

achievementSchema.index({ user: 1, code: 1 }, { unique: true });

export const Achievement = mongoose.model('Achievement', achievementSchema);

const gameBattleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pair: { type: String, required: true },
    startPrice: { type: Number, required: true },
    userGuess: { type: String, enum: ['up', 'down'], required: true },
    endPrice: { type: Number, default: null },
    result: { type: String, enum: ['pending', 'win', 'lose'], default: 'pending' },
    resolvesAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const GameBattle = mongoose.model('GameBattle', gameBattleSchema);

export default { Achievement, GameBattle };
