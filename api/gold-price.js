const PUBLIC_GOLD_URL = 'https://publicgold.com.my/index.php/components/com_publicgold/wb/liveprice.php';
const FX_URL = 'https://open.er-api.com/v6/latest/MYR';
const FALLBACK_FX = 0.314;

function normalize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function section(text, start, end) {
  const upper = text.toUpperCase();
  const i = upper.indexOf(start.toUpperCase());
  if (i < 0) return '';
  const tail = text.slice(i + start.length);
  if (!end) return tail;
  const j = tail.toUpperCase().indexOf(end.toUpperCase());
  return j >= 0 ? tail.slice(0, j) : tail;
}

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pair(sec, label) {
  const m = sec.match(
    new RegExp(
      esc(label) +
        '\\s*(?:RM\\s*)?([0-9,]+(?:\\.\\d+)?)\\s*(?:RM\\s*)?([0-9,]+(?:\\.\\d+)?)',
      'i'
    )
  );
  return m ? { label, sell: num(m[1]), buy: num(m[2]) } : null;
}

function single(sec, label) {
  const m = sec.match(
    new RegExp(esc(label) + '\\s*(?:RM\\s*)?([0-9,]+(?:\\.\\d+)?)', 'i')
  );
  return m ? { label, sell: num(m[1]) } : null;
}

module.exports = async function handler(req, res) {
  try {
    // Fetch Public Gold first. This is the critical source.
    const goldResponse = await fetch(PUBLIC_GOLD_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GoldWithElleanor/2.1)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (!goldResponse.ok) {
      throw new Error(`Public Gold returned HTTP ${goldResponse.status}`);
    }

    const rawHtml = await goldResponse.text();
    const text = normalize(rawHtml);

    // Restrict GAP parsing to its own section so silver prices cannot be mistaken for gold.
    const gapSec = section(text, 'GOLD ACCUMULATION PROGRAM (24K)', 'GOLD BAR (24K)');

    // Most stable pattern currently visible on Public Gold:
    // RM 606 = 1.0000 gram
    let gapMatch = gapSec.match(/RM\s*([0-9,]+(?:\.\d+)?)\s*=\s*1(?:\.0+)?\s*gram/i);

    // Secondary pattern in case spacing/formatting changes.
    if (!gapMatch) {
      gapMatch = gapSec.match(/RM\s*100\s*=\s*[0-9.]+\s*gram[\s\S]{0,120}?RM\s*([0-9,]+(?:\.\d+)?)\s*=\s*1(?:\.0+)?\s*gram/i);
    }

    if (!gapMatch) {
      throw new Error('Could not locate the GAP 24K price on the Public Gold page.');
    }

    const goldPriceMYR = num(gapMatch[1]);
    if (!Number.isFinite(goldPriceMYR)) {
      throw new Error('Public Gold GAP price was not a valid number.');
    }

    // Prefer the update date inside the GAP section itself.
    // Public Gold's page contains older repeated "Last Update" timestamps elsewhere,
    // which can otherwise cause a stale 2021 date to be displayed.
    const gapUpdatedMatch =
      gapSec.match(/Last\s+updated\s+(\d{1,2}-[A-Za-z]{3,9}-\d{4}(?:\s+\d{1,2}:\d{2}:\d{2})?)/i);

    let publicGoldUpdatedAt = gapUpdatedMatch ? gapUpdatedMatch[1] : null;

    // Fallback: collect every page-level Last Update timestamp and choose the newest.
    if (!publicGoldUpdatedAt) {
      const matches = [...text.matchAll(/Last\s+Update\s+(\d{1,2}-[A-Za-z]{3,9}-\d{4}(?:\s+\d{1,2}:\d{2}:\d{2})?)/gi)]
        .map(m => m[1]);

      if (matches.length) {
        const parsed = matches
          .map(v => ({ raw: v, time: Date.parse(v.replace(/-/g, ' ')) }))
          .filter(x => Number.isFinite(x.time))
          .sort((a, b) => b.time - a.time);

        publicGoldUpdatedAt = parsed.length ? parsed[0].raw : matches[matches.length - 1];
      }
    }

    // Physical products are optional. Failure to parse them must NOT break the GAP price.
    const barSec = section(text, 'GOLD BAR (24K)', 'GOLD WAFER - DINAR');
    const dinarSec = section(text, 'GOLD WAFER - DINAR (24k)', 'PG Jewel');
    const smallSec = section(text, 'SMALL BAR / WAFER (24K)', 'SILVER ACCUMULATION PROGRAM');

    const goldBars = ['5 gram', '10 gram', '20 gram', '50 gram', '100 gram', '250 gram', '1000 gram']
      .map(x => pair(barSec, x))
      .filter(Boolean);

    const dinars = ['1 Dinar', '5 Dinar', '10 Dinar']
      .map(x => pair(dinarSec, x))
      .filter(Boolean);

    const smallBars = ['0.5 gram', '1 gram', '1/4 Dinar', '1/2 Dinar']
      .map(x => single(smallSec, x))
      .filter(Boolean);

    // FX is non-critical. If the provider is temporarily unavailable,
    // keep the Public Gold price live and use a clearly identified fallback FX rate.
    let myrToBnd = FALLBACK_FX;
    let fxLive = false;

    try {
      const fxResponse = await fetch(FX_URL, { cache: 'no-store' });
      if (fxResponse.ok) {
        const fx = await fxResponse.json();
        const liveRate = num(fx?.rates?.BND);
        if (Number.isFinite(liveRate) && liveRate > 0) {
          myrToBnd = liveRate;
          fxLive = true;
        }
      }
    } catch (fxError) {
      console.warn('FX fetch failed; using fallback rate:', fxError);
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      goldPriceMYR,
      myrToBnd,
      goldPriceBND: Number((goldPriceMYR * myrToBnd).toFixed(2)),
      fetchedAt: new Date().toISOString(),
      publicGoldUpdatedAt,
      publicGoldLive: true,
      fxLive,
      products: { smallBars, goldBars, dinars },
      sources: {
        gold: PUBLIC_GOLD_URL,
        fx: fxLive ? 'ExchangeRate-API' : 'Fallback FX rate'
      }
    });
  } catch (error) {
    console.error('gold-price API error:', error);
    res.status(500).json({
      error: error.message || 'Unable to load live Public Gold price.',
      fetchedAt: new Date().toISOString()
    });
  }
};
