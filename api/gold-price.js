const PUBLIC_GOLD_URL='https://publicgold.com.my/index.php/components/com_publicgold/wb/liveprice.php';
const FX_URL='https://open.er-api.com/v6/latest/MYR';

function normalize(html){
  return html.replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/\s+/g,' ').trim();
}
function num(s){const n=Number(String(s||'').replace(/,/g,''));return Number.isFinite(n)?n:null}
function section(text,start,end){
  const i=text.toUpperCase().indexOf(start.toUpperCase());if(i<0)return'';
  const tail=text.slice(i+start.length);if(!end)return tail;
  const j=tail.toUpperCase().indexOf(end.toUpperCase());return j>=0?tail.slice(0,j):tail;
}
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function pair(sec,label){
  const m=sec.match(new RegExp(esc(label)+'\\s*(?:RM\\s*)?([0-9,]+(?:\\.\\d+)?)\\s*(?:RM\\s*)?([0-9,]+(?:\\.\\d+)?)','i'));
  return m?{label,sell:num(m[1]),buy:num(m[2])}:null;
}
function single(sec,label){
  const m=sec.match(new RegExp(esc(label)+'\\s*(?:RM\\s*)?([0-9,]+(?:\\.\\d+)?)','i'));
  return m?{label,sell:num(m[1])}:null;
}

module.exports=async function handler(req,res){
  try{
    const [goldResponse,fxResponse]=await Promise.all([
      fetch(PUBLIC_GOLD_URL,{headers:{'User-Agent':'Mozilla/5.0 (compatible; GoldWithElleanor/2.0)'}}),
      fetch(FX_URL)
    ]);
    if(!goldResponse.ok)throw new Error(`Public Gold returned ${goldResponse.status}`);
    if(!fxResponse.ok)throw new Error(`FX provider returned ${fxResponse.status}`);

    const text=normalize(await goldResponse.text());
    const fx=await fxResponse.json();

    const gapMatch=text.match(/GOLD\s+ACCUMULATION\s+PROGRAM\s*\(24K\)[\s\S]{0,350}?RM\s*[0-9,.]+\s*=\s*[0-9.]+\s*gram[\s\S]{0,120}?RM\s*([0-9,]+(?:\.\d+)?)\s*=\s*1\.0000\s*gram/i)
      || text.match(/GOLD\s+GAP\s+ACCOUNT\s+24K[\s\S]{0,400}?RM\s*([0-9,]+(?:\.\d+)?)\s*\/\s*gram/i);
    if(!gapMatch)throw new Error('Could not find the Public Gold GAP price.');
    const goldPriceMYR=num(gapMatch[1]);

    const updatedMatch=text.match(/Last\s+Update(?:d)?\s+(\d{1,2}-[A-Za-z]{3,9}-\d{4}(?:\s+\d{1,2}:\d{2}:\d{2})?)/i);
    const publicGoldUpdatedAt=updatedMatch?updatedMatch[1]:null;

    const barSec=section(text,'GOLD BAR (24K)','GOLD WAFER - DINAR');
    const dinarSec=section(text,'GOLD WAFER - DINAR (24k)','PG Jewel');
    const smallSec=section(text,'SMALL BAR / WAFER (24K)','SILVER ACCUMULATION PROGRAM');

    const goldBars=['5 gram','10 gram','20 gram','50 gram','100 gram','250 gram','1000 gram'].map(x=>pair(barSec,x)).filter(Boolean);
    const dinars=['1 Dinar','5 Dinar','10 Dinar'].map(x=>pair(dinarSec,x)).filter(Boolean);
    const smallBars=['0.5 gram','1 gram','1/4 Dinar','1/2 Dinar'].map(x=>single(smallSec,x)).filter(Boolean);

    const myrToBnd=num(fx?.rates?.BND);
    if(!Number.isFinite(goldPriceMYR)||!Number.isFinite(myrToBnd))throw new Error('Invalid gold price or exchange rate.');

    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      goldPriceMYR,myrToBnd,goldPriceBND:Number((goldPriceMYR*myrToBnd).toFixed(2)),
      fetchedAt:new Date().toISOString(),publicGoldUpdatedAt,
      products:{smallBars,goldBars,dinars},
      sources:{gold:PUBLIC_GOLD_URL,fx:'ExchangeRate-API open access endpoint'}
    });
  }catch(error){
    console.error(error);
    res.status(500).json({error:error.message||'Unable to load live gold price.'});
  }
};
