import requests
from bs4 import BeautifulSoup
import json
import re
import time

BASE_URL_AURO = "https://sri-aurobindo.co.in/workings/matherials/rigveda"
BASE_URL_WISDOM = "https://www.wisdomlib.org"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

def fetch_html(url):
    """Fetch HTML with error handling"""
    try:
        print(f"Fetching: {url}")
        r = requests.get(url, headers=HEADERS, timeout=10)
        r.raise_for_status()
        r.encoding = r.apparent_encoding
        return r.text
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def clean_text(text, remove_patterns):
    """Clean text by removing unwanted patterns"""
    for pattern in remove_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    return text.strip()

def parse_sukta_auro(url, max_riks=50):
    """Scrape Aurobindo Samhita + Padapatha for a Sukta"""
    html = fetch_html(url)
    if not html:
        return []
    
    soup = BeautifulSoup(html, "html.parser")
    verses = []
    samh_divs = soup.find_all("div", class_="samh_dev_nonacc")
    
    if not samh_divs:
        all_divs = soup.find_all("div")
        samh_divs = [div for div in all_divs if div.get_text() and 
                     any(ord(char) >= 0x0900 and ord(char) <= 0x097F for char in div.get_text())]
    
    print(f"Found {len(samh_divs)} samhita divs")
    
    for idx, samh in enumerate(samh_divs[:max_riks], start=1):
        samh_text = samh.get_text(strip=True)
        samh_text = clean_text(samh_text, [
            r'.*?Samhita.*?Devanagari.*?Nonaccented\s*',
            r'.*?Nonaccented\s*'
        ])
        
        if not samh_text or len(samh_text) < 5:
            continue
            
        verse_data = {
            "rik_number": idx,
            "samhita": {
                "devanagari": {
                    "text": samh_text,
                    "type": "Samhita Devanagari Nonaccented"
                }
            },
            "padapatha": {
                "devanagari": {
                    "text": None,
                    "words": [],
                    "type": "Padapatha Devanagari Nonaccented"
                },
                "transliteration": {
                    "text": None,
                    "words": [],
                    "type": "Padapatha Transliteration Accented"
                }
            },
            "translation": None,
            "sanskrit_wisdomlib": None
        }

        pada_div = samh.find_next_sibling("div", class_="pada_dev_nonacc")
        if not pada_div:
            next_el = samh.find_next_sibling()
            while next_el and next_el.name == "div":
                text = next_el.get_text()
                if "pada" in text.lower() or "।" in text:
                    pada_div = next_el
                    break
                next_el = next_el.find_next_sibling()
        
        if pada_div:
            pada_text = pada_div.get_text(strip=True)
            pada_text = clean_text(pada_text, [
                r'.*?Padapatha.*?Devanagari.*?Nonaccented\s*',
                r'.*?Devanagari.*?Nonaccented\s*',
                r'.*?Nonaccented\s*'
            ])
            
            if pada_text:
                verse_data['padapatha']['devanagari']['text'] = pada_text
                words = re.split(r'[।॥\s]+', pada_text)
                clean_words = [w.strip() for w in words if w.strip() and 
                              not any(kw in w.lower() for kw in ['devanagari', 'nonaccented', 'padapatha'])]
                verse_data['padapatha']['devanagari']['words'] = clean_words

            trans_div = pada_div.find_next_sibling("div")
            if trans_div:
                trans_text = trans_div.get_text(strip=True)
                trans_text = clean_text(trans_text, [
                    r'.*?Padapatha.*?transliteration.*?accented\s*',
                    r'.*?transliteration.*?accented\s*',
                    r'.*?accented\s*'
                ])
                
                if trans_text and any(c in trans_text for c in ['ā', 'ī', 'ū', 'ṛ', 'ṃ', 'ḥ']):
                    verse_data['padapatha']['transliteration']['text'] = trans_text
                    words = re.split(r'[|ǁ\s]+', trans_text)
                    clean_words = [w.strip() for w in words if w.strip() and 
                                  not any(kw in w.lower() for kw in ['transliteration', 'accented', 'padapatha'])]
                    verse_data['padapatha']['transliteration']['words'] = clean_words

        verses.append(verse_data)
        
    return verses

