import { getReferralStats } from '../services/referralService.js';

const TEXT = {
  tg: {
    title: '🎁 <b>Барномаи реферал</b>',
    link: (username, code) => `Пайванди шахсии шумо:\nhttps://t.me/${username}?start=ref_${code}`,
    stats: (count, days) => `👥 Шумо ${count} нафарро даъват кардед\n🎁 Ҷамъ бонус: ${days} рӯзи обунаи ройгон`,
    howItWorks: '\n💡 Барои ҳар як дӯсте, ки бо пайванди шумо ворид шавад — 3 рӯзи бонусӣ мегиред. Агар ӯ обуна харад — боз 7 рӯзи иловагӣ!',
  },
  ru: {
    title: '🎁 <b>Реферальная программа</b>',
    link: (username, code) => `Ваша персональная ссылка:\nhttps://t.me/${username}?start=ref_${code}`,
    stats: (count, days) => `👥 Вы пригласили: ${count} чел.\n🎁 Всего бонусных дней: ${days}`,
    howItWorks: '\n💡 За каждого друга, который зайдёт по вашей ссылке — вы получаете 3 бонусных дня. Если он оформит подписку — ещё 7 дней!',
  },
  en: {
    title: '🎁 <b>Referral program</b>',
    link: (username, code) => `Your personal link:\nhttps://t.me/${username}?start=ref_${code}`,
    stats: (count, days) => `👥 You've invited: ${count}\n🎁 Total bonus days: ${days}`,
    howItWorks: '\n💡 For every friend who joins via your link — you get 3 bonus days. If they subscribe — 7 more days!',
  },
};

export function registerReferralsHandler(bot) {
  const showReferral = async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const user = ctx.state.user;

    const botUsername = ctx.botInfo?.username || process.env.BOT_USERNAME;
    const stats = await getReferralStats(user._id);

    if (!botUsername) {
      const errMsg = {
        tg: '⚠️ Хатогӣ: номи бот муайян нашуд. Лутфан баъдтар кӯшиш кунед.',
        ru: '⚠️ Ошибка: не удалось определить имя бота. Попробуйте позже.',
        en: '⚠️ Error: could not determine bot username. Please try again later.',
      };
      await ctx.reply(errMsg[lang] || errMsg.ru);
      return;
    }

    // HTML вместо Markdown: реферальная ссылка содержит "_" (ref_КОД), а Markdown Telegram
    // трактует одиночное подчёркивание как начало курсива и ломается, если пара не найдена.
    // В HTML подчёркивание — обычный символ, конфликтов нет.
    await ctx.reply(
      `${t.title}\n\n${t.link(botUsername, user.referral.code)}\n\n${t.stats(stats.count, stats.totalBonusDays)}${t.howItWorks}`,
      { parse_mode: 'HTML' },
    );
  };

  bot.command('referral', showReferral);
  bot.hears(['🎁 Реферал'], showReferral);
}

export default registerReferralsHandler;
