import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['silver', 'gold', 'diamond'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'TJS' },
    method: {
      type: String,
      enum: ['alif', 'eskhata', 'humo', 'crypto', 'manual'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    externalId: { type: String, default: null }, // ID транзакции у провайдера
    receiptFileId: { type: String, default: null }, // file_id скриншота чека (для ручного метода)
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }, // кто подтвердил вручную
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null }, // сырой ответ вебхука провайдера
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ method: 1, status: 1 });

export default mongoose.model('Payment', paymentSchema);
