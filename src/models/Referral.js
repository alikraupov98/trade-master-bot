import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rewardType: { type: String, enum: ['bonus_days', 'cash'], default: 'bonus_days' },
    rewardAmount: { type: Number, default: 7 }, // например, 7 бонусных дней подписки
    triggeredBy: { type: String, enum: ['signup', 'first_payment'], default: 'signup' },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    status: { type: String, enum: ['pending', 'credited'], default: 'pending' },
  },
  { timestamps: true },
);

referralSchema.index({ referrer: 1, createdAt: -1 });

export default mongoose.model('Referral', referralSchema);
