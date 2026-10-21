"""Banc 4 : on touche chaque bouton visible de chaque écran (copie locale, fausses données) et on note erreurs JS et boutons sans aucun effet visible."""
import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
FAUX = open(os.path.join(ICI, "audit_faux.js"), encoding="utf-8").read()
srv = subprocess.Popen([sys.executable, os.path.join(ICI, "srv.py"), "8775", RACINE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
ECRANS = ["aujourdhui", "revisions", "cahier", "compte", "pourtoi", "top", "recherche", "parcours", "proposer", "apparence", "grille"]
EXCLUS = r"supprimer|déconnect|quitter|remettre|effacer|bannir"
LISTE = """() => Array.from(document.querySelectorAll('#vue button, #vue [data-go], #vue a[href], #apptete button, #nav button, #rail button')).map((e, i) => {
  const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
  return { i, ok: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none', txt: ((e.innerText || e.getAttribute('aria-label') || e.title || '') + '').trim().slice(0, 40).replace(/\\n/g, ' '), tag: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') }; })"""
EMPREINTE = "() => JSON.stringify([S.ecran, !!S.modal, (document.getElementById('vue')||{}).innerHTML.length, (document.getElementById('voile')||{}).innerHTML.length, document.getElementById('voile') && document.getElementById('voile').hidden, document.body.className, (document.getElementById('apptete')||{}).innerHTML.length, (window.__ouvertures||[]).length, (document.getElementById('annonce')||{}).innerText, document.querySelector('.toast, .pastille-info') ? 1 : 0, localStorage.length, JSON.stringify(window.__appels || []).length])"
res = {"total": 0, "sans_effet": [], "erreurs": []}
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        ctx = nav.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        ctx.add_init_script("localStorage.setItem('monconcours.candidat', JSON.stringify({dejaVenu:true, nom:'Test Candidat', tel:'70000000', niveau:'terminale'}));")
        ctx.add_init_script("window.__ouvertures = []; window.open = (...a) => { window.__ouvertures.push(a[0]); return null; }; window.print = () => { window.__ouvertures.push('print'); };")
        page = ctx.new_page()
        page.on("dialog", lambda d: d.dismiss())
        page.on("pageerror", lambda e: res["erreurs"].append(str(e)[:150]))
        page.route("**/supabase-js.min.js*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAUX))
        page.route("**/fonts.*/**", lambda r: r.abort())
        page.route("**/*.supabase.co/**", lambda r: r.abort())
        page.goto("http://127.0.0.1:8775/index.html")
        page.wait_for_function("typeof S !== 'undefined' && base !== null", timeout=15000); page.wait_for_timeout(1500)
        for e in ECRANS:
            page.evaluate("(e) => aller(e)", e); page.wait_for_timeout(900)
            liste = page.evaluate(LISTE)
            for b in liste:
                if not b["ok"]: continue
                import re
                if re.search(EXCLUS, b["txt"], re.I): continue
                page.evaluate("(e) => aller(e)", e); page.wait_for_timeout(500)
                page.evaluate("document.getElementById('voile') && (document.getElementById('voile').hidden = true)")
                els = page.query_selector_all('#vue button, #vue [data-go], #vue a[href], #apptete button, #nav button, #rail button')
                if b["i"] >= len(els): continue
                el = els[b["i"]]
                try:
                    if not el.is_visible(): continue
                    avant = page.evaluate(EMPREINTE)
                    el.click(timeout=1500, no_wait_after=True)
                    page.wait_for_timeout(350)
                    apres = page.evaluate(EMPREINTE)
                    res["total"] += 1
                    if avant == apres: res["sans_effet"].append((e, b["tag"], b["txt"]))
                except Exception as ex:
                    res["erreurs"].append("clic %s/%s : %s" % (e, b["txt"], str(ex)[:70]))
        nav.close()
finally:
    srv.terminate()
json.dump(res, open(os.path.join(ICI, "lab4.json"), "w"), ensure_ascii=False, indent=1)
print("boutons touchés :", res["total"], "| sans effet visible :", len(res["sans_effet"]), "| erreurs :", len(set(res["erreurs"])))
for x in res["sans_effet"][:40]: print("  sans effet:", x)
for x in sorted(set(res["erreurs"]))[:15]: print("  erreur:", x)