def get_mandala_sukta_urls(mandala_number):
    """Dynamically fetch all sukta URLs from a mandala index page"""
    mandala_base_ids = {
        1: 828864,  # Book 1 starts at doc828864
        2: 831062,  
        3: 831535,  
        4: 832215,  
        5: 832863,
        6: 833678,
        7: 834519,
        8: 835465,
        9: 837285,
        10: 838508
    }
    
    if mandala_number not in mandala_base_ids:
        print(f"No base ID known for Mandala {mandala_number}")
        return []
    
    mandala_url = f"{BASE_URL_WISDOM}/hinduism/book/rig-veda-english-translation/d/doc{mandala_base_ids[mandala_number]}.html"
    html = fetch_html(mandala_url)
    if not html:
        return []
    
    soup = BeautifulSoup(html, "html.parser")
    sukta_urls = []
    
    links = soup.find_all("a", href=True)
    for link in links:
        href = link.get('href')
        link_text = link.get_text().strip()
        
        if href and '/d/doc' in href and href.endswith('.html') and 'sukta' in link_text.lower():
            doc_match = re.search(r'doc(\d+)\.html', href)
            sukta_match = re.search(r'sukta\s+(\d+)', link_text.lower())
            
            if doc_match and sukta_match:
                doc_id = int(doc_match.group(1))
                sukta_num = int(sukta_match.group(1))
                full_url = f"{BASE_URL_WISDOM}{href}" if href.startswith('/') else href
                sukta_urls.append({
                    'sukta_number': sukta_num,
                    'doc_id': doc_id,
                    'url': full_url
                })
    
    sukta_urls.sort(key=lambda x: x['sukta_number'])
    print(f"Found {len(sukta_urls)} suktas in Mandala {mandala_number}")
    
    return sukta_urls

def get_sukta_verses_wisdomlib(sukta_info, max_verses=50):
    """Fetch Sanskrit + English verses from Wisdomlib Sukta"""
    sukta_number = sukta_info['sukta_number']
    start_doc_id = sukta_info['doc_id']
    
    print(f"Processing Sukta {sukta_number} starting from doc{start_doc_id}")
    
    verse_urls = []
    current_doc_id = start_doc_id + 1
    consecutive_failures = 0
    
    for i in range(max_verses * 2):
        verse_url = f"{BASE_URL_WISDOM}/hinduism/book/rig-veda-english-translation/d/doc{current_doc_id}.html"
        
        try:
            response = requests.head(verse_url, headers=HEADERS, timeout=5)
            if response.status_code == 200:
                verse_urls.append(verse_url)
                consecutive_failures = 0
            else:
                consecutive_failures += 1
        except:
            consecutive_failures += 1
            
        if consecutive_failures >= 3 or len(verse_urls) >= max_verses:
            break
            
        current_doc_id += 1
        time.sleep(0.1)
    
    print(f"Found {len(verse_urls)} verse URLs for Sukta {sukta_number}")
    
    verses = []
    
    for i, verse_url in enumerate(verse_urls[:max_verses]):
        verse_html = fetch_html(verse_url)
        if not verse_html:
            continue
            
        verse_soup = BeautifulSoup(verse_html, "html.parser")
        
        title = verse_soup.find("title")
        if title and "sukta" in title.get_text().lower() and len(verse_soup.find_all("a", href=True)) > 10:
            print(f"Skipping sukta index at verse {i+1}")
            break
        
        sanskrit = ""
        english = ""
        
        sanskrit_paras = verse_soup.find_all("p", lang="sa")
        if sanskrit_paras:
            sanskrit = sanskrit_paras[0].get_text(strip=True)
        else:
            all_paras = verse_soup.find_all("p")
            for p in all_paras:
                text = p.get_text()
                if any(ord(char) >= 0x0900 and ord(char) <= 0x097F for char in text):
                    sanskrit = text.strip()
                    break
        
        if sanskrit:
            parts = re.split(r'॥.*?॥', sanskrit)
            if parts:
                sanskrit = parts[0].strip()
                sanskrit = re.sub(r'[a-zA-Z]{3,}.*$', '', sanskrit).strip()
        
        english_headers = verse_soup.find_all("h2")
        for header in english_headers:
            if "english" in header.get_text().lower() and "translation" in header.get_text().lower():
                next_p = header.find_next_sibling("p")
                if next_p and not next_p.get('lang'):
                    english = next_p.get_text(strip=True)
                    break
        
        if not english:
            all_paras = verse_soup.find_all("p")
            for p in all_paras:
                text = p.get_text()
                if (not p.get('lang') and 
                    not any(ord(char) >= 0x0900 and ord(char) <= 0x097F for char in text) and
                    len(text.strip()) > 10 and
                    not re.match(r'^[a-z\s|ǀǁāīūṛṃḥ]+$', text.strip())):
                    english = text.strip()
                    break
        
        if sanskrit:
            verses.append({
                "sanskrit": sanskrit,
                "english": english if english else f"Translation not found for verse {i+1}"
            })
            print(f"Verse {i+1}: Found")
        
        time.sleep(0.5)
    
    return verses

