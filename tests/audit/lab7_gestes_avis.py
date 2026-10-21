"""Banc 7 : bandeau de notification (7 s, à écarter du doigt), en-tête à 320 px, fenêtre « Donnez votre avis », écran « défi envoyé ».
Copie locale, fausses données, aucune requête réseau."""
import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright

ICI = os.path.dirname(os.path.abspath(__file__)); RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))
FAUX = open(os.path.join(ICI, "audit_faux.js"), encoding="utf-8").read()
srv = subprocess.Popen([sys.executable, os.path.join(ICI, "srv.py"), "8778", RACINE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
BILAN = []
def ok(nom, condition, detail=""):
    BILAN.append((nom, bool(condition)))
    print(("  OK   " if condition else "  ÉCHEC") + " " + nom + ((" — " + str(detail)) if detail != "" else ""), flush=True)

def page_neuve(nav, l, h, visiteur=False):
    ctx = nav.new_context(viewport={"width": l, "height": h}, service_workers="block", locale="fr-FR", has_touch=False)
    if not visiteur:
        ctx.add_init_script("localStorage.setItem('monconcours.candidat', JSON.stringify({dejaVenu:true, nom:'Test Candidat', tel:'70000000', niveau:'terminale'}));")
    ctx.add_init_script("window.__visiteur = %s;" % ("true" if visiteur else "false"))
    page = ctx.new_page()
    erreurs = []
    page.on("pageerror", lambda e: erreurs.append(str(e)[:160]))
    page.route("**/supabase-js.min.js*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAUX))
    page.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
    page.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    page.goto("http://127.0.0.1:8778/index.html")
    page.wait_for_function("typeof S !== 'undefined' && typeof base !== 'undefined' && base !== null", timeout=15000)
    page.wait_for_timeout(1200)
    if not visiteur:
        page.evaluate("S.sessionPrete = true")
    return ctx, page, erreurs

NOTIF = "{id:'n1', type:'defi', titre:'Défi de Awa', message:'Awa vous défie', lue:false, lien:'defi:abc'}"
def montrer_bandeau(page):
    page.evaluate("window.__ouverte = 0; ouvrirNotif = function(){ window.__ouverte++; }; bandeauNotif(%s, 1)" % NOTIF)
    page.wait_for_timeout(500)
def glisser(page, selecteur, dx, dy, pas=8):
    b = page.locator(selecteur).first.bounding_box()
    x, y = b["x"] + b["width"] / 2, b["y"] + min(b["height"] / 2, 30)
    page.mouse.move(x, y); page.mouse.down()
    for i in range(1, pas + 1):
        page.mouse.move(x + dx * i / pas, y + dy * i / pas); page.wait_for_timeout(15)
    page.mouse.up(); page.wait_for_timeout(450)

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)

        print("1. Bandeau de notification")
        ctx, page, err = page_neuve(nav, 390, 844)
        montrer_bandeau(page)
        ok("le bandeau apparaît", page.locator(".bandeau-notif.vu").count() == 1)
        t0 = time.time()
        page.wait_for_timeout(5800)
        ok("toujours là à 6 s", page.locator(".bandeau-notif").count() == 1)
        page.wait_for_function("document.querySelectorAll('.bandeau-notif').length === 0", timeout=4000)
        duree = time.time() - t0 + 0.5
        ok("parti vers 7 s (et non 9 s)", 6.5 <= duree <= 8.3, "%.1f s" % duree)

        montrer_bandeau(page); glisser(page, ".bandeau-notif", -160, 0)
        ok("glissé vers la gauche : il part", page.locator(".bandeau-notif").count() == 0)
        ok("…sans ouvrir la notification", page.evaluate("window.__ouverte") == 0)
        montrer_bandeau(page); glisser(page, ".bandeau-notif", 160, 0)
        ok("glissé vers la droite : il part", page.locator(".bandeau-notif").count() == 0)
        montrer_bandeau(page); glisser(page, ".bandeau-notif", 0, -70)
        ok("glissé vers le haut : il part", page.locator(".bandeau-notif").count() == 0 and page.evaluate("window.__ouverte") == 0)
        montrer_bandeau(page); glisser(page, ".bandeau-notif", 12, 0, pas=3)
        ok("petit glissement : il reste", page.locator(".bandeau-notif").count() == 1 and page.evaluate("window.__ouverte") == 0)
        page.locator(".bandeau-notif").first.click(); page.wait_for_timeout(300)
        ok("un simple toucher ouvre la notification", page.evaluate("window.__ouverte") == 1 and page.locator(".bandeau-notif").count() == 0)
        montrer_bandeau(page); page.locator(".bandeau-notif").first.focus(); page.keyboard.press("Escape"); page.wait_for_timeout(600)
        ok("Échap le ferme (clavier)", page.locator(".bandeau-notif").count() == 0)
        ok("aucune erreur JavaScript", not err, err)
        ctx.close()

        print("2. En-tête")
        for (l, h) in ((320, 568), (360, 740), (390, 844), (1366, 768)):
            for visiteur in (True, False):
                ctx, page, err = page_neuve(nav, l, h, visiteur)
                page.evaluate("aller(%s)" % ("'engagement'" if visiteur else "'aujourdhui'")) if not visiteur else page.evaluate("S.ecran='connexion'; rendre();")
                page.wait_for_timeout(700)
                m = page.evaluate("""() => { const t = document.getElementById('apptete'); const L = window.innerWidth;
                   const bs = Array.from(t.querySelectorAll('button')).map(b => b.getBoundingClientRect());
                   return { doc: document.documentElement.scrollWidth, L, teteDeborde: t.scrollWidth > t.clientWidth + 1,
                            plusADroite: Math.max(...bs.map(r => r.right)), n: bs.length, deconnecter: t.querySelectorAll('[data-deconnecter]').length }; }""")
                nom = "%dpx %s" % (l, "visiteur" if visiteur else "connecté")
                ok("%s : l'en-tête tient (%d boutons, bord droit %d / %d)" % (nom, m["n"], m["plusADroite"], m["L"]),
                   m["doc"] <= m["L"] + 1 and not m["teteDeborde"] and m["plusADroite"] <= m["L"] + 0.5)
                if not visiteur:
                    ok("%s : plus de « Se déconnecter » en haut" % nom, m["deconnecter"] == 0)
                ctx.close()
        ctx, page, err = page_neuve(nav, 390, 844)
        page.evaluate("aller('compte')"); page.wait_for_timeout(600)
        ok("« Se déconnecter » reste dans Mon compte", page.locator("#vue [data-deconnecter]").count() == 1)
        ctx.close()

        print("3. Fenêtre « Donnez votre avis »")
        PREP = "ecrireReglage('avis', {pour:'000', s:%d, vu:%d, envoye:false}); O.dernierTemps = Date.now(); suiviAvis();"
        ctx, page, err = page_neuve(nav, 390, 844)
        page.evaluate(PREP % (600, 0)); page.wait_for_timeout(500)
        ok("à 10 minutes d'usage : rien", page.locator(".avis-carte").count() == 0)
        page.evaluate(PREP % (1790, 0)); page.wait_for_timeout(600)
        ok("à 30 minutes d'usage : la fenêtre apparaît", page.locator(".avis-carte.vu").count() == 1)
        ok("elle ne couvre pas la barre du bas", page.evaluate("document.querySelector('.avis-carte').getBoundingClientRect().bottom <= document.getElementById('nav').getBoundingClientRect().top + 1"))
        glisser(page, ".avis-tete", 0, 90)
        ok("glissée vers le bas : elle part", page.locator(".avis-carte").count() == 0)
        page.evaluate("suiviAvis()"); page.wait_for_timeout(300)
        ok("fermée sans envoyer : elle ne revient pas", page.locator(".avis-carte").count() == 0)
        page.evaluate(PREP % (1790, 0)); page.wait_for_timeout(600)
        glisser(page, ".avis-tete", -170, 0)
        ok("glissée vers la gauche : elle part", page.locator(".avis-carte").count() == 0)
        page.evaluate(PREP % (1790, 0)); page.wait_for_timeout(600)
        page.locator("#avis-texte").click(); page.keyboard.type("Les explications sont très utiles."); page.wait_for_timeout(200)
        ok("saisie : le texte reste (la saisie n'est pas prise pour un glissement)", page.locator("#avis-texte").input_value() == "Les explications sont très utiles.")
        page.locator("[data-avis-envoi]").click(); page.wait_for_timeout(600)
        ok("envoi : appel de envoyer_avis", "envoyer_avis" in page.evaluate("window.__appels"))
        ok("envoi : la fenêtre se ferme", page.locator(".avis-carte").count() == 0)
        ok("envoi : jamais redemandé", page.evaluate("lireReglages().avis.envoye") is True)
        page.evaluate("ecrireReglage('avis', {pour:'000', s:4000, vu:0, envoye:true}); O.dernierTemps = Date.now(); suiviAvis();"); page.wait_for_timeout(300)
        ok("après envoi, rien même avec beaucoup d'usage", page.locator(".avis-carte").count() == 0)
        ok("aucune erreur JavaScript", not err, err)
        ctx.close()

        ctx, page, err = page_neuve(nav, 390, 844)
        page.evaluate("ecrireReglage('avis', {pour:'000', s:1790, vu:0, envoye:false}); O.dernierTemps = Date.now(); S.ecran='testIntro'; suiviAvis();"); page.wait_for_timeout(300)
        ok("pas de fenêtre pendant un test", page.locator(".avis-carte").count() == 0)
        page.evaluate("ecrireReglage('avis', {pour:'000', s:1790, vu:Date.now() - 5*86400000, envoye:false}); O.dernierTemps = Date.now(); S.ecran='aujourdhui'; suiviAvis();"); page.wait_for_timeout(300)
        ok("fermée il y a 5 jours : pas de nouvelle demande", page.locator(".avis-carte").count() == 0)
        page.evaluate("ecrireReglage('avis', {pour:'000', s:1790, vu:Date.now() - 25*86400000, envoye:false}); O.dernierTemps = Date.now(); suiviAvis();"); page.wait_for_timeout(500)
        ok("fermée il y a 25 jours : on redemande", page.locator(".avis-carte").count() == 1)
        page.evaluate("ecrireReglage('avis', {pour:'000', s:100, vu:0, envoye:false}); O.dernierTemps = Date.now() - 120000; suiviAvis();")
        ok("téléphone posé (aucune action depuis 2 minutes) : le temps ne compte pas", page.evaluate("lireReglages().avis.s") == 100)
        ctx.close()

        print("4. Écran « défi envoyé »")
        ctx, page, err = page_neuve(nav, 390, 844)
        page.evaluate("S.defi = {etat:'envoye', id:'d1', invites:2, matieres:[]}; S.ecran='defi'; rendre();"); page.wait_for_timeout(500)
        texte = page.evaluate("document.getElementById('vue').innerText")
        ok("titre neutre « Invitations transmises »", "Invitations transmises" in texte)
        ok("plus de liste de numéros « pas encore inscrits »", "pas encore inscrit" not in texte)
        ok("le bouton WhatsApp reste proposé", page.locator("[data-partage-defi]").count() == 1)
        ok("aucune erreur JavaScript", not err, err)
        ctx.close()
        nav.close()
finally:
    srv.terminate()
echecs = [n for n, v in BILAN if not v]
print("\n%d vérifications, %d échec(s)" % (len(BILAN), len(echecs)))
for n in echecs: print("  À revoir :", n)
sys.exit(1 if echecs else 0)
