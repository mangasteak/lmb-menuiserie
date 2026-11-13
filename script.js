/* ==========================================================================
   LMB — Laurent Menuiserie Bois · Interactions du site
   ==========================================================================
   JavaScript « vanilla » (ES6+), sans bibliothèque ni étape de build.

   SOMMAIRE
     1. Outils communs
     2. En-tête : condensation au défilement
     3. Menu mobile
     4. Révélations au défilement (IntersectionObserver)
     5. Galerie : filtres par catégorie
     6. Modale et frise chronologique
     7. Formulaire de contact : validation et ouverture de la messagerie
     8. Pied de page : année en cours
     9. Démarrage

   Tout le code est enfermé dans une fonction exécutée immédiatement : aucune
   variable ne « fuit » dans l'espace global de la page.
   Le fichier est chargé avec l'attribut « defer » : quand il s'exécute, la
   page est déjà entièrement analysée, tous les éléments existent.
   ========================================================================== */
(() => {
  'use strict';

  /* ========================================================================
     1. OUTILS COMMUNS
     ======================================================================== */

  /** Raccourci : premier élément correspondant au sélecteur CSS. */
  const un = (selecteur, contexte = document) => contexte.querySelector(selecteur);

  /** Raccourci : tous les éléments correspondants, sous forme de tableau. */
  const tous = (selecteur, contexte = document) =>
    Array.from(contexte.querySelectorAll(selecteur));

  /* Préférence « réduire les animations » du système du visiteur. On garde
     l'objet de requête plutôt qu'un simple booléen : la préférence peut
     changer pendant la visite, on relit donc sa valeur à chaque usage. */
  const requeteMouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mouvementReduit = () => requeteMouvementReduit.matches;

  /**
   * Durée d'une temporisation, ramenée à zéro si le visiteur a demandé à
   * réduire les animations. Les temporisations du script suivent ainsi la
   * même règle que les animations de la feuille de style.
   */
  const duree = (millisecondes) => (mouvementReduit() ? 0 : millisecondes);


  /* ========================================================================
     2. EN-TÊTE : CONDENSATION AU DÉFILEMENT
     ------------------------------------------------------------------------
     Dès que la page a défilé de quelques pixels, l'en-tête reçoit la classe
     « est-condensee » ; style.css se charge de l'effet visuel.
     ======================================================================== */
  function initialiserEntete() {
    const entete = un('#entete');
    if (!entete) return;

    const SEUIL = 24;            // défilement (en pixels) à partir duquel l'en-tête se condense
    let miseAJourPrevue = false; // évite de programmer plusieurs mises à jour pour une même image

    const mettreAJour = () => {
      entete.classList.toggle('est-condensee', window.scrollY > SEUIL);
      miseAJourPrevue = false;
    };

    /* L'événement « scroll » se déclenche très souvent. On ne fait le travail
       qu'une fois par image affichée (requestAnimationFrame), et l'option
       « passive » signale au navigateur que l'écouteur ne bloquera jamais le
       défilement. */
    window.addEventListener('scroll', () => {
      if (miseAJourPrevue) return;
      miseAJourPrevue = true;
      window.requestAnimationFrame(mettreAJour);
    }, { passive: true });

    mettreAJour(); // état correct dès l'arrivée, même si la page est rechargée en cours de lecture
  }


  /* ========================================================================
     3. MENU MOBILE
     ------------------------------------------------------------------------
     Sur petit écran, les liens sont rangés dans un panneau. Le bouton
     l'ouvre et le ferme ; « aria-expanded » tient les lecteurs d'écran
     informés de son état. Le panneau se ferme aussi quand on choisit un
     lien, avec la touche Échap, en cliquant ailleurs ou si l'écran s'élargit.
     ======================================================================== */
  function initialiserMenuMobile() {
    const entete = un('#entete');
    const bouton = un('#menu-bouton');
    const libelle = un('#menu-bouton-libelle');
    const navigation = un('#navigation');
    if (!entete || !bouton || !navigation) return;

    const estOuvert = () => entete.classList.contains('menu-ouvert');

    const basculer = (ouvrir) => {
      entete.classList.toggle('menu-ouvert', ouvrir);
      bouton.setAttribute('aria-expanded', String(ouvrir));
      if (libelle) libelle.textContent = ouvrir ? 'Fermer le menu' : 'Ouvrir le menu';
    };

    bouton.addEventListener('click', () => basculer(!estOuvert()));

    // Un lien choisi : on referme, la page défile vers la section.
    navigation.addEventListener('click', (evenement) => {
      if (evenement.target.closest('a')) basculer(false);
    });

    // Échap : on referme et on rend le focus au bouton.
    document.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Escape' && estOuvert()) {
        basculer(false);
        bouton.focus();
      }
    });

    // Clic en dehors de l'en-tête : on referme.
    document.addEventListener('click', (evenement) => {
      if (estOuvert() && !entete.contains(evenement.target)) basculer(false);
    });

    // Passage à un écran large (rotation de la tablette, par exemple) : le
    // panneau n'existe plus, on remet l'état à zéro.
    window.matchMedia('(min-width: 48rem)').addEventListener('change', (evenement) => {
      if (evenement.matches) basculer(false);
    });
  }


  /* ========================================================================
     4. RÉVÉLATIONS AU DÉFILEMENT
     ------------------------------------------------------------------------
     IntersectionObserver prévient quand un élément entre dans l'écran, sans
     qu'on ait à surveiller le défilement soi-même. Chaque élément « revele »
     reçoit alors la classe « est-visible », puis n'est plus observé :
     l'animation ne joue qu'une fois.
     ======================================================================== */
  function initialiserRevelations() {
    const elements = tous('.revele');
    if (!elements.length) return;

    // Navigateur trop ancien : on affiche tout, sans animation.
    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('est-visible'));
      return;
    }

    const observateur = new IntersectionObserver((entrees) => {
      entrees.forEach((entree) => {
        if (!entree.isIntersecting) return;
        entree.target.classList.add('est-visible');
        observateur.unobserve(entree.target);
      });
    }, {
      threshold: 0.12,                    // 12 % de l'élément doit être visible
      rootMargin: '0px 0px -6% 0px',      // déclenche un peu avant le bas de l'écran
    });

    elements.forEach((element) => observateur.observe(element));
  }


  /* ========================================================================
     5. GALERIE : FILTRES PAR CATÉGORIE
     ------------------------------------------------------------------------
     Chaque bouton porte un attribut data-filtre, chaque carte un attribut
     data-categorie. Un clic :
       1. marque le bouton comme actif (aria-pressed) ;
       2. fait disparaître les cartes en fondu ;
       3. masque celles qui ne correspondent pas (attribut hidden) ;
       4. fait réapparaître les autres, l'une après l'autre ;
       5. annonce le résultat aux lecteurs d'écran.
     ======================================================================== */
  function initialiserFiltres() {
    const galerie = un('#galerie');
    const boutons = tous('.filtre');
    const annonce = un('#galerie-annonce');
    if (!galerie || !boutons.length) return;

    const elements = tous('.galerie__item', galerie);
    const DUREE_SORTIE = 220; // doit correspondre au fondu de sortie défini dans style.css
    let minuterie = null;

    const appliquer = (filtre, libelle) => {
      boutons.forEach((bouton) => {
        bouton.setAttribute('aria-pressed', String(bouton.dataset.filtre === filtre));
      });

      // Si un filtrage précédent est encore en cours, on l'annule.
      window.clearTimeout(minuterie);

      // Étape 1 : sortie en fondu de toutes les cartes.
      galerie.classList.add('est-en-transition');

      // Étape 2 : une fois les cartes effacées, on trie puis on fait entrer.
      minuterie = window.setTimeout(() => {
        let rang = 0;

        elements.forEach((element) => {
          const carte = un('.carte', element);
          const visible = filtre === 'tout' || element.dataset.categorie === filtre;

          element.hidden = !visible;
          carte.classList.remove('est-en-entree');

          if (visible) {
            // --ordre décale l'animation d'entrée de chaque carte (voir style.css).
            carte.style.setProperty('--ordre', rang);
            rang += 1;
          }
        });

        galerie.classList.remove('est-en-transition');

        // Lire une dimension force le navigateur à prendre en compte le
        // retrait de la classe avant qu'on la remette : c'est ce qui permet
        // de rejouer l'animation d'entrée à chaque filtrage.
        void galerie.offsetWidth;

        elements.forEach((element) => {
          if (!element.hidden) un('.carte', element).classList.add('est-en-entree');
        });

        if (annonce) {
          const pluriel = rang > 1 ? 's' : '';
          annonce.textContent = filtre === 'tout'
            ? `${rang} réalisation${pluriel} affichée${pluriel}, toutes catégories.`
            : `${rang} réalisation${pluriel} affichée${pluriel} dans la catégorie ${libelle}.`;
        }
      }, duree(DUREE_SORTIE));
    };

    boutons.forEach((bouton) => {
      bouton.addEventListener('click', () => {
        // Clic sur le filtre déjà actif : rien à faire.
        if (bouton.getAttribute('aria-pressed') === 'true') return;
        appliquer(bouton.dataset.filtre, bouton.textContent.trim());
      });
    });
  }


  /* ========================================================================
     6. MODALE ET FRISE CHRONOLOGIQUE
     ------------------------------------------------------------------------
     Un clic sur une carte ouvre la modale du projet. Ses étapes sont lues
     dans le bloc JSON « projets-data » de index.html, puis la frise est
     construite à la volée.

     Navigation dans la frise :
       - clic sur une étape ;
       - boutons Précédent et Suivant ;
       - clavier : flèches (droite et bas pour avancer, gauche et haut pour
         reculer), Début et Fin pour la première et la dernière étape.

     Fermeture : bouton, clic en dehors de la boîte, touche Échap.

     Accessibilité : à l'ouverture, le reste de la page est rendu inerte et
     le focus est piégé dans la modale ; à la fermeture, il revient sur la
     carte d'où l'on est parti.
     ======================================================================== */
  function initialiserModale() {
    const modale = un('#modale');
    if (!modale) return;

    // --- Éléments de la modale ---------------------------------------------
    const boite = un('#modale-boite', modale);
    const boutonFermer = un('#modale-fermer', modale);
    const visuel = un('#modale-visuel', modale);
    const photos = tous('.modale__photo', modale);   // les deux images superposées
    const photoAbsente = un('#modale-photo-absente', modale);
    const legende = un('#modale-legende', modale);
    const corps = un('#modale-corps', modale);
    const categorie = un('#modale-categorie', modale);
    const titre = un('#modale-titre', modale);
    const resume = un('#modale-resume', modale);
    const frise = un('#frise', modale);
    const liste = un('#frise-liste', modale);
    const boutonPrecedent = un('#frise-precedent', modale);
    const boutonSuivant = un('#frise-suivant', modale);
    const compteur = un('#modale-compteur', modale);

    // Tout ce qui se trouve derrière la modale (en-tête, contenu, pied).
    const arrierePlan = tous('body > header, body > main, body > footer');

    const DUREE_FERMETURE = 500; // doit couvrir la transition de fermeture de style.css

    // --- État courant ------------------------------------------------------
    let projet = null;            // projet affiché
    let indexActif = -1;          // rang de l'étape active (0 = première)
    let boutonsEtapes = [];       // boutons de la frise, dans l'ordre
    let declencheur = null;       // bouton de la carte qui a ouvert la modale
    let estOuverte = false;
    let minuterieFermeture = null;
    let coucheActive = 0;         // laquelle des deux images est visible (0 ou 1)
    let jetonPhoto = 0;           // numéro de la dernière demande de photo (voir changerPhoto)
    let pointeurParti = false;    // le dernier appui a-t-il commencé hors de la boîte ?

    /* --- Lecture des données ------------------------------------------------
       Le bloc <script type="application/json"> n'est pas exécuté par le
       navigateur : on lit son texte et on le convertit en objets. En cas de
       faute de syntaxe dans le JSON, on le signale dans la console et le
       site continue de fonctionner (les cartes restent visibles, seule la
       modale ne s'ouvre pas). */
    const lireProjets = () => {
      const bloc = un('#projets-data');
      if (!bloc) return [];
      try {
        const donnees = JSON.parse(bloc.textContent);
        return Array.isArray(donnees) ? donnees : [];
      } catch (erreur) {
        console.error('LMB : le bloc « projets-data » de index.html contient une erreur de syntaxe JSON.', erreur);
        return [];
      }
    };

    const projets = lireProjets();
    if (!projets.length) return;

    /* --- Construction de la frise --------------------------------------------
       Une entrée de liste par étape. Chaque étape est un <button> qui
       contient le nœud numéroté et les textes. On crée les éléments un à un
       et on y place le texte avec « textContent » : même si un texte du JSON
       contenait du HTML, il serait affiché tel quel et jamais interprété. */
    const creer = (balise, classe, texte) => {
      const element = document.createElement(balise);
      if (classe) element.className = classe;
      if (texte !== undefined) element.textContent = texte;
      return element;
    };

    const construireFrise = (etapes) => {
      liste.textContent = ''; // vide la frise du projet précédent

      boutonsEtapes = etapes.map((etape, rang) => {
        const entree = creer('li', 'frise__item');
        // --i sert à style.css pour décaler l'apparition de chaque nœud.
        entree.style.setProperty('--i', rang);

        const bouton = creer('button', 'frise__etape');
        bouton.type = 'button';
        bouton.dataset.index = String(rang);

        const noeud = creer('span', 'frise__noeud');
        noeud.setAttribute('aria-hidden', 'true');
        noeud.append(creer('span', 'frise__chiffre', String(rang + 1)));

        const texte = creer('span', 'frise__texte');
        texte.append(
          creer('span', 'frise__numero', `Étape ${rang + 1}`),
          creer('span', 'frise__titre', etape.titre),
          creer('span', 'frise__description', etape.description),
        );

        bouton.append(noeud, texte);
        entree.append(bouton);
        liste.append(entree);
        return bouton;
      });
    };

    /* --- Fil laiton -------------------------------------------------------------
       Le fil doit relier le centre du premier nœud au centre du dernier, et
       sa partie pleine s'arrêter au centre du nœud actif. Les étapes n'ayant
       pas toutes la même hauteur (textes plus ou moins longs), on mesure la
       position réelle de chaque nœud.

       On additionne les « offsetTop » en remontant jusqu'à la frise. Cette
       mesure a l'avantage d'ignorer les transformations CSS : elle reste
       juste même pendant les animations d'ouverture. */
    const centreDuNoeud = (bouton) => {
      const noeud = un('.frise__noeud', bouton);
      let position = noeud.offsetHeight / 2;
      let element = noeud;
      while (element && element !== frise) {
        position += element.offsetTop;
        element = element.offsetParent;
      }
      return position;
    };

    const mettreAJourFil = () => {
      if (!boutonsEtapes.length || indexActif < 0) return;

      const debut = centreDuNoeud(boutonsEtapes[0]);
      const fin = centreDuNoeud(boutonsEtapes[boutonsEtapes.length - 1]);
      const actif = centreDuNoeud(boutonsEtapes[indexActif]);
      const longueur = fin - debut;

      frise.style.setProperty('--fil-haut', `${debut}px`);
      frise.style.setProperty('--fil-hauteur', `${longueur}px`);
      // Proportion du fil à remplir : 0 à la première étape, 1 à la dernière.
      frise.style.setProperty('--progression', longueur > 0 ? String((actif - debut) / longueur) : '0');
    };

    // Si la largeur change (rotation, redimensionnement), les textes se
    // réorganisent : on mesure à nouveau.
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => { if (estOuverte) mettreAJourFil(); }).observe(frise);
    } else {
      window.addEventListener('resize', () => { if (estOuverte) mettreAJourFil(); });
    }

    /* --- Photo de l'étape : fondu enchaîné ------------------------------------
       Deux <img> sont superposées. La nouvelle photo est d'abord chargée en
       mémoire ; quand elle est prête, on la place dans l'image cachée, puis
       on échange les rôles : la cachée devient visible, l'autre s'efface.

       Le « jeton » protège des navigations rapides : si le visiteur passe
       trois étapes d'un coup, seule la dernière photo demandée s'affiche,
       même si une précédente finit de charger après elle. */
    const changerPhoto = (etape) => {
      jetonPhoto += 1;
      const monJeton = jetonPhoto;
      const chargeur = new Image();

      const montrer = (photoDisponible) => {
        if (monJeton !== jetonPhoto) return; // une demande plus récente a pris le relais

        const suivante = photos[1 - coucheActive];
        const precedente = photos[coucheActive];

        photoAbsente.hidden = photoDisponible;

        if (photoDisponible) {
          suivante.src = etape.image;
          suivante.alt = etape.alt || etape.titre;
          suivante.removeAttribute('aria-hidden');
          suivante.classList.add('est-active');
        }

        // L'image qui s'efface ne doit plus être lue par les lecteurs d'écran.
        precedente.classList.remove('est-active');
        precedente.setAttribute('aria-hidden', 'true');

        if (photoDisponible) coucheActive = 1 - coucheActive;
      };

      chargeur.onload = () => montrer(true);
      chargeur.onerror = () => montrer(false); // hors connexion ou adresse erronée : message de remplacement
      chargeur.src = etape.image;
    };

    /* --- Affichage d'une étape ---------------------------------------------------
       C'est le point de passage unique : clic, boutons et clavier appellent
       tous cette fonction. */
    const afficherEtape = (index, options = {}) => {
      const { deplacerFocus = false, defiler = true } = options;
      const dernier = projet.etapes.length - 1;
      const nouvelIndex = Math.max(0, Math.min(index, dernier)); // reste entre la première et la dernière

      if (nouvelIndex === indexActif) return;
      indexActif = nouvelIndex;
      const etape = projet.etapes[indexActif];

      boutonsEtapes.forEach((bouton, rang) => {
        // aria-current="step" désigne l'étape active aux lecteurs d'écran ;
        // style.css s'appuie sur ce même attribut pour la mettre en valeur.
        if (rang === indexActif) bouton.setAttribute('aria-current', 'step');
        else bouton.removeAttribute('aria-current');
        bouton.classList.toggle('est-passee', rang < indexActif);
      });

      mettreAJourFil();
      changerPhoto(etape);

      legende.textContent = `Étape ${indexActif + 1} sur ${dernier + 1} · ${etape.titre}`;
      compteur.textContent = `${indexActif + 1} / ${dernier + 1}`;

      boutonPrecedent.setAttribute('aria-disabled', String(indexActif === 0));
      boutonSuivant.setAttribute('aria-disabled', String(indexActif === dernier));

      const boutonActif = boutonsEtapes[indexActif];
      if (deplacerFocus) boutonActif.focus({ preventScroll: true });
      if (defiler) amenerDansLaVue(boutonActif);
    };

    /* Fait défiler la zone de texte pour que l'étape active soit entièrement
       visible. On ne déplace que cette zone (pas la page), et seulement si
       l'étape dépasse en haut ou en bas. */
    const amenerDansLaVue = (element) => {
      const MARGE = 16;
      const cadre = corps.getBoundingClientRect();
      const boiteElement = element.getBoundingClientRect();
      let decalage = 0;

      if (boiteElement.top < cadre.top + MARGE) {
        decalage = boiteElement.top - cadre.top - MARGE;
      } else if (boiteElement.bottom > cadre.bottom - MARGE) {
        decalage = boiteElement.bottom - cadre.bottom + MARGE;
      }

      if (decalage !== 0) {
        corps.scrollBy({ top: decalage, behavior: mouvementReduit() ? 'auto' : 'smooth' });
      }
    };

    /* --- Page figée et inerte ----------------------------------------------------
       Pendant que la modale est ouverte :
         - la page ne défile plus (classe sur <body>) ; on compense la largeur
           de la barre de défilement qui disparaît pour éviter un sursaut ;
         - l'attribut « inert » retire le reste de la page du parcours au
           clavier et des lecteurs d'écran. */
    const figerLaPage = (figer) => {
      if (figer) {
        const largeurAscenseur = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.setProperty('--compensation-ascenseur', `${largeurAscenseur}px`);
      } else {
        document.documentElement.style.removeProperty('--compensation-ascenseur');
      }
      document.body.classList.toggle('modale-ouverte', figer);
      arrierePlan.forEach((element) => { element.inert = figer; });
    };

    // --- Ouverture -----------------------------------------------------------
    const ouvrir = (identifiant, boutonOrigine) => {
      const trouve = projets.find((candidat) => candidat.id === identifiant);
      if (!trouve || !Array.isArray(trouve.etapes) || !trouve.etapes.length) return;

      // Si une fermeture était en train de se terminer, on l'interrompt.
      window.clearTimeout(minuterieFermeture);

      projet = trouve;
      declencheur = boutonOrigine || null;
      indexActif = -1;

      categorie.textContent = projet.categorie || '';
      titre.textContent = projet.titre || '';
      resume.textContent = projet.resume || '';
      construireFrise(projet.etapes);

      // On repart d'un visuel vide, pour ne pas revoir la photo du projet précédent.
      photos.forEach((photo) => {
        photo.classList.remove('est-active');
        photo.removeAttribute('src');
        photo.alt = '';
      });
      photoAbsente.hidden = true;

      // Les photos des étapes suivantes sont chargées en avance : la
      // navigation dans la frise sera immédiate.
      projet.etapes.forEach((etape) => { new Image().src = etape.image; });

      modale.hidden = false;
      figerLaPage(true);
      corps.scrollTop = 0;

      // On force le navigateur à calculer l'état « fermé » avant d'ajouter la
      // classe : sans cela, il n'y aurait pas de transition d'ouverture.
      void modale.offsetWidth;
      modale.classList.add('est-ouverte');
      estOuverte = true;

      afficherEtape(0, { defiler: false });

      // Le focus entre dans la modale, sur le bouton de fermeture.
      boutonFermer.focus({ preventScroll: true });
    };

    // --- Fermeture -----------------------------------------------------------
    const fermer = () => {
      if (!estOuverte) return;
      estOuverte = false;

      modale.classList.remove('est-ouverte'); // lance les transitions de fermeture
      figerLaPage(false);

      // Le focus revient sur la carte d'origine : au clavier, on reprend la
      // visite exactement là où on l'avait laissée.
      if (declencheur && document.contains(declencheur)) {
        declencheur.focus({ preventScroll: true });
      }

      // On attend la fin de l'animation avant de masquer vraiment la modale.
      minuterieFermeture = window.setTimeout(() => {
        modale.hidden = true;
        liste.textContent = '';
        boutonsEtapes = [];
      }, duree(DUREE_FERMETURE));
    };

    /* --- Focus piégé -------------------------------------------------------------
       La touche Tab doit tourner en boucle dans la modale : après le dernier
       élément on revient au premier, et inversement avec Maj + Tab. */
    const elementsFocalisables = () =>
      tous('button, a[href], [tabindex]:not([tabindex="-1"])', boite)
        .filter((element) => !element.disabled && element.offsetParent !== null);

    const piegerLeFocus = (evenement) => {
      const elements = elementsFocalisables();
      if (!elements.length) return;

      const premier = elements[0];
      const dernier = elements[elements.length - 1];
      const actif = document.activeElement;

      if (!boite.contains(actif)) {
        // Le focus s'est échappé (cas rare) : on le ramène dans la modale.
        evenement.preventDefault();
        premier.focus();
      } else if (evenement.shiftKey && actif === premier) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && actif === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    };

    // --- Écouteurs : cartes de la galerie ----------------------------------------
    tous('.carte__bouton').forEach((bouton) => {
      bouton.addEventListener('click', () => ouvrir(bouton.dataset.projet, bouton));
    });

    // --- Écouteurs : fermeture ---------------------------------------------------
    boutonFermer.addEventListener('click', fermer);

    /* Clic à l'extérieur : on ne ferme que si l'appui a commencé ET fini hors
       de la boîte. Sans cette précaution, sélectionner un texte en relâchant
       la souris un peu trop loin fermerait la fenêtre. */
    modale.addEventListener('pointerdown', (evenement) => {
      pointeurParti = !boite.contains(evenement.target);
    });

    modale.addEventListener('click', (evenement) => {
      if (pointeurParti && !boite.contains(evenement.target)) fermer();
      pointeurParti = false;
    });

    // --- Écouteurs : navigation dans la frise ------------------------------------
    // Un seul écouteur sur la liste suffit pour toutes les étapes (délégation).
    liste.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('.frise__etape');
      if (bouton) afficherEtape(Number(bouton.dataset.index));
    });

    boutonPrecedent.addEventListener('click', () => {
      if (estOuverte) afficherEtape(indexActif - 1);
    });

    boutonSuivant.addEventListener('click', () => {
      if (estOuverte) afficherEtape(indexActif + 1);
    });

    // --- Écouteurs : clavier -----------------------------------------------------
    document.addEventListener('keydown', (evenement) => {
      if (!estOuverte) return;

      // On laisse passer les raccourcis du navigateur (Alt + flèche, Ctrl + …).
      if (evenement.altKey || evenement.ctrlKey || evenement.metaKey) return;

      // Si le focus est sur une étape de la frise, il suit l'étape active.
      const focusDansLaFrise = liste.contains(document.activeElement);
      const dernier = projet.etapes.length - 1;

      switch (evenement.key) {
        case 'Escape':
          evenement.preventDefault();
          fermer();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          evenement.preventDefault(); // empêche la flèche de faire défiler le texte
          afficherEtape(indexActif + 1, { deplacerFocus: focusDansLaFrise });
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          evenement.preventDefault();
          afficherEtape(indexActif - 1, { deplacerFocus: focusDansLaFrise });
          break;
        case 'Home':
          evenement.preventDefault();
          afficherEtape(0, { deplacerFocus: focusDansLaFrise });
          break;
        case 'End':
          evenement.preventDefault();
          afficherEtape(dernier, { deplacerFocus: focusDansLaFrise });
          break;
        case 'Tab':
          piegerLeFocus(evenement);
          break;
        default:
          break;
      }
    });
  }


  /* ========================================================================
     7. FORMULAIRE DE CONTACT
     ------------------------------------------------------------------------
     Validation côté client, avec un message en français sous chaque champ.

     Le site n'a pas de serveur : il ne peut pas envoyer d'e-mail lui-même.
     Quand tous les champs sont valides, on compose un lien « mailto: » qui
     ouvre la messagerie du visiteur avec le message déjà rédigé, puis on
     affiche une confirmation. L'adresse de destination est lue dans le lien
     e-mail des coordonnées (id="lien-email" dans index.html) : il n'y a donc
     qu'un seul endroit où la modifier.
     ======================================================================== */
  function initialiserFormulaire() {
    const formulaire = un('#formulaire-contact');
    if (!formulaire) return;

    const alerte = un('#formulaire-alerte', formulaire);
    const confirmation = un('#formulaire-confirmation', formulaire);
    const lienMessagerie = un('#lien-messagerie', formulaire);
    const lienEmail = un('#lien-email');

    /* On désactive les bulles de validation du navigateur (en anglais ou
       dans la langue du système, et peu lisibles) au profit de nos propres
       messages. Les attributs « required » du HTML restent utiles si
       JavaScript est coupé. */
    formulaire.noValidate = true;

    // Un e-mail plausible : du texte, une arobase, un domaine avec un point.
    const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    // Un numéro français, une fois retirés espaces, points et tirets :
    // 0X XX XX XX XX, ou la forme internationale +33 X XX XX XX XX.
    const MOTIF_TELEPHONE = /^(?:\+33|0033|0)[1-9]\d{8}$/;
    const LONGUEUR_MESSAGE_MIN = 20;

    /* Règles de validation : pour chaque champ (repéré par son attribut
       « name »), une fonction reçoit la valeur saisie et renvoie le message
       d'erreur à afficher, ou une chaîne vide si tout va bien. */
    const regles = {
      nom: (valeur) => {
        if (!valeur) return 'Indiquez votre nom.';
        if (valeur.length < 2) return 'Votre nom doit comporter au moins 2 caractères.';
        return '';
      },
      email: (valeur) => {
        if (!valeur) return 'Indiquez votre adresse e-mail.';
        if (!MOTIF_EMAIL.test(valeur)) return 'Cette adresse e-mail ne semble pas valide. Vérifiez qu\'elle a la forme nom@domaine.fr.';
        return '';
      },
      telephone: (valeur) => {
        if (!valeur) return ''; // champ facultatif
        const chiffres = valeur.replace(/[\s.\-()]/g, '');
        if (!MOTIF_TELEPHONE.test(chiffres)) return 'Ce numéro ne semble pas valide. Saisissez 10 chiffres, sous la forme 0X XX XX XX XX.';
        return '';
      },
      type: (valeur) => (valeur ? '' : 'Choisissez un type de projet.'),
      message: (valeur) => {
        if (!valeur) return 'Décrivez votre projet en quelques mots.';
        if (valeur.length < LONGUEUR_MESSAGE_MIN) return `Donnez un peu plus de détails sur votre projet (${LONGUEUR_MESSAGE_MIN} caractères au minimum).`;
        return '';
      },
    };

    const champs = Object.keys(regles).map((nom) => formulaire.elements[nom]).filter(Boolean);
    const dejaVerifies = new Set(); // champs ayant déjà affiché leur état au moins une fois

    const valeurDe = (champ) => champ.value.trim();

    /**
     * Valide un champ et met à jour son affichage.
     * Renvoie true si le champ est valide.
     */
    const validerChamp = (champ) => {
      const message = regles[champ.name](valeurDe(champ));
      const conteneur = champ.closest('.champ');
      const zoneErreur = un('.champ__erreur', conteneur);

      conteneur.classList.toggle('est-invalide', Boolean(message));
      zoneErreur.textContent = message;

      // aria-invalid signale l'erreur aux lecteurs d'écran ; le message lui
      // est relié par l'attribut aria-describedby présent dans le HTML.
      if (message) champ.setAttribute('aria-invalid', 'true');
      else champ.removeAttribute('aria-invalid');

      dejaVerifies.add(champ.name);
      return !message;
    };

    champs.forEach((champ) => {
      // À la sortie d'un champ : on le vérifie (sauf s'il est resté vide et
      // n'a encore jamais été vérifié, pour ne pas gronder trop tôt).
      champ.addEventListener('blur', () => {
        if (valeurDe(champ) || dejaVerifies.has(champ.name)) validerChamp(champ);
      });

      // Pendant la saisie : dès qu'un champ a été signalé en erreur, on le
      // revérifie à chaque frappe pour que le message disparaisse aussitôt
      // l'erreur corrigée.
      const reverifier = () => {
        if (dejaVerifies.has(champ.name)) validerChamp(champ);
      };
      champ.addEventListener('input', reverifier);
      champ.addEventListener('change', reverifier);
    });

    /**
     * Compose le lien mailto: à partir des champs.
     * encodeURIComponent protège les caractères spéciaux (accents, espaces,
     * retours à la ligne) pour qu'ils arrivent intacts dans la messagerie.
     */
    const composerLienMessagerie = () => {
      const adresse = lienEmail
        ? lienEmail.getAttribute('href').replace(/^mailto:/i, '').split('?')[0]
        : '';

      const nom = valeurDe(formulaire.elements.nom);
      const type = valeurDe(formulaire.elements.type);
      const telephone = valeurDe(formulaire.elements.telephone) || 'non renseigné';

      const objet = `Demande de projet : ${type} (${nom})`;
      const lignes = [
        'Bonjour,',
        '',
        valeurDe(formulaire.elements.message),
        '',
        '--',
        `Nom : ${nom}`,
        `E-mail : ${valeurDe(formulaire.elements.email)}`,
        `Téléphone : ${telephone}`,
        `Type de projet : ${type}`,
      ];

      // Les messageries attendent des retours à la ligne « \r\n ».
      return `mailto:${adresse}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(lignes.join('\r\n'))}`;
    };

    formulaire.addEventListener('submit', (evenement) => {
      evenement.preventDefault(); // pas d'envoi classique : il n'y a pas de serveur

      // On valide tous les champs sans s'arrêter au premier en erreur, pour
      // que chacun affiche son message.
      const invalides = champs.filter((champ) => !validerChamp(champ));

      if (invalides.length) {
        confirmation.hidden = true;
        alerte.textContent = invalides.length === 1
          ? 'Le formulaire contient 1 erreur. Corrigez le champ signalé, puis validez à nouveau.'
          : `Le formulaire contient ${invalides.length} erreurs. Corrigez les champs signalés, puis validez à nouveau.`;
        alerte.hidden = false;
        invalides[0].focus(); // le focus va sur le premier champ à corriger
        return;
      }

      alerte.hidden = true;
      alerte.textContent = '';

      const lien = composerLienMessagerie();
      lienMessagerie.href = lien; // lien de secours, si la messagerie ne s'ouvre pas seule

      confirmation.hidden = false;
      confirmation.focus({ preventScroll: true });
      confirmation.scrollIntoView({ block: 'nearest', behavior: mouvementReduit() ? 'auto' : 'smooth' });

      // Ouvre la messagerie par défaut du visiteur. La page reste affichée.
      window.location.href = lien;
    });
  }


  /* ========================================================================
     8. PIED DE PAGE : ANNÉE EN COURS
     ======================================================================== */
  function initialiserAnnee() {
    const annee = un('#annee');
    if (annee) annee.textContent = String(new Date().getFullYear());
  }


  /* ========================================================================
     9. DÉMARRAGE
     ------------------------------------------------------------------------
     Chaque module est lancé séparément : si l'un d'eux rencontrait une
     erreur imprévue, les autres continueraient de fonctionner.
     ======================================================================== */
  [
    initialiserEntete,
    initialiserMenuMobile,
    initialiserRevelations,
    initialiserFiltres,
    initialiserModale,
    initialiserFormulaire,
    initialiserAnnee,
  ].forEach((initialiser) => {
    try {
      initialiser();
    } catch (erreur) {
      console.error(`LMB : le module « ${initialiser.name} » n'a pas pu démarrer.`, erreur);
    }
  });
})();