def scrape_complete_rigveda(start_mandala=1, start_sukta=1, resume_data=None):
    """Scrape ALL mandalas, suktas, and riks from the Rig Veda"""
    all_data = resume_data if resume_data else {}
    total_riks_scraped = sum(len(verses) for mandala in all_data.values() for verses in mandala.values())
    
    print(f"Starting Rig Veda scraping from Mandala {start_mandala}, Sukta {start_sukta}...")
    print("=" * 60)

    for mandala_idx in range(start_mandala, 11):
        print(f"\nSTARTING MANDALA {mandala_idx}")
        print("=" * 40)
        
        sukta_infos = get_mandala_sukta_urls(mandala_idx)
        
        if not sukta_infos:
            print(f"No suktas found for Mandala {mandala_idx}, skipping...")
            continue
        
        print(f"Found {len(sukta_infos)} suktas in Mandala {mandala_idx}")
        
        mandala_data = all_data.get(f"Mandala {mandala_idx}", {})
        mandala_riks = sum(len(verses) for verses in mandala_data.values())

        for sukta_info in sukta_infos:
            sukta_idx = sukta_info['sukta_number']
            
            # Skip suktas we've already processed
            if mandala_idx == start_mandala and sukta_idx < start_sukta:
                print(f"Skipping already processed Sukta {sukta_idx}")
                continue
            
            print(f"\n--- Mandala {mandala_idx}, Sukta {sukta_idx} ---")
            
            try:
                verses_wisdomlib = get_sukta_verses_wisdomlib(sukta_info, max_verses=50)
                
                if not verses_wisdomlib:
                    print(f"No verses found for Sukta {sukta_idx}, skipping...")
                    continue

                auro_url = f"{BASE_URL_AURO}/{mandala_idx:02d}/{mandala_idx:02d}-{sukta_idx:03d}.htm"
                auro_verses = parse_sukta_auro(auro_url, max_riks=len(verses_wisdomlib))
                
                if not auro_verses:
                    auro_url = f"{BASE_URL_AURO}/{mandala_idx:02d}/{mandala_idx:02d}-{sukta_idx:02d}.htm"
                    auro_verses = parse_sukta_auro(auro_url, max_riks=len(verses_wisdomlib))

                combined = []
                for i in range(len(verses_wisdomlib)):
                    if i < len(auro_verses):
                        verse = auro_verses[i].copy()
                    else:
                        verse = {
                            "rik_number": i + 1,
                            "samhita": {
                                "devanagari": {
                                    "text": None,
                                    "type": "Samhita Devanagari Nonaccented"
                                }
                            },
                            "padapatha": {
                                "devanagari": {
                                    "text": None,
                                    "words": [],
                                    "type": "Padapatha Devanagari Nonaccented"
                                },
                                "transliteration": {
                                    "text": None,
                                    "words": [],
                                    "type": "Padapatha Transliteration Accented"
                                }
                            },
                            "translation": None,
                            "sanskrit_wisdomlib": None
                        }
                    
                    verse['translation'] = verses_wisdomlib[i]['english']
                    verse['sanskrit_wisdomlib'] = verses_wisdomlib[i]['sanskrit']
                    combined.append(verse)

                if combined:
                    sukta_key = f"Sukta {sukta_idx}"
                    mandala_data[sukta_key] = combined
                    mandala_riks += len(combined)
                    total_riks_scraped += len(combined)
                    
                    print(f"Sukta {sukta_idx}: {len(combined)} riks | Mandala total: {mandala_riks} | Grand total: {total_riks_scraped}")
                
                if mandala_data:
                    backup_filename = f"rigveda_backup_mandala_{mandala_idx}.json"
                    with open(backup_filename, "w", encoding="utf-8") as f:
                        json.dump({f"Mandala {mandala_idx}": mandala_data}, f, ensure_ascii=False, indent=2)
                
                time.sleep(2)
                
            except Exception as e:
                print(f"ERROR processing Mandala {mandala_idx}, Sukta {sukta_idx}: {e}")
                print(f"Saving progress and stopping...")
                
                # Save current progress
                if mandala_data:
                    all_data[f"Mandala {mandala_idx}"] = mandala_data
                
                error_filename = f"rigveda_error_at_M{mandala_idx}_S{sukta_idx}.json"
                with open(error_filename, "w", encoding="utf-8") as f:
                    json.dump(all_data, f, ensure_ascii=False, indent=2)
                
                print(f"Progress saved to {error_filename}")
                print(f"To resume, use: start_mandala={mandala_idx}, start_sukta={sukta_idx+1}")
                
                return all_data

        if mandala_data:
            mandala_key = f"Mandala {mandala_idx}"
            all_data[mandala_key] = mandala_data
            print(f"COMPLETED MANDALA {mandala_idx}: {mandala_riks} riks")
        
        if all_data:
            progress_filename = f"rigveda_progress_through_mandala_{mandala_idx}.json"
            with open(progress_filename, "w", encoding="utf-8") as f:
                json.dump(all_data, f, ensure_ascii=False, indent=2)
        
        print(f"Progress saved through Mandala {mandala_idx}")
        time.sleep(5)

    print("\n" + "=" * 60)
    print(f"COMPLETE RIG VEDA SCRAPING FINISHED!")
    print(f"Total Riks Scraped: {total_riks_scraped}")
    print(f"Total Mandalas: {len(all_data)}")
    total_suktas = sum(len(mandala) for mandala in all_data.values())
    print(f"Total Suktas: {total_suktas}")
    print("=" * 60)
    
    return all_data

