import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, default: 'Общий вопрос' },
    messages: [
      {
        from: { type: String, enum: ['user', 'admin', 'ai'], required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    source: { type: String, enum: ['manual', 'ai_escalation'], default: 'manual' },
  },
  { timestamps: true },
);

supportTicketSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('SupportTicket', supportTicketSchema);
