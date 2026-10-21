import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright
ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
FAUX = open(os.path.join(ICI, "audit_faux.js"), encoding="utf-8").read()
srv = subprocess.Popen([sys.executable, os.path.join(ICI, "srv.py"), "8773", RACINE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
H = '"><img src=x onerror="window.__xss=(window.__xss||0)+1">\'><svg onload="window.__xss=(window.__xss||0)+1"><b id=piege>'
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True); ctx = nav.new_context(viewport={"width":390,"height":844}, service_workers="block")
        ctx.add_init_script("localStorage.setItem('monconcours.candidat', JSON.stringify({dejaVenu:true, nom:'T', tel:'70000000', niveau:'terminale'}));")
        ctx.add_init_script("window.__H = %s;" % json.dumps(H))
        page = ctx.new_page(); page.route("**/supabase-js.min.js*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAUX))
        page.route("**/fonts.*/**", lambda r: r.abort()); page.goto("http://127.0.0.1:8773/index.html")
        page.wait_for_function("typeof S !== 'undefined' && base !== null", timeout=15000); page.wait_for_timeout(1200)
        page.evaluate("chargerClassement('e1')"); page.wait_for_timeout(500); page.evaluate("aller('gagnants')"); page.wait_for_timeout(900)
        print("contrôle positif 1 : le texte piégé s'affiche en clair (échappé) dans le classement :", "<img src=x" in page.evaluate("document.body.innerText"))
        page.evaluate("aller('cahier')"); page.wait_for_timeout(900)
        print("contrôle positif 2 : idem dans le cahier d'erreurs :", "<img src=x" in page.evaluate("document.body.innerText"))
        page.evaluate("document.getElementById('vue').insertAdjacentHTML('beforeend', '<img src=x onerror=\"window.__xss=(window.__xss||0)+1\">')"); page.wait_for_timeout(400)
        print("contrôle témoin : une vraie injection est détectée par ce banc :", page.evaluate("window.__xss || 0") >= 1)
        nav.close()
finally: srv.terminate()
