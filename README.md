# grec2k — Exclusive Luxury & Streetwear Catalog

Modern, minimalist luxury & streetwear collection catalog inspired by Alo Yoga's clean aesthetic.

🔗 **Live Website**: [https://redbrainlabs2.github.io/grec2k/](https://redbrainlabs2.github.io/grec2k/)

---

## ⚡ Features

- **Alo Yoga Aesthetic**: Clean white background, editorial typography, subtle borders, petrol highlights (`#0e7490`).
- **Dynamic Catalog**: 4,700+ curated items across Men/Unisex, Women, and Exclusive Curated selections.
- **Direct Store Links**: Clicking any product image leads directly to the original supplier/store link (Weidian / Taobao) or Litbuy agent.
- **Instant Search & Filtering**: Real-time multi-term search, brand selection, category chips, and price sorting.
- **Persistent Wishlist**: Save favorite items locally in the browser with slide-over drawer review.
- **Currency Converter**: Instant price toggle between USD ($), EUR (€), and GBP (£).
- **Automated Synchronization**: Automated GitHub Actions workflow syncing catalog updates & images directly from Google Sheets.

---

## 🔄 Automated Google Sheets Sync

The catalog automatically syncs with the master Google Sheet:
- **Scheduled Sync**: Runs automatically every 6 hours via GitHub Actions (`.github/workflows/sync-sheet.yml`).
- **Manual Trigger**:
  1. Open the repository on GitHub.
  2. Click on the **Actions** tab.
  3. Select **Sync Google Sheets Catalog** in the left sidebar.
  4. Click **Run workflow** -> **Run workflow**.
  5. The action will pull the newest products, download any new product images, commit them, and deploy to GitHub Pages automatically.

### GitHub Actions Permission Setup
To ensure the automated bot can push updates to the repository:
1. Go to **Settings** > **Actions** > **General**.
2. Scroll to **Workflow permissions**.
3. Select **Read and write permissions**.
4. Click **Save**.

---

## 🛠️ Local Development

Open `index.html` directly in your browser or run a local static server:

```bash
npx serve .
```

To run a manual sync locally:

```bash
python scripts/sync_catalog.py
```
