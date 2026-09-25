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
