"""Banc 2 : pages hostiles — des textes pièges dans les noms, énoncés, notifications, classements (copie locale, fausses données)."""
import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
FAUX = open(os.path.join(ICI, "audit_faux.js"), encoding="utf-8").read()
srv = subprocess.Popen([sys.executable, os.path.join(ICI, "srv.py"), "8772", RACINE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
H = '"><img src=x onerror="window.__xss=(window.__xss||0)+1">\'><svg onload="window.__xss=(window.__xss||0)+1"><b id=piege>'
res = []
def etat(page, nom):
    n = page.evaluate("window.__xss || 0")
    d = page.evaluate("document.querySelectorAll('img[src=\"x\"], svg[onload], #piege').length")
    txt = page.evaluate("document.body.innerText.length")
    res.append((nom, n, d, txt)); print("%-34s exécutions=%d éléments_piégés=%d texte=%d" % (nom, n, d, txt), flush=True)
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        ctx = nav.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        ctx.add_init_script("localStorage.setItem('monconcours.candidat', JSON.stringify({dejaVenu:true, nom:'Test Candidat', tel:'70000000', niveau:'terminale'}));")
        ctx.add_init_script("window.__H = %s;" % json.dumps(H))
        page = ctx.new_page()
        erreurs = []
        page.on("pageerror", lambda e: erreurs.append(str(e)[:140]))
        page.route("**/supabase-js.min.js*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAUX))
        page.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
        page.route("**/fonts.gstatic.com/**", lambda r: r.abort())
        page.goto("http://127.0.0.1:8772/index.html")
        page.wait_for_function("typeof S !== 'undefined' && typeof base !== 'undefined' && base !== null", timeout=15000)
        page.wait_for_timeout(1500)
        for e in ["aujourdhui", "revisions", "cahier", "compte", "top", "pourtoi", "recherche", "parcours"]:
            page.evaluate("(e) => aller(e)", e); page.wait_for_timeout(900); etat(page, "écran " + e)
        page.evaluate("S.matiereOuverte = 'Français'"); page.evaluate("aller('lecture')"); page.wait_for_timeout(900); etat(page, "écran lecture (cours)")
        page.evaluate("aller('qcm')"); page.wait_for_timeout(900); etat(page, "écran qcm (question + options)")
        page.evaluate("chargerClassement('e1')"); page.wait_for_timeout(600); page.evaluate("aller('gagnants')"); page.wait_for_timeout(900); etat(page, "écran gagnants (noms du classement)")
        page.evaluate("ouvrirDefi('d1')"); page.wait_for_timeout(900); etat(page, "écran défi (auteur, matière)")
        page.evaluate("aller('grille')"); page.wait_for_timeout(1200); etat(page, "écran composition (sujet)")
        print("erreurs JS :", sorted(set(erreurs))[:4])
        nav.close()
finally:
    srv.terminate()
total = sum(r[1] for r in res)
print("TOTAL exécutions de code piégé :", total)
json.dump(res, open(os.path.join(ICI, "lab2.json"), "w"))
