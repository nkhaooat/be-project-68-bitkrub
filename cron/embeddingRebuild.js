const MassageShop = require('../models/MassageShop');
const MassageService = require('../models/MassageService');
const { buildVectorStore, resetVectorStore } = require('../utils/chatbot');

let lastEmbeddingRebuild = new Date(0); // epoch = never rebuilt

function scheduleEmbeddingRebuild() {
  const now = new Date();
  // Compute next midnight Bangkok (00:00 UTC+7 = 17:00 UTC previous day)
  const bangkokOffset = 7 * 60 * 60 * 1000;
  const nowBangkok = new Date(now.getTime() + bangkokOffset);
  const nextMidnight = new Date(nowBangkok);
  nextMidnight.setUTCHours(17, 0, 0, 0); // 00:00 Bangkok = 17:00 UTC (previous day)
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();
  console.log(`[cron] Next embedding rebuild check scheduled in ${Math.round(msUntilMidnight / 60000)} minutes (midnight Bangkok).`);

  setTimeout(async () => {
    try {
      const since = lastEmbeddingRebuild;
      const newShops = await MassageShop.countDocuments({ createdAt: { $gt: since } });
      const newServices = await MassageService.countDocuments({ createdAt: { $gt: since } });
      if (newShops > 0 || newServices > 0) {
        console.log(`[cron] Found ${newShops} new shop(s) and ${newServices} new service(s) since last rebuild. Rebuilding embedding...`);
        resetVectorStore();
        await buildVectorStore();
        lastEmbeddingRebuild = new Date();
        console.log('[cron] Embedding rebuild complete.');
      } else {
        console.log('[cron] No new data since last rebuild — skipping embedding rebuild.');
      }
    } catch (err) {
      console.error('[cron] Embedding rebuild failed:', err.message);
    }
    scheduleEmbeddingRebuild();
  }, msUntilMidnight);
}

module.exports = { scheduleEmbeddingRebuild };
