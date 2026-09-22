import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['silver', 'gold', 'diamond'], required: true },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    autoRenew: { type: Boolean, default: false },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  },
  { timestamps: true },
);

subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
