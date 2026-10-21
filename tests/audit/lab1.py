"""Banc 1 : tailles d'écran, débordements, zones tactiles, accessibilité (axe) — copie locale, fausses données."""
import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
FAUX = open(os.path.join(ICI, "audit_faux.js"), encoding="utf-8").read()
AXE = open(os.path.join(ICI, "node_modules/axe-core/axe.min.js"), encoding="utf-8").read()
srv = subprocess.Popen([sys.executable, os.path.join(ICI, "srv.py"), "8771", RACINE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)

VUES = [(320, 568), (360, 740), (390, 844), (768, 1024), (1366, 768)]
VISITEUR = ["engagement", "testIntro", "inscription", "connexion"]
CONNECTE = ["aujourdhui", "revisions", "grille", "cahier", "compte", "pourtoi", "top", "recherche", "parcours", "proposer", "apparence"]

MESURE = """() => {
  const L = window.innerWidth;
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < 99999; };
  const decrire = (e) => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + ' « ' + (e.innerText || e.getAttribute('aria-label') || e.placeholder || '').trim().slice(0, 30) + ' »');
  const debord = [];
  document.querySelectorAll('body *').forEach(e => { if(!vis(e)) return; const r = e.getBoundingClientRect();
    if(r.right > L + 1 && !e.closest('#facade') && getComputedStyle(e).position !== 'fixed') debord.push(decrire(e) + ' droite=' + Math.round(r.right)); });
  const cibles = Array.from(document.querySelectorAll('button, a[href], [data-go], [role=button], input:not([type=hidden]), select, textarea, [data-matiere], [tabindex="0"]')).filter(vis);
  const p44 = [], p24 = [];
  cibles.forEach(e => { const r = e.getBoundingClientRect(); if(r.width < 24 || r.height < 24) p24.push(decrire(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    else if(r.width < 44 || r.height < 44) p44.push(decrire(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  let petit = 0; const petits = [];
  document.querySelectorAll('body *').forEach(e => { if(!vis(e)) return; const aTexte = Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if(aTexte){ const f = parseFloat(getComputedStyle(e).fontSize); if(f < 12){ petit++; if(petits.length < 3) petits.push(decrire(e) + ' ' + f + 'px'); } } });
  return { largeurDoc: document.documentElement.scrollWidth, L, debordHorizontal: document.documentElement.scrollWidth > L + 1,
    debord: debord.slice(0, 4), nDebord: debord.length, nCibles: cibles.length, sous24: p24.length, sous44: p44.length,
    ex24: p24.slice(0, 4), ex44: p44.slice(0, 3), texteSous12: petit, exPetits: petits };
}"""

def nouvelle_page(nav, l, h, visiteur):
    ctx = nav.new_context(viewport={"width": l, "height": h}, service_workers="block", locale="fr-FR")
    if not visiteur:
        ctx.add_init_script("localStorage.setItem('monconcours.candidat', JSON.stringify({dejaVenu:true, nom:'Test Candidat', tel:'70000000', niveau:'terminale'}));")
    ctx.add_init_script("window.__visiteur = %s;" % ("true" if visiteur else "false"))
    page = ctx.new_page()
    erreurs = []
    page.on("pageerror", lambda e: erreurs.append(str(e)[:160]))
    page.route("**/supabase-js.min.js*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAUX))
    page.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
    page.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    page.goto("http://127.0.0.1:8771/index.html")
    page.wait_for_function("typeof S !== 'undefined' && typeof base !== 'undefined' && base !== null", timeout=15000)
    page.wait_for_timeout(1200)
    return ctx, page, erreurs

res = {"mesures": {}, "axe": {}, "erreurs_js": {}}
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        for (l, h) in VUES:
            for visiteur, ecrans in ((True, VISITEUR), (False, CONNECTE)):
                ctx, page, erreurs = nouvelle_page(nav, l, h, visiteur)
                if not visiteur:
                    page.evaluate("S.sessionPrete = true")
                for e in ecrans:
                    try:
                        page.evaluate("(e) => aller(e)", e) if (e != 'engagement') else page.evaluate("(e) => { S.ecran = e; rendre(); }", e)
                        page.wait_for_timeout(900)
                        m = page.evaluate(MESURE)
                        m["rendu"] = page.evaluate("document.getElementById('vue').innerText.trim().length")
                        res["mesures"]["%dx%d|%s" % (l, h, e)] = m
                        if l == 390:
                            page.add_script_tag(content=AXE)
                            ax = page.evaluate("""async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] } });
                                return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, aide: v.help, ex: v.nodes.slice(0, 2).map(n => n.html.slice(0, 110)) })); }""")
                            res["axe"][e] = ax
                        if (l in (360, 1366)) and e in ("aujourdhui", "revisions", "grille", "cahier", "compte", "engagement", "connexion", "top"):
                            page.screenshot(path=os.path.join(ICI, "ecran_%s_%d.png" % (e, l)))
                    except Exception as ex:
                        res["mesures"]["%dx%d|%s" % (l, h, e)] = {"erreur": str(ex)[:200]}
                res["erreurs_js"]["%dx%d|%s" % (l, h, "visiteur" if visiteur else "connecte")] = sorted(set(erreurs))[:5]
                ctx.close()
        nav.close()
finally:
    srv.terminate()
json.dump(res, open(os.path.join(ICI, "lab1.json"), "w"), ensure_ascii=False, indent=1)
print("fini", len(res["mesures"]), "mesures")
