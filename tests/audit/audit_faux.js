/* Faux Supabase pour l'audit : aucune requête réseau. window.__H = texte hostile éventuel, window.__visiteur = pas de session. */
(function(){
  const J = (o) => JSON.parse(JSON.stringify(o));
  const H = window.__H || null;                       // charge hostile
  const t = (s) => H ? (H + s) : s;                   // texte normal ou hostile
  const maintenant = new Date().toISOString();
  const para = (c, i) => 'Paragraphe ' + (i + 1) + ' du chapitre ' + c + '. ' + 'Texte de cours assez long pour faire défiler la page. '.repeat(5);
  const matieres = ['Français', 'Mathématiques', 'Histoire', 'Géographie', 'Culture générale', 'Droit'];
  const ressources = matieres.flatMap((m, k) => Array.from({ length: 3 }, (_, c) => ({
    id: 'r' + k + c, titre: t('Chapitre ' + (c + 1) + ' de ' + m), type_ressource: 'cours', theme: t('Thème ' + c), niveau: null,
    fichier_chemin: null, nom_fichier: null, taille_octets: null,
    texte: Array.from({ length: 10 }, (_, i) => para(c + 1, i)).join('\n\n'),
    matieres: { nom: m, ordre: k + 1, tous_niveaux: true, niveaux: null }
  })));
  const questions = Array.from({ length: 12 }, (_, i) => ({
    id: 'q' + i, enonce: t('Question ' + (i + 1) + ' : quelle est la capitale du Burkina Faso ?'), niveau: null, matiere_id: 'm1',
    matieres: { nom: matieres[i % 6], ordre: (i % 6) + 1, niveaux: null },
    question_options: ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Banfora'].map((x, p) => ({ position: p, texte: t(x) }))
  }));
  const actus = Array.from({ length: 6 }, (_, i) => ({ titre: t('Information ' + (i + 1)), contenu: t('Contenu de l\'information ' + (i + 1)), categorie: 'national', source: t('Source ' + i), pourquoi: t('Pourquoi ' + i), verifiee: true, publie_le: '2026-10-1' + i }));
  const erreurs = Array.from({ length: 4 }, (_, i) => ({ question_id: 'e' + i, enonce: t('Erreur ' + (i + 1) + ' : énoncé'), options: [t('a'), t('b'), t('c')], bonne: 0, derniere: [1], rate: 1 + i, suite: 0, revoir_le: '2020-01-01', explication: t('x'), matiere: matieres[i] }));
  const notifs = Array.from({ length: 3 }, (_, i) => ({ id: 'n' + i, type: 'defi', titre: t('Titre ' + i), message: t('Message ' + i), lue: false, cree_le: maintenant, lien: 'defi:abc' }));
  const classement = {
    ok: true, termine: true, titre: t('Composition'), concours: t('Concours'), places: 2, debut_le: maintenant, participants: 3, moyenne: 12, admis: 2, attente: 1, echoues: 0, sur: 50,
    classement: [1, 2, 3].map(r => ({ rang: r, nom: t('Candidat ' + r), pseudo: t('Pseudo' + r), score: 40 - r, sur: 50, duree: 1200, composition: 'c' + r, moi: r === 1, statut: r <= 2 ? 'admis' : 'attente', reactions: {}, mes_reactions: [] })),
    moi: { rang: 1, nom: t('Moi'), score: 39, sur: 50, duree: 1200, statut: 'admis' }
  };
  const questionsCompo = Array.from({ length: 5 }, (_, i) => ({ id: 'cq' + i, enonce: t('Question de composition ' + (i + 1)), options: ['A', 'B', 'C', 'D'].map(t), matiere: t('Histoire') }));
  window.__appels = [];
  function reponse(nom, args){
    window.__appels.push(nom);
    switch(nom){
      case 'mes_notifications': return { data: J(notifs), error: null };
      case 'classement_epreuve': return { data: J(classement), error: null };
      case 'mes_erreurs': return { data: J(erreurs), error: null };
      case 'ouvrir_composition': return { data: { ok: true, id: 'c1', sujet: t('S1'), duree: 1500, restant: 1500, concours: t('Concours test'), seuil: 20, questions: J(questionsCompo) }, error: null };
      case 'ouvrir_defi': return { data: { ok: true, invitation: 'invite', id: 'd1', matiere: t('Histoire'), auteur: t('Auteur'), duree: 300, nb: 10 }, error: null };
      case 'top_semaine': return { data: { top: [1, 2, 3].map(r => ({ rang: r, pseudo: t('Top' + r), points: 100 - r, moi: false })), moi: { rang: 12, points: 50 }, participants: 32 }, error: null };
      case 'mon_classement': return { data: { rang: 5, total: 32, points: 120, pseudo: t('Moi') }, error: null };
      case 'envoyer_avis': return { data: { ok: true }, error: null };
      case 'corriger_question': return { data: { ok: true, correcte: true, bonnes: [0], explication: t('parce que'), points: 5 }, error: null };
      default: return { data: null, error: null };
    }
  }
  const constructeur = (nom, args) => ({ abortSignal(){ return this; }, then(ok, ko){ return Promise.resolve(reponse(nom, args)).then(ok, ko); } });
  function requete(table){
    const data = table === 'ressources' ? J(ressources) : table === 'questions' ? J(questions) : table === 'actualites' ? J(actus)
      : table === 'profils' ? { nom: t('Test Candidat'), telephone: '70000000', niveau: 'terminale', pseudo: t('pseudo') } : [];
    const q = { data, error: null };
    const prox = new Proxy({}, { get(_, k){
      if(k === 'then') return (ok, ko) => Promise.resolve(q).then(ok, ko);
      if(k === 'maybeSingle' || k === 'single') return () => Promise.resolve(q);
      return () => prox;
    }});
    return prox;
  }
  const session = window.__visiteur ? null : { user: { id: 'u1' } };
  window.supabase = { createClient(){ return {
    auth: { getSession: () => Promise.resolve({ data: { session } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
            signOut: () => Promise.resolve({}), signInWithPassword: () => Promise.resolve({ data: { session }, error: null }) },
    rpc: (nom, args) => constructeur(nom, args),
    from: (tb) => requete(tb),
    channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
    removeChannel(){}
  }; } };
})();
