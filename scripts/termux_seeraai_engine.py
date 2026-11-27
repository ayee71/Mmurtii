#!/usr/bin/env python3
"""
==============================================================================
SEERAAI PRO - ELITE ETHIOPIAN LEGAL INTELLIGENCE ENGINE (TERMUX EDITION v5.2)
==============================================================================
Sirna Qorannoo fi Xiinxala Seeraa Afaan Oromoo, አማርኛ, fi English.
- 3,304+ Murtiilee Dhaddacha Ijibbaataa & Labsiiwwan (@seeraai_ethio/125+)
- Gemini AI & OpenAI ChatGPT Dual Engine Support
- Advanced Semantic & Token Scoring with Safe Chunking
- Termux CLI Interactive Mode & Live API Integration
==============================================================================
"""

import sys
import os
import json
import time
import argparse
import urllib.request
import urllib.parse
import urllib.error
import ssl
import re

DEFAULT_API_BASE = "https://ais-pre-4awllzboxdldjxf2nmehfj-551578258786.europe-west3.run.app"
TELEGRAM_CHANNEL = "seeraai_ethio"
TELEGRAM_ARCHIVE_BASE = "https://t.me/seeraai_ethio"

# ANSI Terminal Colors
BOLD = "\033[1m"
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
RED = "\033[91m"
MAGENTA = "\033[95m"
RESET = "\033[0m"

# In-memory Archive Cache
_ARCHIVE_CACHE = None


def print_banner():
    banner = f"""
{CYAN}{BOLD}╔════════════════════════════════════════════════════════════════════╗
║                   ⚖️  SEERAAI PRO (TERMUX EDITION v5.2)            ║
║           Ethiopian & Oromia Legal Intelligence System             ║
║     3,304+ Precedents • Proclamations • Telegram Archive Sync      ║
╚════════════════════════════════════════════════════════════════════╝{RESET}
{YELLOW}• Official Telegram Archive:{RESET} {TELEGRAM_ARCHIVE_BASE} (Starting Post #125+)
{YELLOW}• Dual AI Engine:{RESET} Gemini 4 / 2.5 Pro + ChatGPT (GPT-4o)
{YELLOW}• Mode:{RESET} Daangaa tokko malee gaaffii seeraa kamiyyuu deebisa (Unrestricted)
"""
    print(banner)


def make_http_request(url, method="GET", payload=None, headers=None, timeout=30):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req_headers = {
        "User-Agent": "SeeraAI-Termux-Client/5.2",
        "Accept": "application/json",
    }
    if headers:
        req_headers.update(headers)

    data_bytes = None
    if payload is not None:
        if isinstance(payload, (dict, list)):
            data_bytes = json.dumps(payload).encode("utf-8")
            req_headers["Content-Type"] = "application/json"
        elif isinstance(payload, str):
            data_bytes = payload.encode("utf-8")

    req = urllib.request.Request(url, data=data_bytes, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw_body = resp.read().decode("utf-8", errors="replace")
            status = resp.status
            try:
                return {"status": status, "data": json.loads(raw_body), "raw": raw_body}
            except json.JSONDecodeError:
                return {"status": status, "data": None, "raw": raw_body}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return {"status": e.code, "error": str(e), "raw": err_body}
    except Exception as e:
        return {"status": 0, "error": str(e)}


def get_archive_paths():
    home = os.path.expanduser("~")
    return [
        os.path.join(home, "seeraai_engine", "telegram-archive-master.json"),
        os.path.join(home, ".seeraai", "telegram-archive-master.json"),
        "telegram-archive-master.json",
        "public/telegram-archive-master.json",
        "/app/applet/public/telegram-archive-master.json"
    ]


def load_archive_files(api_base=DEFAULT_API_BASE):
    global _ARCHIVE_CACHE
    if _ARCHIVE_CACHE is not None:
        return _ARCHIVE_CACHE

    for path in get_archive_paths():
        if os.path.exists(path) and os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "files" in data:
                        _ARCHIVE_CACHE = data["files"]
                        return _ARCHIVE_CACHE
                    elif isinstance(data, list):
                        _ARCHIVE_CACHE = data
                        return _ARCHIVE_CACHE
            except Exception:
                pass

    home = os.path.expanduser("~")
    target_dir = os.path.join(home, "seeraai_engine")
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, "telegram-archive-master.json")

    url = f"{api_base}/telegram-archive-master.json"
    res = make_http_request(url, timeout=15)
    if res.get("status") == 200 and isinstance(res.get("data"), dict):
        files = res["data"].get("files", [])
        if files:
            _ARCHIVE_CACHE = files
            try:
                with open(target_path, "w", encoding="utf-8") as f:
                    json.dump(res["data"], f)
            except Exception:
                pass
            return _ARCHIVE_CACHE

    _ARCHIVE_CACHE = []
    return _ARCHIVE_CACHE