if __name__ == "__main__":
    print("COMPLETE RIG VEDA SCRAPER")
    print("=" * 60)
    
    # Check for existing progress files
    import os
    import glob
    
    progress_files = glob.glob("rigveda_progress_through_mandala_*.json")
    error_files = glob.glob("rigveda_error_at_M*_S*.json")
    
    resume_option = None
    resume_data = None
    
    if error_files:
        latest_error = max(error_files, key=os.path.getctime)
        print(f"\nFound error file: {latest_error}")
        
        # Extract mandala and sukta from filename
        match = re.search(r'M(\d+)_S(\d+)', latest_error)
        if match:
            error_mandala = int(match.group(1))
            error_sukta = int(match.group(2))
            
            print(f"Last error at: Mandala {error_mandala}, Sukta {error_sukta}")
            print(f"\nOptions:")
            print(f"1. Resume from Mandala {error_mandala}, Sukta {error_sukta}")
            print(f"2. Start fresh")
            
            choice = input("\nEnter your choice (1 or 2): ").strip()
            
            if choice == "1":
                with open(latest_error, "r", encoding="utf-8") as f:
                    resume_data = json.load(f)
                resume_option = (error_mandala, error_sukta)
                print(f"Resuming from Mandala {error_mandala}, Sukta {error_sukta}...")
    
    elif progress_files:
        latest_progress = max(progress_files, key=os.path.getctime)
        print(f"\nFound progress file: {latest_progress}")
        
        match = re.search(r'mandala_(\d+)', latest_progress)
        if match:
            last_mandala = int(match.group(1))
            
            print(f"Last completed: Mandala {last_mandala}")
            print(f"\nOptions:")
            print(f"1. Continue from Mandala {last_mandala + 1}")
            print(f"2. Start fresh")
            
            choice = input("\nEnter your choice (1 or 2): ").strip()
            
            if choice == "1":
                with open(latest_progress, "r", encoding="utf-8") as f:
                    resume_data = json.load(f)
                resume_option = (last_mandala + 1, 1)
                print(f"Continuing from Mandala {last_mandala + 1}...")
    
    if not resume_option:
        print("\nThis will scrape ALL 10 Mandalas, ALL Suktas, and ALL Riks")
        print("Estimated time: Several hours")
        print("Progress will be saved after each Sukta")
        print("\nStarting in 3 seconds...")
        time.sleep(3)
        resume_option = (1, 1)
    
    start_mandala, start_sukta = resume_option
    
    data = scrape_complete_rigveda(
        start_mandala=start_mandala, 
        start_sukta=start_sukta,
        resume_data=resume_data
    )
    
    if data:
        final_filename = "complete_rigveda_all_mandalas.json"
        print(f"\nSaving complete data to {final_filename}...")
        
        with open(final_filename, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"COMPLETE Rig Veda scraping finished!")
        print(f"Final file: {final_filename}")
        
        total_riks = sum(len(verses) for mandala in data.values() for verses in mandala.values())
        total_suktas = sum(len(mandala) for mandala in data.values())
        
        print(f"\nFINAL STATISTICS:")
        print(f"Mandalas: {len(data)}")
        print(f"Suktas: {total_suktas}")
        print(f"Riks: {total_riks}")
    else:
        print("No data was scraped. Check the URLs and website structure.")