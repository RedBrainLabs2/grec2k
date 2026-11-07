import os
import sys
import json
import time
import re
import urllib.request
import concurrent.futures
from urllib.parse import unquote, parse_qs, urlparse
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT_DIR, 'images')
DATA_DIR = os.path.join(ROOT_DIR, 'data')

os.makedirs(IMG_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

def clean_url(u):
    if not u: return ''
    u = u.strip()
    if 'google.com/url?q=' in u:
        parsed = urlparse(u)
        qs = parse_qs(parsed.query)
        if 'q' in qs:
            return qs['q'][0]
    return u

def clean_price(p_str):
    if not p_str: return 0.0, ""
    raw = p_str.strip()
    m = re.search(r'[\$€£]?\s*(\d+[\.,]?\d*)', raw)
    if m:
        num_str = m.group(1).replace(',', '.')
        try:
            val = round(float(num_str), 2)
            return val, f"${val:.2f}"
        except:
            pass
    return 0.0, raw

KNOWN_BRANDS = [
    "Louis Vuitton", "Bottega Veneta", "Chrome Hearts", "Maison Margiela", "Acne Studios", 
    "Ami Paris", "Ralph Lauren", "Polo Ralph Lauren", "Balenciaga", "Rick Owens", 
    "Goyard", "Christian Dior", "Dior", "Gucci", "Prada", "Saint Laurent", "YSL", 
    "Cartier", "Rolex", "Audemars Piguet", "Patek Philippe", "Omega", "Burberry", 
    "Canada Goose", "Moncler", "Arc'teryx", "Arcteryx", "Supreme", "Stussy", "Stüssy", 
    "Travis Scott", "Gallery Dept", "Sp5der", "Hellstar", "Vlone", "ERD", "Enfants Riches Déprimés", 
    "Fear of God", "Essentials", "Eric Emanuel", "Corteiz", "Trapstar", "Off-White", 
    "Palm Angels", "Nike", "Jordan", "Adidas", "New Balance", "Asics", "Onitsuka Tiger", 
    "Bape", "A Bathing Ape", "Vivienne Westwood", "Van Cleef", "Hermes", "Hermès", 
    "Tom Ford", "Creed", "Byredo", "Maison Francis Kurkdjian", "Dyson", "Apple", "JBL", 
    "Lululemon", "Alo Yoga", "Skims", "Oakley", "Diesel", "Represent", "No Faith Studios", 
    "Our Legacy", "Kapital", "Undercover", "Comme des Garcons", "CDG", "Mastermind", 
    "Lacoste", "Tommy Hilfiger", "Calvin Klein", "Rhude", "Vetements", "Denim Tears", 
    "Kith", "Stone Island", "Givenchy", "Versace", "Fendi", "Lanvin", "Alexander McQueen",
    "Mertra", "Umbro", "Havaianas", "Birkenstock", "Mihara Yasuhiro", "UGG"
]

def extract_brand(name):
    lower_name = name.lower()
    for brand in KNOWN_BRANDS:
        pattern = r'\b' + re.escape(brand.lower()) + r'\b'
        if re.search(pattern, lower_name):
            return brand
    return "Exclusive"

CATEGORY_MAP = {
    'shoes': 'Shoes & Footwear',
    'sneakers': 'Shoes & Footwear',
    'jackets': 'Jackets & Outerwear',
    'jackets x vests x windbreakers': 'Jackets & Outerwear',
    'windbreakers/vests': 'Jackets & Outerwear',
    'jackets/vests': 'Jackets & Outerwear',
    'tracksuits': 'Tracksuits & Sets',
    'set / tracksuits': 'Tracksuits & Sets',
    'hoodies': 'Hoodies & Sweatshirts',
    'sweaters': 'Sweaters & Knitwear',
    'sweater': 'Sweaters & Knitwear',
    'pants': 'Pants & Denim',
    'bags & backpacs': 'Bags & Backpacks',
    'bags & backpacks': 'Bags & Backpacks',
    'bags': 'Bags & Backpacks',
    't-shirts / longsleeves': 'T-Shirts & Tops',
    't-shirts/longsleeves': 'T-Shirts & Tops',
    't-shirts': 'T-Shirts & Tops',
    'shirts/polo t-shirts': 'T-Shirts & Tops',
    'tops': 'T-Shirts & Tops',
    'shorts': 'Shorts',
    'football': 'Sportswear & Jerseys',
    'fotball': 'Sportswear & Jerseys',
    'underwear & socks': 'Underwear & Loungewear',
    'underwears&socks': 'Underwear & Loungewear',
    'wallets': 'Wallets & Cardholders',
    'cap & hat': 'Headwear & Caps',
    'headwear & scarfs': 'Headwear & Caps',
    'jewelry': 'Jewelry & Accessories',
    'sunglasses': 'Sunglasses & Eyewear',
    'electronics': 'Electronics & Gadgets',
    'watches': 'Watches & Timepieces',
    'perfume': 'Fragrances & Colognes',
    'colognes': 'Fragrances & Colognes',
    'belt': 'Belts & Accessories',
    'belt&tie': 'Belts & Accessories',
    'blanks': 'Blanks & Basics',
    'room decor': 'Room Decor & Lifestyle',
    'others': 'Lifestyle & Collectibles',
    'other cool stuff': 'Lifestyle & Collectibles',
    'gym / sports': 'Sportswear & Activewear',
    'dresses/skirts': 'Dresses & Skirts',
    'yoga clothes': 'Activewear & Yoga',
    'lululemon': 'Activewear & Yoga',
    'accessories': 'Jewelry & Accessories'
}

def infer_category_from_name(name):
    ln = name.lower()
    if any(w in ln for w in ['shoe', 'sneaker', 'slipper', 'mule', 'loafer', 'slide', 'boot', 'runner', 'dunk', 'bapesta', 'havaiana']):
        return 'Shoes & Footwear'
    if any(w in ln for w in ['jacket', 'coat', 'puffer', 'windbreaker', 'down jacket', 'vest', 'bomber', 'parka']):
        return 'Jackets & Outerwear'
    if any(w in ln for w in ['hoodie', 'sweatshirt', 'zip hoodie', 'pullover']):
        return 'Hoodies & Sweatshirts'
    if any(w in ln for w in ['sweater', 'knit', 'cardigan', 'crewneck', 'mohair']):
        return 'Sweaters & Knitwear'
    if any(w in ln for w in ['jean', 'denim', 'pant', 'trouser', 'sweatpant', 'bootcut', 'cargo', 'flared']):
        return 'Pants & Denim'
    if any(w in ln for w in ['short', 'swim short', 'mesh short']):
        return 'Shorts'
    if any(w in ln for w in ['tee', 't-shirt', 'longsleeve', 'jersey', 'polo', 'shirt']):
        return 'T-Shirts & Tops'
    if any(w in ln for w in ['tracksuit', 'set', 'warm up', 'two piece']):
        return 'Tracksuits & Sets'
    if any(w in ln for w in ['bag', 'backpack', 'duffle', 'crossbody', 'tote', 'messenger', 'pouch']):
        return 'Bags & Backpacks'
    if any(w in ln for w in ['wallet', 'cardholder', 'card holder', 'coin purse']):
        return 'Wallets & Cardholders'
    if any(w in ln for w in ['watch', 'chronograph', 'rolex', 'ap ', 'cartier', 'patek']):
        return 'Watches & Timepieces'
    if any(w in ln for w in ['glass', 'sunglass', 'shades', 'oakley']):
        return 'Sunglasses & Eyewear'
    if any(w in ln for w in ['ring', 'necklace', 'bracelet', 'chain', 'pendant', 'earring']):
        return 'Jewelry & Accessories'
    if any(w in ln for w in ['cap', 'hat', 'beanie', 'balaclava', 'scarf', 'beret']):
        return 'Headwear & Caps'
    if any(w in ln for w in ['belt', 'buckle', 'tie']):
        return 'Belts & Accessories'
    if any(w in ln for w in ['perfume', 'cologne', 'fragrance', 'scent']):
        return 'Fragrances & Colognes'
    if any(w in ln for w in ['airpod', 'headphone', 'speaker', 'case', 'mouse pad', 'keyboard', 'phone']):
        return 'Electronics & Gadgets'
    if any(w in ln for w in ['dress', 'skirt', 'gown']):
        return 'Dresses & Skirts'
    if any(w in ln for w in ['legging', 'yoga', 'bra', 'sports bra']):
        return 'Activewear & Yoga'
    if any(w in ln for w in ['rug', 'decor', 'bearbrick', 'figure', 'pillow', 'blanket', 'candle']):
        return 'Room Decor & Lifestyle'
    return 'Curated Selection'

NAV_TITLES = [
    'A', 'B', 'Watches', 'Other COOL STUFF', 'Shoes', 'Shorts', 'Pants', 'Jewelry', 'PICTURE',
    'Wallets', 'T-Shirts/Longsleeves', 'Hoodies', 'Sweater', 'Bags & Backpacks', 'Football',
    'Blanks', 'Set / Tracksuits', 'Colognes', 'Windbreakers/Vests', 'Jackets/Vests',
    'Underwears&Socks', 'Sunglasses', 'Headwear & Scarfs', 'Electronics', 'Belt&Tie', 'Gym / Sports',
    'SHOES', 'JACKETS', 'SWEATERS', 'SHIRTS/POLO T-SHIRTS', 'DRESSES/SKIRTS', 'TOPS', 'PANTS', 'T-SHIRTS',
    'BAGS', 'PERFUME', 'ACCESSORIES', 'YOGA CLOTHES', 'LULULEMON'
]

def parse_sheet(url, sheet_name, department_default):
    print(f"Fetching fresh sheet: {sheet_name}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', errors='ignore')
    soup = BeautifulSoup(html, 'html.parser')

    products = []
    current_category = "Featured & Trending"
    
    tables = soup.find_all('table')
    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            cells = row.find_all(['td', 'th'])
            for c in cells:
                colspan = int(c.get('colspan', 1))
                if colspan >= 3:
                    txt = c.get_text(' ', strip=True)
                    clean_txt = txt.lower().strip()
                    if clean_txt and len(txt) < 50 and not any(k in clean_txt for k in ['sign up', 'back to', 'code "', 'limited offer', 'picture']):
                        matched_cat = CATEGORY_MAP.get(clean_txt)
                        if not matched_cat:
                            for k, v in CATEGORY_MAP.items():
                                if k in clean_txt or clean_txt in k:
                                    matched_cat = v
                                    break
                        if matched_cat:
                            current_category = matched_cat
                            break

            links = []
            for a in row.find_all('a'):
                href = clean_url(a.get('href'))
                if href and href.startswith('http'):
                    links.append(href)

            imgs = []
            for img in row.find_all('img'):
                src = img.get('src')
                if src and ('google' in src or 'lh3' in src or src.startswith('http')):
                    imgs.append(src)

            cell_texts = [c.get_text(' ', strip=True) for c in cells]
            item_name = ""
            price_raw = ""
            litbuy_link = ""
            orig_link = ""

            for l in links:
                if 'litbuy.com/product' in l or ('litbuy.com' in l and 'register' not in l):
                    litbuy_link = l
                elif any(domain in l for domain in ['weidian.com', 'taobao.com', 'tmall.com', '1688.com', 'kaka1688']):
                    orig_link = l

            for ci, ct in enumerate(cell_texts):
                if re.search(r'[\$€£]\s*\d+', ct):
                    price_raw = ct
                    if ci > 0 and cell_texts[ci - 1] and not re.search(r'^\d+$', cell_texts[ci - 1]) and cell_texts[ci - 1] != 'PICTURE':
                        item_name = cell_texts[ci - 1]
                    break

            if not item_name and len(cell_texts) >= 3:
                if cell_texts[2] and not re.search(r'^\d+$', cell_texts[2]) and cell_texts[2] not in ['PICTURE', 'NAME', 'Watches', 'Shoes']:
                    item_name = cell_texts[2]

            if imgs and (item_name or orig_link or litbuy_link):
                if not item_name:
                    item_name = f"Exclusive Item #{len(products)+1}"

                # Skip header/nav buttons
                if item_name in NAV_TITLES and (not price_raw or not orig_link or 'register' in (orig_link or '')):
                    continue
                if any(k in item_name for k in ['LIMITED OFFER', 'SIGN UP', 'Spreadsheet']):
                    continue

                price_val, price_fmt = clean_price(price_raw)
                brand = extract_brand(item_name)

                if current_category == "Featured & Trending" or not current_category:
                    cat = infer_category_from_name(item_name)
                else:
                    cat = current_category

                primary_weblink = orig_link if orig_link else litbuy_link
                if not primary_weblink and links:
                    primary_weblink = links[0]

                prod_id = f"{sheet_name.lower()}-{len(products)+1:04d}"

                prod = {
                    'id': prod_id,
                    'sheet': sheet_name,
                    'department': department_default,
                    'name': item_name,
                    'brand': brand,
                    'price': price_val,
                    'priceFormatted': price_fmt if price_fmt else (f"${price_val:.2f}" if price_val > 0 else "Inquire"),
                    'remoteImage': imgs[0],
                    'image': f"./images/{prod_id}.jpg",
                    'weblink': primary_weblink,
                    'origLink': orig_link,
                    'agentLink': litbuy_link,
                    'category': cat
                }
                products.append(prod)

    print(f"  -> Extracted {len(products)} products from {sheet_name}")
    return products

def download_missing_image(prod):
    prod_id = prod['id']
    remote_url = prod['remoteImage']
    local_path = os.path.join(IMG_DIR, f"{prod_id}.jpg")

    # If already downloaded and valid, skip
    if os.path.exists(local_path) and os.path.getsize(local_path) > 500:
        return False

    urls_to_try = []
    if '=w' in remote_url or '=s' in remote_url:
        base = re.sub(r'=[sw]\d+.*$', '', remote_url)
        urls_to_try.append(base + '=s500')
    urls_to_try.append(remote_url)

    for u in urls_to_try:
        try:
            req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
            data = urllib.request.urlopen(req, timeout=10).read()
            if len(data) > 300:
                with open(local_path, 'wb') as f:
                    f.write(data)
                return True
        except:
            continue
    return False

def main():
    sheets = [
        ('Main', 'Men / Unisex', 'https://docs.google.com/spreadsheets/d/10dLNxYUS-TrZgrTE_ZehPhQbAHmxHn17d6ynITQoUGw/htmlview/sheet?headers=true&gid=1088861043'),
        ('Womens', 'Women', 'https://docs.google.com/spreadsheets/d/10dLNxYUS-TrZgrTE_ZehPhQbAHmxHn17d6ynITQoUGw/htmlview/sheet?headers=true&gid=917014908'),
        ('Curated', 'Curated', 'https://docs.google.com/spreadsheets/d/10dLNxYUS-TrZgrTE_ZehPhQbAHmxHn17d6ynITQoUGw/htmlview/sheet?headers=true&gid=517101426')
    ]

    all_products = []
    for s_name, dept, url in sheets:
        prods = parse_sheet(url, s_name, dept)
        all_products.extend(prods)

    # Filter out empty nav items
    clean_products = []
    for p in all_products:
        name = p['name'].strip()
        if name in NAV_TITLES and (p['price'] == 0 or not p['weblink'] or 'register' in p['weblink']):
            continue
        clean_products.append(p)

    print(f"\nTotal parsed products: {len(clean_products)}")

    # Check for missing images
    missing = [p for p in clean_products if not os.path.exists(os.path.join(IMG_DIR, f"{p['id']}.jpg"))]
    print(f"Missing images to download: {len(missing)}")

    if missing:
        print(f"Downloading {len(missing)} missing images with 25 workers...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=25) as executor:
            downloaded = list(executor.map(download_missing_image, missing))
        print(f"Successfully downloaded {sum(1 for d in downloaded if d)} new images.")
    else:
        print("All product images already up to date!")

    # Clean remoteImage key before saving
    for p in clean_products:
        if 'remoteImage' in p:
            del p['remoteImage']

    # Update data files
    out_json = os.path.join(DATA_DIR, 'products.json')
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(clean_products, f, separators=(',', ':'), ensure_ascii=False)

    out_js = os.path.join(DATA_DIR, 'products.js')
    with open(out_js, 'w', encoding='utf-8') as f:
        f.write('window.EXCLUSIVE_PRODUCTS = ')
        json.dump(clean_products, f, separators=(',', ':'), ensure_ascii=False)
        f.write(';\n')

    print(f"Updated products.json ({os.path.getsize(out_json)/1024/1024:.2f} MB)")
    print(f"Updated products.js ({os.path.getsize(out_js)/1024/1024:.2f} MB)")
    print("Catalog sync completed successfully!")

if __name__ == '__main__':
    main()
