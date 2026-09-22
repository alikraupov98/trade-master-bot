import axios from 'axios';
import redisClient from '../config/redis.js';
import logger from '../utils/errorHandler.js';

const CACHE_TTL = 60; // кэш котировок на 60 секунд, чтобы не долбить публичное API

// Карта тикеров бота -> id CoinGecko (бесплатное публичное API, без ключа)
const COINGECKO_IDS = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  TONUSDT: 'the-open-network',
  BNBUSDT: 'binancecoin',
  SOLUSDT: 'solana',
};

/**
 * Получает текущую цену и суточное изменение для крипто-пары через CoinGecko (бесплатно, без ключа).
 */
async function getCryptoPrice(pair) {
  const coinId = COINGECKO_IDS[pair.toUpperCase()];
  if (!coinId) return null;

  const cacheKey = `market:crypto:${pair}`;
  const cached = await redisClient.get(cacheKey).catch(() => null);
  if (cached) return JSON.parse(cached);

  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: coinId, vs_currencies: 'usd', include_24hr_change: true, include_24hr_vol: true },
      timeout: 8000,
    });
    const info = data[coinId];
    if (!info) return null;

    const result = {
      pair,
      price: info.usd,
      change24h: info.usd_24h_change,
      volume24h: info.usd_24h_vol,
      source: 'coingecko',
      fetchedAt: new Date().toISOString(),
    };
    await redisClient.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    return result;
  } catch (err) {
    logger.warn(`Не удалось получить цену ${pair} с CoinGecko:`, err.message);
    return null;
  }
}

/**
 * Заглушка для Forex/металлов — без платного провайдера котировок Forex недоступны бесплатно
 * в реальном времени. Возвращает null, и вызывающий код должен честно предупредить пользователя
 * и попросить AI дать анализ на основе общих знаний без точной текущей цены,
 * либо интегрировать платный провайдер (например, TwelveData free tier — 8 запросов/мин).
 */
async function getForexPrice(pair) {
  logger.info(`Forex-котировки для ${pair} требуют платного провайдера (например, TwelveData free tier).`);
  return null;
}

/**
 * Универсальная функция получения цены по паре: определяет крипто это или форекс/металл.
 */
export async function getMarketSnapshot(pair) {
  const upperPair = pair.toUpperCase();
  if (COINGECKO_IDS[upperPair]) {
    return getCryptoPrice(upperPair);
  }
  return getForexPrice(upperPair);
}

export default { getMarketSnapshot };
