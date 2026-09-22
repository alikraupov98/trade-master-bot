import { Markup } from 'telegraf';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

const PLAN_DETAILS = {
  tg: {
    free: {
      name: '🆓 Бепул',
      tagline: 'Барои шинос шудан бо платформа',
      items: [
        '📚 Дастрасӣ ба курси асосии "Асосҳои трейдинг"',
        '🤖 3 дархости AI-Наставник дар як рӯз',
        '🎓 AI-уроки интерактивӣ (бо ҳамин лимити AI)',
        '🧮 Калкулятори хавф, луғати трейдинг',
        '🏆 Системаи дастовардҳо ва AI-баттл',
      ],
    },
    silver: {
      name: '🥈 Нуқрагӣ',
      tagline: 'Барои омӯзиши ҷиддӣ',
      items: [
        '✅ Ҳама чизи тарифи Бепул, плюс:',
        '📚 Дастрасӣ ба ҲАМАИ курсҳо (форекс, крипто, таҳлили техникӣ ва ғайра)',
        '🤖 50 дархости AI-Наставник дар як рӯз (ба ҷои 3)',
        '📈 Дастрасии афзалиятнок ба таҳлили AI-и бозор',
      ],
    },
    gold: {
      name: '🥉 Тиллоӣ',
      tagline: 'Барои трейдерони фаъол',
      items: [
        '✅ Ҳама чизи тарифи Нуқрагӣ, плюс:',
        '🤖 AI-Наставник БЕМАҲДУД — саволи беохир, ҳар вақт',
        '📊 Сигналҳои VIP-и трейдинг (ҳар рӯз, бо таҳлил)',
        '📸 Vision-таҳлили графикҳо БЕМАҲДУД',
      ],
    },
    diamond: {
      name: '💎 Алмосӣ',
      tagline: 'Максимум барои касбиён',
      items: [
        '✅ Ҳама чизи тарифи Тиллоӣ, плюс:',
        '🎓 Дастрасии афзалиятнок ба маслиҳатҳои шахсӣ',
        '⚡ Дастгирии VIP бо ҷавоби зудтарин',
        '🌟 Аввалин шуда аз хусусиятҳои нав истифода баред',
      ],
    },
  },
  ru: {
    free: {
      name: '🆓 Бесплатно',
      tagline: 'Чтобы познакомиться с платформой',
      items: [
        '📚 Доступ к базовому курсу "Основы трейдинга"',
        '🤖 3 запроса к AI-Наставнику в день',
        '🎓 AI-интерактивные уроки (по тому же дневному лимиту AI)',
        '🧮 Калькулятор риска, глоссарий терминов',
        '🏆 Система достижений и AI-баттл',
      ],
    },
    silver: {
      name: '🥈 Серебро',
      tagline: 'Для серьёзного обучения',
      items: [
        '✅ Всё из тарифа Бесплатно, плюс:',
        '📚 Доступ ко ВСЕМ курсам (форекс, крипто, тех.анализ и другие)',
        '🤖 50 запросов к AI-Наставнику в день (вместо 3)',
        '📈 Приоритетный доступ к AI-анализу рынка',
      ],
    },
    gold: {
      name: '🥉 Золото',
      tagline: 'Для активных трейдеров',
      items: [
        '✅ Всё из тарифа Серебро, плюс:',
        '🤖 AI-Наставник БЕЗ ЛИМИТА — спрашивайте сколько угодно, когда угодно',
        '📊 VIP-сигналы трейдинга (ежедневно, с разбором)',
        '📸 Vision-анализ графиков БЕЗ ОГРАНИЧЕНИЙ',
      ],
    },
    diamond: {
      name: '💎 Алмаз',
      tagline: 'Максимум для профессионалов',
      items: [
        '✅ Всё из тарифа Золото, плюс:',
        '🎓 Приоритетный доступ к персональным консультациям',
        '⚡ VIP-поддержка с самым быстрым ответом',
        '🌟 Первыми получаете доступ к новым функциям',
      ],
    },
  },
  en: {
    free: {
      name: '🆓 Free',
      tagline: 'Get to know the platform',
      items: [
        '📚 Access to the basic "Trading Basics" course',
        '🤖 3 AI Mentor requests per day',
        '🎓 AI-interactive lessons (share the same daily AI limit)',
        '🧮 Risk calculator, trading glossary',
        '🏆 Achievements system and AI battle',
      ],
    },
    silver: {
      name: '🥈 Silver',
      tagline: 'For serious learning',
      items: [
        '✅ Everything in Free, plus:',
        '📚 Access to ALL courses (forex, crypto, technical analysis and more)',
        '🤖 50 AI Mentor requests per day (instead of 3)',
        '📈 Priority access to AI market analysis',
      ],
    },
    gold: {
      name: '🥉 Gold',
      tagline: 'For active traders',
      items: [
        '✅ Everything in Silver, plus:',
        '🤖 UNLIMITED AI Mentor — ask as much as you want, anytime',
        '📊 VIP trading signals (daily, with breakdowns)',
        '📸 UNLIMITED chart Vision analysis',
      ],
    },
    diamond: {
      name: '💎 Diamond',
      tagline: 'Maximum for professionals',
      items: [
        '✅ Everything in Gold, plus:',
        '🎓 Priority access to personal consultations',
        '⚡ VIP support with the fastest response',
        '🌟 First access to new features',
      ],
    },
  },
};

