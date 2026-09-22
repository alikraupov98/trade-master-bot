import { Markup } from 'telegraf';
import Quiz, { QuizAttempt } from '../models/Quiz.js';
import { completeLessonAndCheckAchievements } from '../services/courseService.js';

const TEXT = {
  tg: { noQuiz: '📝 Барои ин дарс санҷиш дастрас нест.', question: (i, n) => `Савол ${i}/${n}`, result: (score, total) => `✅ Санҷиш анҷом ёфт! Натиҷа: ${score}/${total}`, correct: '✅ Дуруст!', wrong: (correct) => `❌ Нодуруст. Ҷавоби дуруст: ${correct}` },
  ru: { noQuiz: '📝 Для этого урока тест недоступен.', question: (i, n) => `Вопрос ${i}/${n}`, result: (score, total) => `✅ Тест завершён! Результат: ${score}/${total}`, correct: '✅ Правильно!', wrong: (correct) => `❌ Неверно. Правильный ответ: ${correct}` },
  en: { noQuiz: '📝 No quiz available for this lesson.', question: (i, n) => `Question ${i}/${n}`, result: (score, total) => `✅ Quiz finished! Score: ${score}/${total}`, correct: '✅ Correct!', wrong: (correct) => `❌ Wrong. Correct answer: ${correct}` },
};

async function sendQuestion(ctx, quiz, questionIndex) {
  const lang = ctx.state.user?.language || 'tg';
  const t = TEXT[lang] || TEXT.tg;
  const question = quiz.questions[questionIndex];

  const buttons = question.options.map((opt, i) => [
    Markup.button.callback(opt.get?.(lang) || opt[lang] || `Option ${i + 1}`, `quiz_answer_${quiz._id}_${questionIndex}_${i}`),
  ]);

  await ctx.reply(
    `${t.question(questionIndex + 1, quiz.questions.length)}\n\n${question.text.get?.(lang) || question.text[lang]}`,
    Markup.inlineKeyboard(buttons),
  );
}

export function registerQuizHandler(bot) {
  bot.action(/^quiz_start_(.+)$/, async (ctx) => {
    const lessonId = ctx.match[1];
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    await ctx.answerCbQuery();

    const quiz = await Quiz.findOne({ lesson: lessonId });
    if (!quiz) {
      await ctx.reply(t.noQuiz);
      return;
    }

    ctx.session.tempData = { ...ctx.session.tempData, quizAnswers: [] };
    await sendQuestion(ctx, quiz, 0);
  });

  bot.action(/^quiz_answer_(.+)_(\d+)_(\d+)$/, async (ctx) => {
    const [, quizId, qIndexStr, aIndexStr] = ctx.match;
    const qIndex = Number(qIndexStr);
    const aIndex = Number(aIndexStr);
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return ctx.answerCbQuery();

    const question = quiz.questions[qIndex];
    const isCorrect = aIndex === question.correctIndex;
    const correctOption = question.options[question.correctIndex];
    const correctText = correctOption.get?.(lang) || correctOption[lang];

    await ctx.answerCbQuery(isCorrect ? '✅' : '❌');
    await ctx.reply(isCorrect ? t.correct : t.wrong(correctText));

    const answers = ctx.session.tempData?.quizAnswers || [];
    answers[qIndex] = aIndex;
    ctx.session.tempData = { ...ctx.session.tempData, quizAnswers: answers };

    const nextIndex = qIndex + 1;
    if (nextIndex < quiz.questions.length) {
      await sendQuestion(ctx, quiz, nextIndex);
    } else {
      const score = answers.reduce((sum, ans, i) => sum + (ans === quiz.questions[i].correctIndex ? 1 : 0), 0);
      await QuizAttempt.create({
        user: ctx.state.user._id,
        quiz: quiz._id,
        answers,
        score,
        totalQuestions: quiz.questions.length,
      });
      await ctx.reply(t.result(score, quiz.questions.length));
      if (quiz.lesson) {
        await completeLessonAndCheckAchievements(ctx.state.user._id, quiz.lesson, 20).catch(() => {});
      }
    }
  });
}

export default registerQuizHandler;
