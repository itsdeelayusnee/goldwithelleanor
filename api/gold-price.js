// Vercel Serverless Function
// GET /api/gold-price

const PUBLIC_GOLD_URL =
  'https://publicgold.com.my/index.php?pgcode=PG00122350&route=dealer/page';

const FX_URL = 'https://open.er-api.com/v6/latest/MYR';

module.exports = async function handler(req, res) {
  try {
    const [goldResponse, fxResponse] = await Promise.all([
      fetch(PUBLIC_GOLD_URL, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; GoldWithElleanorPrice/1.0; +https://vercel.com)'
        }
      }),
      fetch(FX_URL)
    ]);

    if (!goldResponse.ok) {
      throw new Error(`Public Gold returned ${goldResponse.status}`);
    }
    if (!fxResponse.ok) {
      throw new Error(`FX provider returned ${fxResponse.status}`);
    }

    const html = await goldResponse.text();
    const fx = await fxResponse.json();

    // Normalize whitespace so the matcher survives small HTML formatting changes.
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');

    // Looks for GOLD GAP ACCOUNT 24K ... RM606 / gram
    const match = text.match(/GOLD\s+GAP\s+ACCOUNT\s+24K[\s\S]{0,500}?RM\s*([0-9,]+(?:\.\d+)?)\s*\/\s*gram/i)
      || text.match(/AKAUN\s+EMAS\s+GAP\s+24K[\s\S]{0,500}?RM\s*([0-9,]+(?:\.\d+)?)\s*\/\s*gram/i);

    if (!match) {
      throw new Error('Could not find the GAP 24K price on the Public Gold page.');
    }

    const goldPriceMYR = Number(match[1].replace(/,/g, ''));

    // Public Gold publishes its own last-updated timestamp on the same price page.
    const updatedMatch = text.match(/Last\s+updated\s+(\d{1,2}-[A-Za-z]{3,9}-\d{4}(?:\s+\d{1,2}:\d{2}:\d{2})?)/i);
    const publicGoldUpdatedAt = updatedMatch ? updatedMatch[1] : null;

    const myrToBnd = Number(fx?.rates?.BND);

    if (!Number.isFinite(goldPriceMYR) || !Number.isFinite(myrToBnd)) {
      throw new Error('Invalid gold price or exchange rate.');
    }

    const goldPriceBND = goldPriceMYR * myrToBnd;

    // Cache at Vercel/CDN for 5 min, allow stale response while refreshing.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      goldPriceMYR,
      myrToBnd,
      goldPriceBND: Number(goldPriceBND.toFixed(2)),
      fetchedAt: new Date().toISOString(),
      publicGoldUpdatedAt,
      sources: {
        gold: PUBLIC_GOLD_URL,
        fx: 'ExchangeRate-API open access endpoint'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Unable to load live gold price.' });
  }
};