const TEXT = {
  tg: {
    title: '💎 *Тарифҳои TradeMaster AI TJ*',
    current: (plan, exp) => `Тарифи ҷории шумо: *${plan}*${exp ? `\nМӯҳлат то: ${exp}` : ''}`,
    footer: '\nБарои харид тарифро аз поён интихоб кунед 👇',
    methods: 'Тарзи пардохтро интихоб кунед:',
  },
  ru: {
    title: '💎 *Тарифы TradeMaster AI TJ*',
    current: (plan, exp) => `Ваш текущий тариф: *${plan}*${exp ? `\nДействует до: ${exp}` : ''}`,
    footer: '\nВыберите тариф для покупки ниже 👇',
    methods: 'Выберите способ оплаты:',
  },
  en: {
    title: '💎 *TradeMaster AI TJ Plans*',
    current: (plan, exp) => `Your current plan: *${plan}*${exp ? `\nValid until: ${exp}` : ''}`,
    footer: '\nChoose a plan to purchase below 👇',
    methods: 'Choose a payment method:',
  },
};

const BUY_LABEL = {
  tg: (name, price) => `${name} — ${price} TJS`,
  ru: (name, price) => `${name} — ${price} TJS`,
  en: (name, price) => `${name} — ${price} TJS`,
};

function paymentMethodsKeyboard(plan) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💳 Alif Mobi', `pay_alif_${plan}`), Markup.button.callback('🏦 Eskhata', `pay_eskhata_${plan}`)],
    [Markup.button.callback('💳 Humo', `pay_humo_${plan}`), Markup.button.callback('₿ Crypto (USDT)', `pay_crypto_${plan}`)],
    [Markup.button.callback('📄 Ручной перевод', `pay_manual_${plan}`)],
  ]);
}

function formatAllPlans(lang, currentPlanId) {
  const details = PLAN_DETAILS[lang] || PLAN_DETAILS.ru;
  const order = ['free', 'silver', 'gold', 'diamond'];

  const blocks = order.map((planId) => {
    const planConfig = SUBSCRIPTION_PLANS[planId.toUpperCase()];
    const d = details[planId];
    const priceLine = planConfig.price > 0 ? `${planConfig.price} TJS / 30 дней` : 'Бесплатно';
    const currentMark = planId === currentPlanId ? ' ✅ (ваш текущий)' : '';

    return `${d.name} — *${priceLine}*${currentMark}\n_${d.tagline}_\n${d.items.join('\n')}`;
  });

  return blocks.join('\n\n━━━━━━━━━━━━━━━\n\n');
}

export function registerSubscriptionHandler(bot) {
  const showPlans = async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const user = ctx.state.user;
    const exp = user.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toLocaleDateString() : null;
    const details = PLAN_DETAILS[lang] || PLAN_DETAILS.ru;

    const buyButtons = ['silver', 'gold', 'diamond'].map((plan) => {
      const planConfig = SUBSCRIPTION_PLANS[plan.toUpperCase()];
      const planName = details[plan].name;
      return [Markup.button.callback(BUY_LABEL[lang](planName, planConfig.price), `buy_${plan}`)];
    });

    await ctx.replyWithMarkdown(
      `${t.title}\n\n${t.current(user.subscription.plan, exp)}\n\n━━━━━━━━━━━━━━━\n\n${formatAllPlans(lang, user.subscription.plan)}\n\n━━━━━━━━━━━━━━━${t.footer}`,
      Markup.inlineKeyboard(buyButtons),
    );
  };

  bot.command('обуна', showPlans);
  bot.command('subscription', showPlans);
  bot.hears(['💎 Обуна', '💎 Подписка', '💎 Subscription'], showPlans);

  ['silver', 'gold', 'diamond'].forEach((plan) => {
    bot.action(`buy_${plan}`, async (ctx) => {
      const lang = ctx.state.user?.language || 'tg';
      const t = TEXT[lang] || TEXT.tg;
      await ctx.answerCbQuery();
      await ctx.reply(t.methods, paymentMethodsKeyboard(plan));
    });
  });

  // Обработка выбора метода оплаты передана в handlers/payment.js (action-паттерн pay_*)
}

export default registerSubscriptionHandler;
