import winston from 'winston';
import fs from 'fs';

const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Основной логгер проекта (используется во всех модулях)
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // Обычные Error-объекты хранят .message/.stack как неперечисляемые свойства, поэтому при
    // logger.error('текст:', err) они "теряются" при обычном слиянии метаданных Winston.
    // Эта функция явно достаёт их через точечный доступ (который не зависит от enumerable)
    // и добавляет к сообщению, чтобы реальная причина ошибки никогда не пропадала из лога.
    winston.format((info) => {
      const meta = info[Symbol.for('splat')];
      const errArg = Array.isArray(meta) ? meta.find((a) => a instanceof Error) : null;
      if (errArg) {
        info.message = `${info.message} ${errArg.message || ''}`.trim();
        info.stack = info.stack || errArg.stack;
      } else if (info instanceof Error) {
        info.stack = info.stack || info.stack;
      }
      return info;
    })(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...rest }) => {
      const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}${extra}`;
    }),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: `${logDir}/error.log`, level: 'error' }),
    new winston.transports.File({ filename: `${logDir}/combined.log` }),
  ],
});

// Обёртка для безопасного выполнения async-функций в хендлерах Telegraf
export function asyncHandler(fn) {
  return async (ctx, next) => {
    try {
      await fn(ctx, next);
    } catch (err) {
      logger.error(`Ошибка в хендлере: ${err.message}`, err);
      try {
        await ctx.reply('⚠️ Хатогӣ. Лутфан такрор кунед. / Ошибка, попробуйте ещё раз.');
      } catch (_) {
        /* ignore secondary error */
      }
    }
  };
}

export default logger;
