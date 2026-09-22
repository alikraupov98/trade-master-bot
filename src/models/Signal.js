import mongoose from 'mongoose';

const signalSchema = new mongoose.Schema(
  {
    pair: { type: String, required: true, index: true },
    direction: { type: String, enum: ['long', 'short'], required: true },
    entryPrice: { type: Number, required: true },
    stopLoss: { type: Number, required: true },
    takeProfit: [{ type: Number }],
    timeframe: { type: String, default: '4h' },
    requiredPlan: { type: String, enum: ['free', 'silver', 'gold', 'diamond'], default: 'gold' },
    description: { type: Map, of: String, default: {} },
    status: { type: String, enum: ['active', 'closed_profit', 'closed_loss', 'cancelled'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

signalSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Signal', signalSchema);