def clean_tokens(text):
    stop_words = {
        "kana", "kan", "fi", "yoo", "akka", "maal", "maaliif", "eessa", "yoom", "eenyu",
        "akkam", "jedha", "jedhamu", "keessatti", "irratti", "irraa", "gara", "booda",
        "erga", "ture", "tahe", "tahu", "qabaa", "qaba", "qabu", "dandaaa", "dandaa",
        "jiraa", "jira", "jiru", "waggaa", "meeqa", "kamiyyuu", "hunda", "guyyaa",
        "the", "and", "for", "with", "from", "what", "when", "how", "does", "into",
        "እና", "ወይም", "ምን", "እንዴት", "ለምን", "ይላል"
    }
    cleaned = text.lower().replace("'", "").replace("’", "").replace("`", "")
    words = re.findall(r"[\w-]+", cleaned)
    return [w for w in words if len(w) >= 2 and w not in stop_words]


def search_all_archive_precedents(query_text, api_base=DEFAULT_API_BASE, limit=6):
    """
    Advanced semantic and multi-factor scoring across all 3,304+ Telegram archive files starting from post #125.
    """
    files = load_archive_files(api_base=api_base)
    tokens = clean_tokens(query_text)
    stems = [t[:5] for t in tokens if len(t) >= 5]
    num_matches = re.findall(r"\b\d{3,7}\b", query_text)

    q_lower = query_text.lower()
    scored = []

    if not files:
        encoded = urllib.parse.quote(query_text)
        url = f"{api_base}/api/telegram/archive-1500?q={encoded}&limit={limit}"
        res = make_http_request(url, timeout=10)
        if res.get("status") == 200 and isinstance(res.get("data"), dict):
            return res["data"].get("files", [])
        return []

    for f in files:
        score = 0
        file_num = str(f.get("fileNumber", ""))
        post_num = str(f.get("postNumber", ""))
        volume = str(f.get("volume", ""))
        cat = f.get("category", "")

        t_om = f.get("title", {}).get("om", "") if isinstance(f.get("title"), dict) else str(f.get("title", ""))
        t_en = f.get("title", {}).get("en", "") if isinstance(f.get("title"), dict) else ""
        p_om = f.get("principle", {}).get("om", "") if isinstance(f.get("principle"), dict) else str(f.get("principle", ""))
        p_en = f.get("principle", {}).get("en", "") if isinstance(f.get("principle"), dict) else ""
        s_om = f.get("summary", {}).get("om", "") if isinstance(f.get("summary"), dict) else str(f.get("summary", ""))
        art_om = f.get("keyArticles", {}).get("om", "") if isinstance(f.get("keyArticles"), dict) else ""

        full_haystack = f"{t_om} {t_en} {p_om} {p_en} {s_om} {art_om} {volume}".lower().replace("'", "").replace("’", "")

        # 1. Exact File Number or Post Number Match
        for num in num_matches:
            if num == file_num or num == post_num:
                score += 100

        # 2. Token Matching
        for t in tokens:
            if len(t) < 3:
                continue
            if t in t_om.lower():
                score += 25
            elif t in p_om.lower():
                score += 20
            elif t in s_om.lower():
                score += 12
            elif t in art_om.lower():
                score += 15
            elif t in full_haystack:
                score += 6

        # 3. Stem Matching
        for s in stems:
            if len(s) >= 4:
                if s in t_om.lower():
                    score += 10
                elif s in p_om.lower():
                    score += 8
                elif s in full_haystack:
                    score += 4

        # 4. Domain & Category Boosts
        if any(w in q_lower for w in ["hojjat", "hojii", "beenya", "haaroms", "ari"]):
            if cat == "labor" or "hojii" in full_haystack:
                score += 20
        if any(w in q_lower for w in ["lafa", "qabiyyee", "daangaa", "baadiyaa"]):
            if cat == "land" or "lafa" in full_haystack:
                score += 20
        if any(w in q_lower for w in ["dhaala", "gaaila", "maatii", "walfu"]):
            if cat == "family" or "dhaala" in full_haystack:
                score += 20
        if any(w in q_lower for w in ["bittaa", "gurgurtaa", "waliigaltee", "manaa"]):
            if cat in ["civil", "procedure"] or "waliigaltee" in full_haystack:
                score += 20
        if any(w in q_lower for w in ["yakka", "wabiin", "hidhaa", "shakk"]):
            if cat == "criminal" or "yakka" in full_haystack:
                score += 20

        if score > 0:
            scored.append((score, f))

    if scored:
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:limit]]

    return files[:limit]


