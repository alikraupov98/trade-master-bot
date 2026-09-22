import mongoose from 'mongoose';

const aiMarketAnalysisSchema = new mongoose.Schema(
  {
    pair: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    snapshot: {
      price: Number,
      change24h: Number,
      volume24h: Number,
      source: String,
    },
    analysisText: { type: String, required: true },
    provider: { type: String, default: 'groq' },
    tokensUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

aiMarketAnalysisSchema.index({ pair: 1, createdAt: -1 });

export default mongoose.model('AIMarketAnalysis', aiMarketAnalysisSchema);
