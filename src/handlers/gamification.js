import { Markup } from 'telegraf';
import { getUserAchievements, startBattle } from '../services/gamificationService.js';

const TEXT = {
  tg: {
    achievementsTitle: '🏆 *Дастовардҳои шумо*',
    noAchievements: 'Ҳанӯз дастовард надоред. Дарсҳоро идома диҳед!',
    battlePrompt: '🥊 *AI-Баттл*\n\nҶуфтро интихоб кунед ва пешгӯӣ кунед: нарх дар 5 дақиқаи оянда БОЛО меравад ё ПОЁН?',
    battleStarted: (pair, price) => `✅ Баттл оғоз ёфт!\n💱 ${pair} = $${price}\n⏱ Натиҷа баъд аз 5 дақиқа маълум мешавад.`,
    priceUnavailable: '⚠️ Нархи ин ҷуфт дастрас нест. Ҷуфти дигарро интихоб кунед.',
  },
  ru: {
    achievementsTitle: '🏆 *Ваши достижения*',
    noAchievements: 'Пока нет достижений. Продолжайте проходить уроки!',
    battlePrompt: '🥊 *AI-Баттл*\n\nВыберите пару и предскажите: цена через 5 минут пойдёт ВВЕРХ или ВНИЗ?',
    battleStarted: (pair, price) => `✅ Баттл начат!\n💱 ${pair} = $${price}\n⏱ Результат будет через 5 минут.`,
    priceUnavailable: '⚠️ Цена для этой пары недоступна. Выберите другую пару.',
  },
  en: {
    achievementsTitle: '🏆 *Your achievements*',
    noAchievements: 'No achievements yet. Keep completing lessons!',
    battlePrompt: '🥊 *AI Battle*\n\nChoose a pair and predict: will the price go UP or DOWN in the next 5 minutes?',
    battleStarted: (pair, price) => `✅ Battle started!\n💱 ${pair} = $${price}\n⏱ Result in 5 minutes.`,
    priceUnavailable: '⚠️ Price unavailable for this pair. Choose another one.',
  },
};

function battlePairsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('BTC/USDT', 'battle_pair_BTCUSDT'), Markup.button.callback('ETH/USDT', 'battle_pair_ETHUSDT')],
    [Markup.button.callback('SOL/USDT', 'battle_pair_SOLUSDT'), Markup.button.callback('TON/USDT', 'battle_pair_TONUSDT')],
  ]);
}

function battleDirectionKeyboard(pair) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📈 ВВЕРХ / БОЛО / UP', `battle_guess_${pair}_up`)],
    [Markup.button.callback('📉 ВНИЗ / ПОЁН / DOWN', `battle_guess_${pair}_down`)],
  ]);
}

export function registerGamificationHandler(bot) {
  bot.command('achievements', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const achievements = await getUserAchievements(ctx.state.user._id);

    if (!achievements.length) {
      await ctx.replyWithMarkdown(`${t.achievementsTitle}\n\n${t.noAchievements}`);
      return;
    }

    const list = achievements.map((a) => `${a.icon} *${a.title[lang] || a.title.ru}* — ${a.description[lang] || a.description.ru || ''}`).join('\n');
    await ctx.replyWithMarkdown(`${t.achievementsTitle}\n\n${list}`);
  });

  bot.command('battle', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    await ctx.replyWithMarkdown(TEXT[lang].battlePrompt, battlePairsKeyboard());
  });

  bot.action(/^battle_pair_(.+)$/, async (ctx) => {
    const pair = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.reply(`${pair}:`, battleDirectionKeyboard(pair));
  });

  bot.action(/^battle_guess_(.+)_(up|down)$/, async (ctx) => {
    const [, pair, guess] = ctx.match;
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    await ctx.answerCbQuery();

    try {
      const battle = await startBattle({ userId: ctx.state.user._id, pair, guess });
      await ctx.reply(t.battleStarted(pair, battle.startPrice));
    } catch (err) {
      await ctx.reply(t.priceUnavailable);
    }
  });
}

export default registerGamificationHandler;