def query_seeraai_api(api_base, question, language="om", mode="deep"):
    url = f"{api_base}/api/legal/ask"
    payload = {
        "question": question,
        "language": language,
        "mode": mode,
        "includeUnverifiedWarnings": True
    }
    print(f"{CYAN}⏳ Qorannoo gadi-fagoo (Deep Search) Telegram Archive (@seeraai_ethio/125+) fi Heera/Labsiiwwanii eegalaa jira...{RESET}")
    res = make_http_request(url, method="POST", payload=payload, timeout=60)
    if res.get("status") == 200 and isinstance(res.get("data"), dict):
        return res["data"]
    return None


def query_gemini_direct(api_key, question, grounding_context=""):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent?key={api_key}"
    sys_instruction = """Ati SEERAAI PRO: Sirna AI qorannoo seeraa, xiinxala galmee mana murtii, fi murtii dhaddacha ijibbaataa isa olaanaa dha.
Gaaffii seeraa dhiyaateef caasaa armaan gadii qofa hordofi:
1. Ibsa Gabaabaa: Qabiyyee ijoo gaaffichaa gabaabsi.
2. Xiinxala Seeraa & Keewwata: Labsii, Dambii, fi Keewwata sirrii caqasi.
3. Murtiilee Dhaddacha Ijibbaataa & Madda Telegram:
   - Galmee Lakkoofsa: Galmee Lakk. [____]
   - Jildii: Jildii [____]
   - Madda Telegram: @seeraai_ethio
   - Linkii Postii Telegram: https://t.me/seeraai_ethio/[PostNumber] (Archive starting post #125+)
   - Qajeeltoo Dirqisiisaa (Ratio Decidendi)
4. Furmaata / Tarkaanfii Seeraa: Tarkaanfii qabatamaa tarreessi.
5. Akeekkachiisa: "Kun hubannoo seeraatiif kan qophaa'e qofa; gorsa ogeessa seeraa (abukaatoo) bakka hin bu'u."
"""
    prompt = f"RAGAA SEERAA FI MURTIILEE DHADDACHA IJIBBAATAA (@seeraai_ethio):\n{grounding_context}\n\nGaaffii Seeraa:\n{question}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": sys_instruction}]},
        "generationConfig": {"maxOutputTokens": 2500}
    }
    res = make_http_request(url, method="POST", payload=payload, timeout=35)
    if res.get("status") == 200 and res.get("data"):
        try:
            return res["data"]["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            pass
    return None


def query_openai_direct(api_key, question, grounding_context=""):
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"}
    sys_instruction = """Ati SEERAAI PRO (OpenAI ChatGPT Engine) dha. Qorannoo seeraa Itoophiyaa fi Naannoo Oromiyaa keessatti keeyyata labsii, dambii fi murtii Dhaddacha Ijibbaataa sirrii caqasuun deebii qindaa'aa dhiyeessi.
Caasaa Dhaabbataa:
1. Ibsa Gabaabaa
2. Xiinxala Seeraa (Heera, Labsii, Keewwata)
3. Murtiilee Dhaddacha Ijibbaataa (Galmee Lakk., Jildii, Linkii https://t.me/seeraai_ethio/..., Ratio Decidendi)
4. Furmaata Seeraa
5. Akeekkachiisa: "Kun hubannoo seeraatiif kan qophaa'e qofa; gorsa ogeessa seeraa (abukaatoo) bakka hin bu'u."
"""
    prompt = f"RAGAA SEERAA FI MURTIILEE DHADDACHA IJIBBAATAA (@seeraai_ethio):\n{grounding_context}\n\nGaaffii Seeraa:\n{question}"
    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": sys_instruction},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }
    res = make_http_request(url, method="POST", payload=payload, headers=headers, timeout=35)
    if res.get("status") == 200 and res.get("data"):
        try:
            return res["data"]["choices"][0]["message"]["content"]
        except Exception:
            pass
    return None


def execute_legal_analysis(question, api_base=DEFAULT_API_BASE, lang="om", force_dual=False):
    print(f"\n{BOLD}{YELLOW}🔍 Sakatta'iinsa Galmee & Madda Telegram (@seeraai_ethio/125+) Eegaleera...{RESET}")
    matches = search_all_archive_precedents(question, api_base=api_base, limit=6)

    grounding_blocks = []
    print(f"\n{GREEN}{BOLD}✓ Murtiilee Ijibbaataa fi Sanadoota Seeraa Argaman:{RESET}")
    for idx, f in enumerate(matches, 1):
        f_num = f.get("fileNumber") or f.get("referenceNumber", "Unknown")
        p_num = f.get("postNumber", 125)
        p_url = f.get("postUrl") or f"{TELEGRAM_ARCHIVE_BASE}/{p_num}"
        vol = f.get("volume", "Jildii Dhaddacha Ijibbaataa")

        title_om = f.get("title", {}).get("om") if isinstance(f.get("title"), dict) else str(f.get("title", ""))
        principle_om = f.get("principle", {}).get("om") if isinstance(f.get("principle"), dict) else str(f.get("principle", ""))
        articles_om = f.get("keyArticles", {}).get("om") if isinstance(f.get("keyArticles"), dict) else ""

        block = (
            f"🏛️ MURTII #{idx}: Galmee Lakk. {f_num} ({vol})\n"
            f"• Mata-duree: {title_om}\n"
            f"• Qajeeltoo Dirqisiisaa: {principle_om}\n"
            f"• Seera/Labsii: {articles_om}\n"
            f"• Madda Telegram: @seeraai_ethio -> {p_url}"
        )
        grounding_blocks.append(block)
        print(f"  {CYAN}[{idx}] Galmee Lakk. {f_num}{RESET} ({vol})")
        print(f"      Mata-duree: {title_om}")
        print(f"      Linkii: {YELLOW}{p_url}{RESET}")

    grounding_context = "\n\n".join(grounding_blocks)

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    if force_dual or (gemini_key and openai_key):
        print(f"\n{MAGENTA}{BOLD}⚡ DUAL AI ENGINE: Gemini 4 Hydrogen + ChatGPT (GPT-4o) Sakatta'aa jiru...{RESET}")
        gemini_ans = query_gemini_direct(gemini_key, question, grounding_context) if gemini_key else None
        openai_ans = query_openai_direct(openai_key, question, grounding_context) if openai_key else None

        if gemini_ans or openai_ans:
            print(f"\n{GREEN}{BOLD}═══════════════ [1] DEEBII GEMINI AI ENGINE ═══════════════{RESET}\n")
            print(gemini_ans or "Gemini API deebii hin kennine.")
            print(f"\n{CYAN}{BOLD}═══════════════ [2] DEEBII CHATGPT (GPT-4o) ENGINE ═══════════════{RESET}\n")
            print(openai_ans or "ChatGPT API deebii hin kennine.")
            print(f"\n{YELLOW}{BOLD}═══════════════════════════════════════════════════════════════{RESET}")
            return

    api_result = query_seeraai_api(api_base, question, language=lang)
    if api_result and api_result.get("answer"):
        print(f"\n{GREEN}{BOLD}═══════════════ DEEBII SEERAAI PRO (Dual AI Integrated) ═══════════════{RESET}\n")
        print(api_result["answer"])
        print(f"\n{GREEN}{BOLD}═══════════════════════════════════════════════════════════════════════{RESET}")
        return

    if gemini_key:
        print(f"{CYAN}Direct Gemini 4 Hydrogen Engine fayyadamuun xiinxalaa jira...{RESET}")
        ans = query_gemini_direct(gemini_key, question, grounding_context)
        if ans:
            print(f"\n{GREEN}{BOLD}═══════════════ DEEBII SEERAAI (Gemini AI) ═══════════════{RESET}\n")
            print(ans)
            print(f"\n{GREEN}{BOLD}═══════════════════════════════════════════════════════════{RESET}")
            return

    if openai_key:
        print(f"{CYAN}Direct ChatGPT (GPT-4o) Engine fayyadamuun xiinxalaa jira...{RESET}")
        ans = query_openai_direct(openai_key, question, grounding_context)
        if ans:
            print(f"\n{GREEN}{BOLD}═══════════════ DEEBII SEERAAI (ChatGPT GPT-4o) ═══════════════{RESET}\n")
            print(ans)
            print(f"\n{GREEN}{BOLD}════════════════════════════════════════════════════════════════{RESET}")
            return

    print(f"\n{YELLOW}{BOLD}⚠️ Murtiilee Dhaddacha Ijibbaataa & Ragaalee Seeraa (@seeraai_ethio/125+):{RESET}\n")
    if grounding_blocks:
        for b in grounding_blocks:
            print(f"{CYAN}{b}{RESET}\n")
    else:
        print(f"{RED}Galmeen addaa hin argamne.{RESET}")


def interactive_loop(api_base, force_dual=False):
    print_banner()
    print(f"{BOLD}Akkam, Baga nagaan dhuftan! Gaaffii seeraa keessan kamiyyuu asitti barreessaa.{RESET}")
    print(f"Cufuu yoo barbaaddan '{RED}exit{RESET}' ykn '{RED}q{RESET}' jedhaa barreessaa.\n")

    while True:
        try:
            q = input(f"{BOLD}{GREEN}SEERAAI >> {RESET}").strip()
            if not q:
                continue
            if q.lower() in ["exit", "quit", "q"]:
                print(f"{YELLOW}Nagaatti! SEERAAI fayyadamuu keessaniif galatoomaa.{RESET}")
                break
            execute_legal_analysis(q, api_base=api_base, force_dual=force_dual)
            print("\n" + "─" * 65 + "\n")
        except (KeyboardInterrupt, EOFError):
            print(f"\n{YELLOW}Cufameera.{RESET}")
            break


def main():
    parser = argparse.ArgumentParser(
        description="SEERAAI PRO - Termux Legal Search & Dual AI Engine (v5.2)",
        epilog="Fakkeenya: seeraai 'gaaffii kamiyyuu' YKN seeraai (bifa marii)"
    )
    parser.add_argument("prompt", nargs="*", help="Gaaffii seeraa kamiyyuu (Any legal query without flags)")
    parser.add_argument("-q", "--query", type=str, help="Gaaffii seeraa gaafachuuf")
    parser.add_argument("-s", "--search", type=str, help="Murtiilee fi labsiiwwan sakatta'uuf")
    parser.add_argument("-i", "--interactive", action="store_true", help="Bifa mariitiin (Interactive CLI) banuuf")
    parser.add_argument("--dual", action="store_true", help="Dual AI (Gemini + ChatGPT) wal bira qabee akka deebisuuf")
    parser.add_argument("--api", type=str, default=DEFAULT_API_BASE, help="Server Base URL")
    args = parser.parse_args()

    load_archive_files(api_base=args.api)

    if args.search:
        print_banner()
        print(f"{CYAN}Sakatta'a: '{args.search}'{RESET}")
        matches = search_all_archive_precedents(args.search, api_base=args.api, limit=10)
        print(f"\n{GREEN}Bu'aa argame: {len(matches)}{RESET}\n")
        for idx, m in enumerate(matches, 1):
            f_num = m.get("fileNumber") or m.get("referenceNumber", "Unknown")
            p_num = m.get("postNumber", 125)
            p_url = m.get("postUrl") or f"{TELEGRAM_ARCHIVE_BASE}/{p_num}"
            vol = m.get("volume", "Jildii Dhaddacha Ijibbaataa")
            t_om = m.get("title", {}).get("om") if isinstance(m.get("title"), dict) else str(m.get("title", ""))
            p_om = m.get("principle", {}).get("om") if isinstance(m.get("principle"), dict) else str(m.get("principle", ""))
            print(f"{YELLOW}[{idx}] Galmee Lakk.:{RESET} {f_num} ({vol})")
            print(f"    {BOLD}Mata-duree:{RESET} {t_om}")
            print(f"    {BOLD}Qajeeltoo:{RESET} {p_om}")
            print(f"    {BOLD}Madda Telegram:{RESET} {p_url}\n")
        return

    query_text = args.query or (" ".join(args.prompt).strip() if args.prompt else "")
    if query_text:
        print_banner()
        execute_legal_analysis(query_text, api_base=args.api, force_dual=args.dual)
        return

    interactive_loop(args.api, force_dual=args.dual)


if __name__ == "__main__":
    main()
