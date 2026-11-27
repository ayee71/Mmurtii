#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# SEERAAI PRO - ONE-CLICK INSTALLER FOR TERMUX (ANDROID)
# ==============================================================================
# Run with:
#   curl -sSL https://ais-pre-4awllzboxdldjxf2nmehfj-551578258786.europe-west3.run.app/setup_termux.sh | bash
# OR:
#   bash scripts/setup_termux.sh
# ==============================================================================

set -e

echo -e "\033[1;36m"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║             ⚖️  SEERAAI PRO TERMUX INSTALLER (v5.0)            ║"
echo "║          Sirna Qorannoo Seeraa & Murtiilee Ijibbaataa          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "\033[0m"

echo -e "\033[1;33m[1/4] Meeshaalee bu'uuraa (Python, Curl) mirkaneessaa jira...\033[0m"
pkg update -y || true
pkg install -y python curl || true

INSTALL_DIR="$HOME/seeraai_engine"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo -e "\033[1;33m[2/4] Koodii SeeraAI Engine fi Sanadoota Telegram Archive 3,304+ buufataa jira...\033[0m"

# Try downloading via curl, fallback to python urllib if DNS fails
python3 -c "
import urllib.request, ssl, os
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base = 'https://ais-pre-4awllzboxdldjxf2nmehfj-551578258786.europe-west3.run.app'
for fname in ['termux_seeraai_engine.py', 'telegram-archive-master.json']:
    try:
        url = f'{base}/{fname}'
        print(f'Downloading {fname}...')
        req = urllib.request.Request(url, headers={'User-Agent': 'SeeraAI-Termux'})
        with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
            with open(fname, 'wb') as f:
                f.write(resp.read())
        print(f'Successfully downloaded {fname}')
    except Exception as e:
        print(f'Warning downloading {fname}: {e}')
" || {
  echo -e "\033[1;31mNetwork irraa buusuu hin danda'amne. Maaloo DNS 1.1.1.1 qindeessi ykn internetii kee ilaali.\033[0m"
}

# Create shortcut in Termux bin
BIN_PATH="/data/data/com.termux/files/usr/bin/seeraai"
cat << 'EOF' > "$BIN_PATH"
#!/data/data/com.termux/files/usr/bin/bash
python3 "$HOME/seeraai_engine/termux_seeraai_engine.py" "$@"
EOF
chmod +x "$BIN_PATH"

echo -e "\033[1;32m[3/4] Shortcut 'seeraai' milkaa'inaan uumameera!\033[0m"

echo -e "\033[1;36m"
echo "=================================================================="
echo "🎉 FE'INSI MILKAAYEERA! (INSTALLATION COMPLETED)"
echo "=================================================================="
echo -e "\033[0m"
echo -e "Amma Termux keessatti ajajoota armaan gadii daangaa tokko malee fayyadami:"
echo -e "  \033[1;32mseeraai\033[0m                      -> Bifa marii (Interactive Chat) banuuf"
echo -e "  \033[1;32mseeraai <gaaffii kamiyyuu>\033[0m   -> Gaaffii seeraa kamiyyuu kallattiin gaafachuuf"
echo -e "  \033[1;32mseeraai --dual <gaaffii>\033[0m     -> Gemini AI fi ChatGPT wal bira qabee deebisuuf"
echo -e "  \033[1;32mseeraai -s <lakk/jecha>\033[0m      -> Sanadoota Telegram 3,304+ sakatta'uuf"
echo ""
echo -e "\033[1;33m(Filannoo) Gemini AI fi ChatGPT API Keys galchuuf:\033[0m"
echo "  export GEMINI_API_KEY=\"API_KEY_KEE\""
echo "  export OPENAI_API_KEY=\"API_KEY_KEE\""
echo "=================================================================="

# Launch interactive mode right now
exec seeraai -i
