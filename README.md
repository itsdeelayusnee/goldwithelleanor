# Gold with Elleanor

Mobile-first Public Gold companion site with:
- live GAP price in MYR and estimated BND
- live Public Gold physical product price tables
- RM budget-to-grams calculator
- gold value calculator
- saving tracker with milestones and local storage
- Brunei gold zakat calculator using B$158.39/g
- registration and WhatsApp links
- share/copy link, dark mode and installable PWA support

Deploy to Vercel from GitHub. Keep `api/gold-price.js` inside the `api` folder.

- optional TNG top-up fee calculation at 2.6%

## Cloud tracker login
Uses Supabase email magic-link authentication and the `gold_tracker` table protected by Row Level Security. Guests continue to use browser local storage.

## Cache note
This build unregisters the previous service worker and clears old browser caches so new Vercel deployments load immediately.

- Annual Gold Saving Projection for 1, 3, 5 and 10 years based on the current gold price and monthly saving amount.

- Professional About Elleanor / My Gold Journey section with dealer credibility, community experience and CTA.

- Removed duplicate registration/WhatsApp CTA from the About section so the global registration card appears only once.

- Updated personal gold accumulation figure to 229.6792g.

- Tracker reorganized into separate Total Gram, Target, and Annual sections while retaining the same guest/cloud saved data.

- Tracker reordered: monthly saving and annual projection first, then current gold and target immediately above gold progress.

- Added on-site zakat reminder using 85g nisab reference and one-year haul countdown. Run `supabase-zakat-reminder.sql` once in Supabase SQL Editor before using cloud sync for these new fields.

- Physical Gold Prices now show both PG Sell and PG Buy in MYR and estimated BND.

- Zakat section now clearly attributes B$158.39/g and 85g nisab to the current KHEU / Majlis Ugama Islam Brunei reference shown on the official calculator.

- TNG calculator now shows two separate fee methods: 2.6% manual TNG top-up then transfer to Public Gold, and 3.0% direct top-up from the Public Gold app.

- Added Elleanor's professional portrait to the About section with dealer/educator positioning.
