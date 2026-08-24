#!/usr/bin/env bash
# render-check: screenshots + console errors + horizontal/VERTICAL overflow + node --check for an HTML page.
# usage: bash .claude/skills/render-check/render.sh <page.html> [out_dir] [sizes...]
#   sizes: "1440" (width only, height auto for a full-page shot)  or  "1024x768" (exact viewport = fit check)
#   default sizes: 1440 1024 375
# An exact WxH size reports voverflow=true when the page needs vertical scrolling at that viewport.
set -u
PAGE="$1"; shift || true
OUT="${1:-${CLAUDE_SCRATCHPAD:-/tmp/render-check}}"; [ $# -gt 0 ] && shift
SIZES=("$@"); [ ${#SIZES[@]} -eq 0 ] && SIZES=(1440 1024 375)
[ -f "$PAGE" ] || { echo "no such file: $PAGE"; exit 2; }
mkdir -p "$OUT"
NAME="$(basename "${PAGE%.*}")"
ABS="$(cd "$(dirname "$PAGE")" && pwd -W 2>/dev/null || pwd)/$(basename "$PAGE")"
URL="file:///${ABS//\\//}"
CH=""; for c in "/c/Program Files/Google/Chrome/Application/chrome.exe" "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" "$(command -v google-chrome 2>/dev/null)" "$(command -v chromium 2>/dev/null)"; do [ -n "$c" ] && [ -x "$c" ] && { CH="$c"; break; }; done
[ -n "$CH" ] || { echo "Chrome not found"; exit 2; }
REPORT="$OUT/$NAME-report.txt"; : > "$REPORT"; FAIL=0

# 1) node --check on inline scripts
python - "$PAGE" "$OUT/$NAME-inline.js" <<'PY'
import re,sys
src=open(sys.argv[1],encoding='utf-8').read()
parts=re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',src,flags=re.S|re.I)
open(sys.argv[2],'w',encoding='utf-8').write("\n;\n".join(parts))
print(f"inline scripts: {len(parts)}")
PY
if node --check "$OUT/$NAME-inline.js" 2>"$OUT/$NAME-syntax.txt"; then echo "syntax: OK" | tee -a "$REPORT"; else echo "syntax: FAIL" | tee -a "$REPORT"; cat "$OUT/$NAME-syntax.txt" | tee -a "$REPORT"; FAIL=1; fi

# 2) probe page: iframe forced to an exact viewport → h/v overflow + console errors, reported via document.title
PROBE="$OUT/$NAME-probe.html"
cat > "$PROBE" <<EOF
<!doctype html><meta charset=utf-8><body style="margin:0;background:#888">
<iframe id=f style="border:0;display:block"></iframe>
<script>
const errs=[];const f=document.getElementById('f');
const hash=location.hash.slice(1);                      // "<W>x<H>[shot]" or "<W>[shot]"
const shot=hash.endsWith('shot');const dim=(shot?hash.slice(0,-4):hash).split('x');
const W=parseInt(dim[0])||innerWidth, H=parseInt(dim[1])||innerHeight;
f.style.width=W+'px'; f.style.height=H+'px'; f.src="$URL";
f.addEventListener('load',()=>{try{const w=f.contentWindow,d=w.document;
 w.addEventListener('error',e=>errs.push('uncaught: '+e.message));
 const oe=w.console.error;w.console.error=(...a)=>{errs.push('console.error: '+a.join(' '));oe.apply(w.console,a)};
 setTimeout(()=>{const e=d.documentElement;
  const ho=e.scrollWidth>e.clientWidth+1, vo=e.scrollHeight>e.clientHeight+1;
  document.title='RC|'+w.innerWidth+'x'+w.innerHeight+'|overflow='+ho+'|voverflow='+vo
    +'|sw='+e.scrollWidth+'|cw='+e.clientWidth+'|sh='+e.scrollHeight+'|ch='+e.clientHeight
    +'|errors='+errs.length+(errs.length?'|'+errs.join(' ;; '):'');},4000);
}catch(e){document.title='RC|probe-failed|'+e.message}});
</script></body>
EOF
PROBE_ABS="$(cd "$OUT" && pwd -W 2>/dev/null || pwd)/$NAME-probe.html"; PROBE_URL="file:///${PROBE_ABS//\\//}"
OUTW="$(cd "$OUT" && pwd -W 2>/dev/null || pwd)"

for S in "${SIZES[@]}"; do
  W="${S%%x*}"; H_EXACT=""; case "$S" in *x*) H_EXACT="${S##*x}";; esac
  # screenshot height: exact viewport when given, else a tall full-page canvas
  if [ -n "$H_EXACT" ]; then SH="$H_EXACT"; else SH=$(( W>=1024 ? 2400 : 3200 )); fi
  # Chrome clamps windows below ~500px wide; render through the probe (iframe forced to the exact size)
  if [ "$W" -lt 500 ] || [ -n "$H_EXACT" ]; then
    SHOT_URL="$PROBE_URL#${S}shot"; SHOT_FLAGS="--allow-file-access-from-files"
    PAD=$(( H_EXACT != 0 ? 0 : 0 )); WINH=$SH
  else SHOT_URL="$URL"; SHOT_FLAGS=""; WINH=$SH; fi
  "$CH" --headless=new --disable-gpu --hide-scrollbars $SHOT_FLAGS --window-size=${W},${WINH} --virtual-time-budget=6000 \
        --screenshot="$OUTW\\$NAME-$S.png" "$SHOT_URL" >/dev/null 2>&1
  T=$("$CH" --headless=new --disable-gpu --allow-file-access-from-files --window-size=$((W+40)),$(( ${H_EXACT:-900} + 40 )) --virtual-time-budget=8000 --dump-dom "$PROBE_URL#$S" 2>/dev/null | grep -o '<title>[^<]*</title>' | sed 's/<[^>]*>//g')
  echo "size $S: ${T:-no-probe-result}" | tee -a "$REPORT"
  # note the leading "|" — without it this glob also matches "voverflow=true"
  case "$T" in *"|overflow=true"*|*errors=[1-9]*|*probe-failed*) FAIL=1;; esac
  # vertical overflow only fails the run for exact-viewport sizes (a full page is expected to be tall)
  if [ -n "$H_EXACT" ]; then case "$T" in *voverflow=true*) FAIL=1;; esac; fi
done
echo "screenshots: $OUT/$NAME-<size>.png" | tee -a "$REPORT"
echo "report: $REPORT"; exit $FAIL
