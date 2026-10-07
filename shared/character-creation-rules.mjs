/**
 * Canonical, pure level-one creation data for the 2014 Player's Handbook.
 * This module never reads a database and never accepts client-calculated grants.
 */
import { ABILITY_KEYS, CLASS_RULES, SUBCLASS_RULES, getClassRule } from "./character-class-rules.mjs";
import SPELL_CHOICE_CATALOG from "./character-creation-spell-options.json" with { type: "json" };
import { validateRuleSelections } from "./character-rule-engine.mjs";
import { resolveLevelOneEventGrants } from "./character-creation-event-rules.mjs";
import { resolvePhbSpell } from "./phb-spell-catalog.mjs";

export const CHARACTER_CREATION_RULESET = Object.freeze({
  id: "dnd-5e-2014-phb", version: "2014", reference: "Manuale del Giocatore 5.0",
});
export const GUIDED_ALIGNMENTS = Object.freeze(["Legale buono","Neutrale buono","Caotico buono","Legale neutrale","Neutrale","Caotico neutrale","Legale malvagio","Neutrale malvagio","Caotico malvagio"]);
export const POINT_BUY_COSTS = Object.freeze({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 });
export const SKILLS = Object.freeze({
  acrobatics:"Acrobazia", animalHandling:"Addestrare Animali", arcana:"Arcano", athletics:"Atletica", deception:"Inganno", history:"Storia", insight:"Intuizione", intimidation:"Intimidire", investigation:"Indagare", medicine:"Medicina", nature:"Natura", perception:"Percezione", performance:"Intrattenere", persuasion:"Persuasione", religion:"Religione", sleightOfHand:"Rapidità di Mano", stealth:"Furtività", survival:"Sopravvivenza",
});
export const LANGUAGES = Object.freeze({ common:"Comune", dwarvish:"Nanico", elvish:"Elfico", giant:"Gigante", gnomish:"Gnomesco", goblin:"Goblin", halfling:"Halfling", orc:"Orchesco", draconic:"Draconico", infernal:"Infernale", celestial:"Celestiale", abyssal:"Abissale", deepSpeech:"Linguaggio Profondo", primordial:"Primordiale", sylvan:"Silvano", undercommon:"Sottocomune", druidic:"Druidico" });
export const SKILL_ABILITIES = Object.freeze({ acrobatics:"dexterity",animalHandling:"wisdom",arcana:"intelligence",athletics:"strength",deception:"charisma",history:"intelligence",insight:"wisdom",intimidation:"charisma",investigation:"intelligence",medicine:"wisdom",nature:"intelligence",perception:"wisdom",performance:"charisma",persuasion:"charisma",religion:"intelligence",sleightOfHand:"dexterity",stealth:"dexterity",survival:"wisdom" });
export const TOOLS = Object.freeze({ artisansTools:"Strumenti da artigiano",brewersSupplies:"Scorte da birraio",diceSet:"Set di dadi",dragonchessSet:"Set di dragonchess",threeDragonAnteSet:"Set di Tre Draghi al Buio",disguiseKit:"Kit da travestimento",forgeryKit:"Kit da falsario",gamingSet:"Set da gioco",herbalismKit:"Kit da erborista",landVehicles:"Veicoli terrestri",masonsTools:"Strumenti da muratore",musicalInstrument:"Strumento musicale",navigatorsTools:"Strumenti da navigatore",playingCardSet:"Mazzo di carte",smithsTools:"Strumenti da fabbro",thievesTools:"Arnesi da scasso",waterVehicles:"Veicoli acquatici" });
const MUSICAL_INSTRUMENTS = Object.freeze(["bagpipes","drum","dulcimer","flute","lute","lyre","horn","panFlute","shawm","viol"]);
const ARTISAN_TOOLS = Object.freeze(["alchemistsSupplies","brewersSupplies","calligraphersSupplies","carpentersTools","cartographersTools","cobblersTools","cooksUtensils","glassblowersTools","jewelersTools","leatherworkersTools","masonsTools","paintersSupplies","pottersTools","smithsTools","tinkersTools","weaversTools","woodcarversTools"]);
const SPECIFIC_TOOLS = Object.freeze([...new Set([...Object.keys(TOOLS).filter((key)=>!["artisansTools","gamingSet","musicalInstrument"].includes(key)),...ARTISAN_TOOLS,...MUSICAL_INSTRUMENTS])]);
export const ARTISAN_TOOL_LABELS = Object.freeze({alchemistsSupplies:"Scorte da alchimista",brewersSupplies:"Scorte da birraio",calligraphersSupplies:"Strumenti da calligrafo",carpentersTools:"Strumenti da carpentiere",cartographersTools:"Strumenti da cartografo",cobblersTools:"Strumenti da calzolaio",cooksUtensils:"Utensili da cuoco",glassblowersTools:"Strumenti da vetraio",jewelersTools:"Strumenti da gioielliere",leatherworkersTools:"Strumenti da conciatore",masonsTools:"Strumenti da muratore",paintersSupplies:"Scorte da pittore",pottersTools:"Strumenti da vasaio",smithsTools:"Strumenti da fabbro",tinkersTools:"Strumenti da inventore",weaversTools:"Strumenti da tessitore",woodcarversTools:"Strumenti da intagliatore"});
export const EQUIPMENT = Object.freeze({ chainMail:"Cotta di maglia",leatherArmor:"Armatura di cuoio",scaleMail:"Corazza di scaglie",shield:"Scudo",rapier:"Stocco",longsword:"Spada lunga",shortsword:"Spada corta",greataxe:"Ascia bipenne",twoHandaxes:"Due asce leggere",lightCrossbow:"Balestra leggera",longbow:"Arco lungo",mace:"Mazza",warhammer:"Martello da guerra",scimitar:"Scimitarra",woodenShield:"Scudo di legno",quarterstaff:"Bastone ferrato",dagger:"Pugnale",componentPouch:"Borsa per componenti",arcaneFocus:"Focus arcano",dungeoneersPack:"Dotazione da esploratore di dungeon",explorersPack:"Dotazione da esploratore",diplomatsPack:"Dotazione da diplomatico",entertainersPack:"Dotazione da intrattenitore",priestsPack:"Dotazione da sacerdote",burglarsPack:"Dotazione da scassinatore",scholarsPack:"Dotazione da studioso" });
export const ADDITIONAL_EQUIPMENT_LABELS = Object.freeze({ fourJavelins:"Quattro giavellotti",holySymbol:"Simbolo sacro",druidicFocus:"Focus druidico",tenDarts:"Dieci dardi",twoDaggers:"Due pugnali",spellbook:"Libro degli incantesimi",thievesTools:"Arnesi da scasso","20Arrows":"20 frecce","20Bolts":"20 quadrelli",bagpipes:"Cornamusa",drum:"Tamburo",dulcimer:"Dulcimer",flute:"Flauto",lute:"Liuto",lyre:"Lira",horn:"Corno",panFlute:"Flauto di Pan",shawm:"Ciaramella",viol:"Viola"});
export const BACKGROUND_EQUIPMENT_LABELS = Object.freeze({
  arrow:"Freccia", bolt:"Quadrello", incense:"Incenso",
  prayerBookOrWheel:"Libro di preghiere o ruota di preghiera", "5Incense":"Cinque bastoncini d'incenso", vestments:"Paramenti sacri", commonClothes:"Abiti comuni",
  fineClothes:"Abiti pregiati", conTools:"Attrezzi per truffe", crowbar:"Piede di porco", darkCommonClothes:"Abiti comuni scuri",
  musicalInstrument:"Strumento musicale", admirersFavor:"Ricordo di un ammiratore", costume:"Costume", artisansTools:"Strumenti da artigiano",
  shovel:"Pala", ironPot:"Pentola di ferro", guildLetter:"Lettera di presentazione della gilda", travelerClothes:"Abiti da viaggiatore",
  scrollCase:"Custodia per pergamene", winterBlanket:"Coperta invernale", signetRing:"Anello con sigillo", pedigreeScroll:"Pergamena genealogica",
  staff:"Bastone", huntingTrap:"Tagliola", trophy:"Trofeo di un animale", inkBottle:"Boccetta d'inchiostro", quill:"Pennino",
  smallKnife:"Coltellino", letterFromDeadColleague:"Lettera di un collega defunto", belayingPin:"Caviglia di legno", "50SilkRope":"15 metri di corda di seta",
  luckyCharm:"Portafortuna", insigniaOfRank:"Insegna del grado", boneDiceOrDeckCards:"Dadi d'osso o mazzo di carte", cityMap:"Mappa della città",
  petMouse:"Topo domestico", parentsToken:"Ricordo dei genitori",
  prayerBook:"Libro di preghiere", prayerWheel:"Ruota di preghiera", tenStopperedBottles:"Dieci bottiglie con tappo", weightedDice:"Dadi truccati", markedCards:"Carte segnate", signetRingOfImaginaryDuke:"Anello con sigillo di un duca immaginario",
  silkRopeBracelet:"Braccialetto di corda di seta", seagullFeather:"Piuma di gabbiano", smallStoneFromDistantLand:"Pietra di una terra lontana", smallVialOfSeaWater:"Fiala di acqua di mare", daggerTakenFromFallenEnemy:"Pugnale di un nemico caduto", pieceOfBrokenBanner:"Pezzo di stendardo", bulletOrArrow:"Proiettile o freccia", stripOfCloth:"Striscia di stoffa", boneDice:"Dadi d'osso", deckPlayingCards:"Mazzo di carte", mule:"Mulo", cart:"Carretto",
});
const SIMPLE_MELEE_WEAPONS = ["club","dagger","greatclub","handaxe","javelin","lightHammer","mace","quarterstaff","sickle","spear"];
const SIMPLE_RANGED_WEAPONS = ["lightCrossbow","dart","shortbow","sling"];
const MARTIAL_MELEE_WEAPONS = ["battleaxe","flail","glaive","greataxe","greatsword","halberd","lance","longsword","maul","morningstar","pike","rapier","scimitar","shortsword","trident","warPick","warhammer","whip"];
const MARTIAL_RANGED_WEAPONS = ["blowgun","handCrossbow","heavyCrossbow","longbow","net"];
export const GENERIC_EQUIPMENT = Object.freeze({
  simpleWeapon:{count:1,options:[...SIMPLE_MELEE_WEAPONS,...SIMPLE_RANGED_WEAPONS]},
  simpleMeleeWeapon:{count:1,options:SIMPLE_MELEE_WEAPONS},
  martialWeapon:{count:1,options:[...MARTIAL_MELEE_WEAPONS,...MARTIAL_RANGED_WEAPONS]},
  martialMeleeWeapon:{count:1,options:MARTIAL_MELEE_WEAPONS},
  twoMartialWeapons:{count:2,options:[...MARTIAL_MELEE_WEAPONS,...MARTIAL_RANGED_WEAPONS]},
  twoSimpleMeleeWeapons:{count:2,options:SIMPLE_MELEE_WEAPONS},
  musicalInstrument:{count:1,options:MUSICAL_INSTRUMENTS},
  artisansTools:{count:1,options:ARTISAN_TOOLS},
  inexpensiveUnusualWeapon:{count:1,options:["trident","net"]},
});
export const WEAPON_LABELS = Object.freeze({club:"Randello",greatclub:"Randello pesante",handaxe:"Ascia",javelin:"Giavellotto",lightHammer:"Martello leggero",sickle:"Falcetto",spear:"Lancia",dart:"Dardo",shortbow:"Arco corto",sling:"Fionda",battleaxe:"Ascia da battaglia",flail:"Mazzafrusto",glaive:"Falcione",greatsword:"Spadone",halberd:"Alabarda",lance:"Lancia da cavaliere",maul:"Maglio",morningstar:"Morningstar",pike:"Picca",trident:"Tridente",warPick:"Piccone da guerra",whip:"Frusta",blowgun:"Cerbottana",handCrossbow:"Balestra a mano",heavyCrossbow:"Balestra pesante",net:"Rete"});
export const CLASS_FIXED_EQUIPMENT = Object.freeze({
  barbarian: ["explorersPack", "fourJavelins"],
  bard: ["leatherArmor", "dagger"],
  cleric: ["shield", "holySymbol"],
  druid: ["leatherArmor", "explorersPack", "druidicFocus"],
  fighter: [],
  monk: ["tenDarts"],
  paladin: ["chainMail", "holySymbol"],
  ranger: ["longbow", "20Arrows"],
  rogue: ["leatherArmor", "twoDaggers", "thievesTools"],
  sorcerer: ["twoDaggers"],
  warlock: ["leatherArmor", "twoDaggers"],
  wizard: ["spellbook"],
});
export const FEATS = Object.freeze({ actor:"Attore",athlete:"Atleta",alert:"Allerta",charger:"Caricatore",crossbowExpert:"Esperto di Balestra",defensiveDuelist:"Duellante Difensivo",dualWielder:"Combattente con Due Armi",dungeonDelver:"Esploratore di Dungeon",durable:"Resistente",elementalAdept:"Adepto Elementale",grappler:"Lottatore",greatWeaponMaster:"Maestro delle Armi Possenti",healer:"Guaritore",heavilyArmored:"Corazzato Pesante",heavyArmorMaster:"Maestro delle Armature Pesanti",inspiringLeader:"Condottiero Ispiratore",keenMind:"Mente Acuta",lightlyArmored:"Corazzato Leggero",linguist:"Linguista",lucky:"Fortunato",mageSlayer:"Cacciatore di Maghi",magicInitiate:"Iniziato alla Magia",martialAdept:"Adepto Marziale",mediumArmorMaster:"Maestro delle Armature Medie",mobile:"Mobile",moderatelyArmored:"Corazzato Medio",mountedCombatant:"Combattente a Cavallo",observant:"Osservatore",polearmMaster:"Maestro delle Armi in Asta",resilient:"Resiliente",ritualCaster:"Incantatore Rituale",savageAttacker:"Attaccante Selvaggio",sentinel:"Sentinella",sharpshooter:"Tiratore Scelto",shieldMaster:"Maestro degli Scudi",skilled:"Abile",skulker:"Agguato",spellSniper:"Cecchino Magico",tavernBrawler:"Rissaiolo da Taverna",tough:"Robusto",warCaster:"Incantatore da Guerra",weaponMaster:"Maestro d'Armi" });
export const FEAT_PREREQUISITES = Object.freeze({ elementalAdept:{spellcasting:true},skulker:{dexterity:13},spellSniper:{spellcasting:true},inspiringLeader:{charisma:13},moderatelyArmored:{armor:"light"},heavilyArmored:{armor:"medium"},defensiveDuelist:{dexterity:13},warCaster:{spellcasting:true},ritualCaster:{intelligenceOrWisdom:13},grappler:{strength:13},mediumArmorMaster:{armor:"medium"},heavyArmorMaster:{armor:"heavy"} });
/** Guided narrative fields are persisted verbatim; PHB explicitly permits custom entries. */
export const GUIDED_NARRATIVE_FIELDS = Object.freeze([
  Object.freeze({key:"name",label:{it:"Nome",en:"Name"},kind:"text",required:true,maxLength:120}),
  Object.freeze({key:"alignment",label:{it:"Allineamento",en:"Alignment"},kind:"choice",required:true,options:["lawfulGood","neutralGood","chaoticGood","lawfulNeutral","neutral","chaoticNeutral","lawfulEvil","neutralEvil","chaoticEvil"]}),
  Object.freeze({key:"personalityTraits",label:{it:"Tratti della personalità",en:"Personality traits"},kind:"freeTextList",min:2,max:2,maxLength:500}),
  Object.freeze({key:"ideal",label:{it:"Ideale",en:"Ideal"},kind:"freeText",maxLength:500}),
  Object.freeze({key:"bond",label:{it:"Legame",en:"Bond"},kind:"freeText",maxLength:500}),
  Object.freeze({key:"flaw",label:{it:"Difetto",en:"Flaw"},kind:"freeText",maxLength:500}),
]);
const allSkills = Object.freeze(Object.keys(SKILLS));
const allLanguages = Object.freeze(Object.keys(LANGUAGES).filter((key) => key !== "druidic"));
const label = (it, en = it) => Object.freeze({ it, en });
const grants = (values) => Object.freeze(values);
const choice = (id, kind, count, options, extra = {}) => Object.freeze({ id, label: label(`Scelta: ${({skill:"abilità",language:"lingua",tool:"strumento",equipment:"equipaggiamento",cantrip:"trucchetto",spell:"incantesimo",preparedSpell:"incantesimi preparati",ability:"punteggi di caratteristica",feat:"talento",subclass:"archetipo"})[kind] ?? kind}`), kind, count, distinct: true, options: Object.freeze(options), ...extra });
const feature = (key, it, description = null) => Object.freeze({ key, label: label(it), description });
const equipment = (id, alternatives) => choice(id, "equipment", 1, alternatives.map((items, index) => ({ key: `${id}:${index + 1}`, items })));
const CLASS_EXTRA_EQUIPMENT = Object.freeze({
  bard: [{ ...choice("class:bard:starting-instrument", "equipmentItem", 1, MUSICAL_INSTRUMENTS), label: label("Strumento musicale della dotazione iniziale") }],
  cleric: [equipment("class:cleric:armor", [["scaleMail"], ["leatherArmor"], ["chainMail"]]), equipment("class:cleric:ranged", [["lightCrossbow", "20Bolts"], ["simpleWeapon"]])],
  warlock: [equipment("class:warlock:fixed-weapon", [["simpleWeapon"]])],
});
const FEAT_SPELL_CLASSES = Object.freeze({ bard:"bardo", cleric:"chierico", druid:"druido", sorcerer:"stregone", warlock:"warlock", wizard:"mago" });
const FEAT_MANEUVERS = Object.freeze({
  goadingAttack:"Attacco Adescante", lunge:"Attacco con Affondo", feintingAttack:"Attacco con Finta",
  maneuveringAttack:"Attacco con Manovra", sweepingAttack:"Attacco con Spazzata", pushingAttack:"Attacco con Spinta",
  disarmingAttack:"Attacco Disarmante", menacingAttack:"Attacco Minaccioso", precisionAttack:"Attacco Preciso",
  tripAttack:"Attacco Sbilanciante", commandersStrike:"Colpo del Comandante", distractingStrike:"Colpo Distraente",
  rally:"Incoraggiamento", parry:"Parata", riposte:"Replica", evasiveFootwork:"Scarto Elusivo",
});
const FIGHTING_STYLE_LABELS = Object.freeze({archery:"Tiro con l'Arco",defense:"Difesa",dueling:"Duellare",greatWeaponFighting:"Combattere con Armi Possenti",protection:"Protezione",twoWeaponFighting:"Combattere con Due Armi"});
const FAVORED_TERRAIN_LABELS = Object.freeze({arctic:"Artico",coast:"Costa",desert:"Deserto",forest:"Foresta",grassland:"Prateria",mountain:"Montagna",swamp:"Palude",underdark:"Sottosuolo"});
const FAVORED_ENEMY_LABELS = Object.freeze({aberrations:"Aberrazioni",beasts:"Bestie",celestials:"Celestiali",constructs:"Costrutti",dragons:"Draghi",elementals:"Elementali",fey:"Folletti",fiends:"Immondi",giants:"Giganti",monstrosities:"Mostruosità",oozes:"Melme",plants:"Vegetali",undead:"Non morti",twoHumanoidRaces:"Due razze umanoidi"});
const HUMANOID_RACES = Object.freeze({human:"Umani",elf:"Elfi",dwarf:"Nani",halfling:"Halfling",gnome:"Gnomi",halfElf:"Mezzelfi",halfOrc:"Mezzorchi",dragonborn:"Dragonidi",tiefling:"Tiefling",goblin:"Goblin",hobgoblin:"Hobgoblin",bugbear:"Bugbear",orc:"Orchi",gnoll:"Gnoll",kobold:"Coboldi",lizardfolk:"Uomini lucertola"});
const DRACONIC_ANCESTRY_LABELS = Object.freeze({black:"Nero",blue:"Blu",brass:"Ottone",bronze:"Bronzo",copper:"Rame",gold:"Oro",green:"Verde",red:"Rosso",silver:"Argento",white:"Bianco"});
export const FEAT_FIXED_BONUSES = Object.freeze({ actor:{charisma:1}, durable:{constitution:1}, heavilyArmored:{strength:1}, keenMind:{intelligence:1}, linguist:{intelligence:1} });
function featChoiceSlots(featKey, input) {
  if (!featKey) return [];
  const slots = [];
  const add = (suffix, kind, count, options) => slots.push(choice(`feat:${featKey}:${suffix}`, kind, count, options));
  if (["athlete","lightlyArmored","moderatelyArmored","weaponMaster"].includes(featKey)) add("ability", "ability", 1, ["strength","dexterity"]);
  if (featKey === "observant") add("ability", "ability", 1, ["intelligence","wisdom"]);
  if (featKey === "tavernBrawler") add("ability", "ability", 1, ["strength","constitution"]);
  if (featKey === "resilient") add("ability", "ability", 1, ABILITY_KEYS);
  if (featKey === "linguist") add("languages", "language", 3, allLanguages);
  if (featKey === "skilled") add("proficiencies", "skillOrTool", 3, [...allSkills, ...SPECIFIC_TOOLS]);
  if (featKey === "weaponMaster") add("weapons", "weapon", 4, [...SIMPLE_MELEE_WEAPONS, ...SIMPLE_RANGED_WEAPONS, ...MARTIAL_MELEE_WEAPONS, ...MARTIAL_RANGED_WEAPONS]);
  if (featKey === "martialAdept") add("maneuvers", "maneuver", 2, Object.keys(FEAT_MANEUVERS));
  if (featKey === "elementalAdept") add("damage", "damageType", 1, ["acid","cold","lightning","fire","thunder"]);
  if (["magicInitiate","ritualCaster","spellSniper"].includes(featKey)) {
    add("class", "spellClass", 1, Object.keys(FEAT_SPELL_CLASSES));
    const spellClass = catalogEntry(FEAT_SPELL_CLASSES, selected(input, `feat:${featKey}:class`)[0]);
    if (spellClass) {
      const available = SPELL_CHOICE_CATALOG[spellClass] ?? [];
      if (featKey === "magicInitiate") {
        slots.push(choice(`feat:${featKey}:cantrips`, "cantrip", 2, available.filter((spell) => spell.level === 0).map((spell) => ({key:spell.name,label:label(spell.label ?? spell.name)}))));
        slots.push(choice(`feat:${featKey}:spell`, "spell", 1, available.filter((spell) => spell.level === 1).map((spell) => ({key:spell.name,label:label(spell.label ?? spell.name)}))));
      }
      if (featKey === "ritualCaster") slots.push(choice(`feat:${featKey}:rituals`, "spell", 2, available.filter((spell) => spell.level === 1 && spell.ritual).map((spell) => ({key:spell.name,label:label(spell.label ?? spell.name)}))));
      if (featKey === "spellSniper") slots.push(choice(`feat:${featKey}:cantrip`, "cantrip", 1, available.filter((spell) => spell.level === 0 && spell.attack_roll).map((spell) => ({key:spell.name,label:label(spell.label ?? spell.name)}))));
    }
  }
  return slots;
}
export const CLERIC_DOMAINS = Object.freeze({
  "knowledge-domain":{key:"knowledge-domain",label:label("Dominio della Conoscenza"),features:[feature("blessings-of-knowledge","Benedizioni della Conoscenza")],choices:[choice("class:cleric:knowledge:languages","language",2,allLanguages),choice("class:cleric:knowledge:skills","skill",2,["arcana","history","nature","religion"])]},
  "life-domain":{key:"life-domain",label:label("Dominio della Vita"),armor:["heavy"],features:[feature("disciple-of-life","Discepolo della Vita")]},
  "light-domain":{key:"light-domain",label:label("Dominio della Luce"),features:[feature("bonus-cantrip-light","Trucchetto Luce"),feature("warding-flare","Bagliore Protettivo")]},
  "nature-domain":{key:"nature-domain",label:label("Dominio della Natura"),armor:["heavy"],features:[feature("acolyte-of-nature","Adepto della Natura")],choices:[choice("class:cleric:nature:skill","skill",1,["animalHandling","nature","survival"]),choice("class:cleric:nature:cantrip","cantrip",1,[],{optionsSource:{type:"legacy-spell-list",classKey:"druido",level:0}})]},
  "tempest-domain":{key:"tempest-domain",label:label("Dominio della Tempesta"),armor:["heavy"],weapons:["martial"],features:[feature("wrath-of-the-storm","Ira della Tempesta")]},
  "trickery-domain":{key:"trickery-domain",label:label("Dominio dell'Inganno"),features:[feature("blessing-of-the-trickster","Benedizione dell'Imbroglione")]},
  "war-domain":{key:"war-domain",label:label("Dominio della Guerra"),armor:["heavy"],weapons:["martial"],features:[feature("war-priest","Sacerdote della Guerra")]},
});
const CLERIC_DOMAIN_SPELLS_LEVEL_ONE = Object.freeze({
  "knowledge-domain":["Comando","Identificare"],
  "life-domain":["Benedizione","Cura Ferite"],
  "light-domain":["Luminescenza","Mani Brucianti"],
  "nature-domain":["Amicizia con gli Animali","Parlare con gli Animali"],
  "tempest-domain":["Nube di Nebbia","Onda Tonante"],
  "trickery-domain":["Camuffare Sé Stesso","Charme su Persone"],
  "war-domain":["Favore Divino","Scudo della Fede"],
});
const WARLOCK_PATRON_SPELLS_LEVEL_ONE = Object.freeze({
  "the-archfey": ["Luminescenza", "Sonno"],
  "the-fiend": ["Comando", "Mani Brucianti"],
  "the-great-old-one": ["Risata Incontenibile", "Sussurri Dissonanti"],
});
export const FIRST_LEVEL_SUBCLASS_FEATURES = Object.freeze({
  "draconic-bloodline": [feature("dragon-ancestor", "Antenato Draconico"), feature("draconic-resilience", "Resilienza Draconica")],
  "wild-magic": [feature("wild-magic-surge", "Impulso di Magia Selvaggia"), feature("tides-of-chaos", "Onde di Caos")],
  "the-archfey": [feature("fey-presence", "Presenza Fatata")],
  "the-fiend": [feature("dark-ones-blessing", "Benedizione dell'Oscuro")],
  "the-great-old-one": [feature("awakened-mind", "Mente Risvegliata")],
});

const race = (key, it, data) => Object.freeze({ key, label: label(it), source: CHARACTER_CREATION_RULESET, ...data });
export const RACES = Object.freeze({
  dragonborn: race("dragonborn", "Dragonide", { abilityBonuses: grants({ strength: 2, charisma: 1 }), size:"Medium", speed:30, languages:["common","draconic"], features:[feature("draconic-ancestry","Discendenza Draconica"),feature("breath-weapon","Arma a Soffio"),feature("damage-resistance","Resistenza ai Danni")], choices:[choice("race:dragonborn:ancestry","draconicAncestry",1,["black","blue","brass","bronze","copper","gold","green","red","silver","white"])] }),
  dwarf: race("dwarf", "Nano", { abilityBonuses:grants({ constitution:2 }), size:"Medium", speed:25, languages:["common","dwarvish"], weaponProficiencies:["battleaxe","handaxe","lightHammer","warhammer"], features:[feature("darkvision","Scurovisione"),feature("dwarven-resilience","Resilienza Nanica"),feature("dwarven-combat-training","Addestramento da Combattimento Nanico"),feature("stonecunning","Esperto di Pietra")], subraces:{ hill:{ key:"hill",label:label("Nano delle Colline"),abilityBonuses:grants({ wisdom:1 }),features:[feature("dwarven-toughness","Robustezza Nanica")] }, mountain:{key:"mountain",label:label("Nano delle Montagne"),abilityBonuses:grants({ strength:2 }),armorProficiencies:["light","medium"]} }, choices:[choice("race:dwarf:tool","tool",1,["smithsTools","brewersSupplies","masonsTools"])] }),
  elf: race("elf", "Elfo", { abilityBonuses:grants({ dexterity:2 }), size:"Medium", speed:30, languages:["common","elvish"], features:[feature("darkvision","Scurovisione"),feature("keen-senses","Sensi Acuti"),feature("fey-ancestry","Retaggio Fatato"),feature("trance","Trance")], skillProficiencies:["perception"], subraces:{ high:{key:"high",label:label("Elfo Alto"),abilityBonuses:grants({ intelligence:1 }),weaponProficiencies:["longsword","shortsword","shortbow","longbow"],languagesChoice:1,features:[feature("elf-weapon-training","Addestramento nelle Armi Elfiche"),feature("cantrip","Trucchetto")],choices:[choice("race:elf:high:language","language",1,allLanguages),choice("race:elf:high:cantrip","cantrip",1,[],{optionsSource:{type:"wizard-spell-list",level:0}})]}, wood:{key:"wood",label:label("Elfo dei Boschi"),abilityBonuses:grants({ wisdom:1 }),weaponProficiencies:["longsword","shortsword","shortbow","longbow"],speed:35,features:[feature("elf-weapon-training","Addestramento nelle Armi Elfiche"),feature("fleet-of-foot","Piede Lesto"),feature("mask-of-the-wild","Maschera della Selva")]}, drow:{key:"drow",label:label("Elfo Oscuro (Drow)"),abilityBonuses:grants({ charisma:1 }),weaponProficiencies:["rapier","shortsword","handCrossbow"],features:[feature("superior-darkvision","Scurovisione Superiore"),feature("sunlight-sensitivity","Sensibilità alla Luce Solare"),feature("drow-magic","Magia Drow"),feature("drow-weapon-training","Addestramento nelle Armi Drow")]}} }),
  halfling: race("halfling", "Halfling", { abilityBonuses:grants({ dexterity:2 }), size:"Small", speed:25, languages:["common","halfling"], features:[feature("lucky","Fortunato"),feature("brave","Coraggioso"),feature("halfling-nimbleness","Agilità Halfling")],subraces:{ lightfoot:{key:"lightfoot",label:label("Halfling Piedelesto"),abilityBonuses:grants({ charisma:1 }),features:[feature("naturally-stealthy","Furtività Innata")]}, stout:{key:"stout",label:label("Halfling Tozzo"),abilityBonuses:grants({ constitution:1 }),features:[feature("stout-resilience","Resilienza Halfling")]}} }),
  human: race("human", "Umano", { abilityBonuses:grants({ strength:1,dexterity:1,constitution:1,intelligence:1,wisdom:1,charisma:1 }),size:"Medium",speed:30,languages:["common"],choices:[choice("race:human:language","language",1,allLanguages)] }),
  "variant-human": race("variant-human","Umano variante",{abilityBonuses:grants({}),size:"Medium",speed:30,languages:["common"],features:[feature("feat","Talento")],choices:[choice("race:variant-human:abilities","ability",2,ABILITY_KEYS),choice("race:variant-human:skill","skill",1,allSkills),choice("race:variant-human:feat","feat",1,[],{optionsSource:{type:"phb-feat"}}),choice("race:variant-human:language","language",1,allLanguages)]}),
  gnome: race("gnome","Gnomo",{abilityBonuses:grants({ intelligence:2 }),size:"Small",speed:25,languages:["common","gnomish"],features:[feature("darkvision","Scurovisione"),feature("gnome-cunning","Astuzia Gnomesca")],subraces:{ forest:{key:"forest",label:label("Gnomo delle Foreste"),abilityBonuses:grants({ dexterity:1 }),features:[feature("natural-illusionist","Illusionista Naturale"),feature("speak-with-small-beasts","Parlare con le Bestie Piccole")]}, rock:{key:"rock",label:label("Gnomo delle Rocce"),abilityBonuses:grants({ constitution:1 }),features:[feature("artificers-lore","Conoscenza dell'Artificiere"),feature("tinker","Artigiano")]} }}),
  halfElf: race("half-elf","Mezzelfo",{abilityBonuses:grants({ charisma:2 }),size:"Medium",speed:30,languages:["common","elvish"],features:[feature("darkvision","Scurovisione"),feature("fey-ancestry","Retaggio Fatato"),feature("skill-versatility","Versatilità nelle Abilità")],choices:[choice("race:half-elf:abilities","ability",2,ABILITY_KEYS,{excludedOptions:["charisma"]}),choice("race:half-elf:skills","skill",2,allSkills),choice("race:half-elf:language","language",1,allLanguages)]}),
  halfOrc: race("half-orc","Mezzorco",{abilityBonuses:grants({ strength:2,constitution:1 }),size:"Medium",speed:30,languages:["common","orc"],features:[feature("darkvision","Scurovisione"),feature("menacing","Minaccioso"),feature("relentless-endurance","Tenacia Implacabile"),feature("savage-attacks","Attacchi Selvaggi")],skillProficiencies:["intimidation"]}),
  tiefling: race("tiefling","Tiefling",{abilityBonuses:grants({ intelligence:1,charisma:2 }),size:"Medium",speed:30,languages:["common","infernal"],features:[feature("darkvision","Scurovisione"),feature("hellish-resistance","Resistenza Infernale"),feature("infernal-legacy","Retaggio Infernale")]})
});

const classData = (key, skills, count, fixed, choices = [], spellcasting = null) => Object.freeze({ key, source:CHARACTER_CREATION_RULESET, skills:choice(`class:${key}:skills`,"skill",count,skills), fixed:grants(fixed), choices:Object.freeze(choices), spellcasting });
const pack = (key, ...alternatives) => equipment(`class:${key}:pack`, alternatives);
export const LEVEL_ONE_CLASSES = Object.freeze({
  barbarian:classData("barbarian",["animalHandling","athletics","intimidation","nature","perception","survival"],2,{armor:["light","medium","shields"],weapons:["simple","martial"],savingThrows:["strength","constitution"],features:[feature("rage","Ira"),feature("unarmored-defense","Difesa Senza Armatura")]},[equipment("class:barbarian:weapon",[["greataxe"],["martialMeleeWeapon"]]),equipment("class:barbarian:secondary",[["twoHandaxes"],["simpleWeapon"]]),pack("barbarian",["explorersPack"],["explorersPack"])]),
  bard:classData("bard",allSkills,3,{armor:["light"],weapons:["simple","handCrossbow","longsword","rapier","shortsword"],savingThrows:["dexterity","charisma"],features:[feature("bardic-inspiration","Ispirazione Bardica"),feature("spellcasting","Incantesimi")]},[equipment("class:bard:weapon",[["rapier"],["longsword"],["simpleWeapon"]]),pack("bard",["diplomatsPack"],["entertainersPack"]),choice("class:bard:instruments","tool",3,MUSICAL_INSTRUMENTS),choice("class:bard:cantrips","cantrip",2,[],{optionsSource:{type:"legacy-spell-list",classKey:"bardo",level:0}}),choice("class:bard:spells","spell",4,[],{optionsSource:{type:"legacy-spell-list",classKey:"bardo",level:1}})],{ability:"charisma",knownCantrips:2,knownSpells:4,slots:[2]}),
  cleric:classData("cleric",["history","insight","medicine","persuasion","religion"],2,{armor:["light","medium","shields"],weapons:["simple"],savingThrows:["wisdom","charisma"],features:[feature("spellcasting","Incantesimi"),feature("divine-domain","Dominio Divino")]},[equipment("class:cleric:weapon",[["mace"],["warhammer"]]),pack("cleric",["priestsPack"],["explorersPack"]),choice("class:cleric:cantrips","cantrip",3,[],{optionsSource:{type:"legacy-spell-list",classKey:"chierico",level:0}}),choice("class:cleric:prepared-spells","preparedSpell",null,[],{optionsSource:{type:"legacy-spell-list",classKey:"chierico",level:1},formula:"wisdomModifier + 1, minimum 1"}),choice("class:cleric:domain","subclass",1,Object.values(CLERIC_DOMAINS))],{ability:"wisdom",knownCantrips:3,preparedFormula:"wisdomModifier + level",slots:[2]}),
  druid:classData("druid",["arcana","animalHandling","insight","medicine","nature","perception","religion","survival"],2,{armor:["light","medium-nonmetal","shields-nonmetal"],weapons:["club","dagger","dart","javelin","mace","quarterstaff","scimitar","sickle","sling","spear"],savingThrows:["intelligence","wisdom"],tools:["herbalismKit"],features:[feature("druidic","Druidico"),feature("spellcasting","Incantesimi")]},[equipment("class:druid:weapon",[["woodenShield"],["simpleWeapon"]]),equipment("class:druid:weapon2",[["scimitar"],["simpleMeleeWeapon"]]),pack("druid",["explorersPack"],["explorersPack"]),choice("class:druid:cantrips","cantrip",2,[],{optionsSource:{type:"legacy-spell-list",classKey:"druido",level:0}}),choice("class:druid:prepared-spells","preparedSpell",null,[],{optionsSource:{type:"legacy-spell-list",classKey:"druido",level:1},formula:"wisdomModifier + 1, minimum 1"})],{ability:"wisdom",knownCantrips:2,preparedFormula:"wisdomModifier + level",slots:[2]}),
  fighter:classData("fighter",["acrobatics","animalHandling","athletics","history","insight","intimidation","perception","survival"],2,{armor:["all","shields"],weapons:["simple","martial"],savingThrows:["strength","constitution"],features:[feature("fighting-style","Stile di Combattimento"),feature("second-wind","Second Wind")]},[choice("class:fighter:fighting-style","fightingStyle",1,["archery","defense","dueling","greatWeaponFighting","protection","twoWeaponFighting"]),equipment("class:fighter:primary",[["chainMail"],["leatherArmor","longbow","20Arrows"]]),equipment("class:fighter:weapon",[["martialWeapon","shield"],["twoMartialWeapons"]]),equipment("class:fighter:secondary",[["lightCrossbow","20Bolts"],["twoHandaxes"]]),pack("fighter",["dungeoneersPack"],["explorersPack"])]),
  monk:classData("monk",["acrobatics","athletics","history","insight","religion","stealth"],2,{weapons:["simple","shortsword"],savingThrows:["strength","dexterity"],features:[feature("unarmored-defense","Difesa Senza Armatura"),feature("martial-arts","Arti Marziali")]},[equipment("class:monk:weapon",[["shortsword"],["simpleWeapon"]]),pack("monk",["dungeoneersPack"],["explorersPack"]),choice("class:monk:tool","tool",1,[...ARTISAN_TOOLS,...MUSICAL_INSTRUMENTS])]),
  paladin:classData("paladin",["athletics","insight","intimidation","medicine","persuasion","religion"],2,{armor:["all","shields"],weapons:["simple","martial"],savingThrows:["wisdom","charisma"],features:[feature("divine-sense","Senso Divino"),feature("lay-on-hands","Imposizione delle Mani")]},[equipment("class:paladin:primary",[["martialWeapon","shield"],["twoMartialWeapons"]]),equipment("class:paladin:secondary",[["fiveJavelins"],["simpleMeleeWeapon"]]),pack("paladin",["priestsPack"],["explorersPack"])]),
  ranger:classData("ranger",["animalHandling","athletics","insight","investigation","nature","perception","stealth","survival"],3,{armor:["light","medium","shields"],weapons:["simple","martial"],savingThrows:["strength","dexterity"],features:[feature("favored-enemy","Nemico Prescelto"),feature("natural-explorer","Esploratore Naturale")]},[choice("class:ranger:enemy","favoredEnemy",1,["aberrations","beasts","celestials","constructs","dragons","elementals","fey","fiends","giants","monstrosities","oozes","plants","undead","twoHumanoidRaces"]),choice("class:ranger:enemy-language","language",1,allLanguages),choice("class:ranger:terrain","favoredTerrain",1,["arctic","coast","desert","forest","grassland","mountain","swamp","underdark"]),equipment("class:ranger:armor",[["scaleMail"],["leatherArmor"]]),equipment("class:ranger:weapon",[["twoShortswords"],["twoSimpleMeleeWeapons"]]),pack("ranger",["dungeoneersPack"],["explorersPack"])]),
  rogue:classData("rogue",["acrobatics","athletics","deception","insight","intimidation","investigation","perception","performance","persuasion","sleightOfHand","stealth"],4,{armor:["light"],weapons:["simple","handCrossbow","longsword","rapier","shortsword"],tools:["thievesTools"],savingThrows:["dexterity","intelligence"],features:[feature("expertise","Competenza"),feature("sneak-attack","Attacco Furtivo"),feature("thieves-cant","Gergo Ladresco")]},[equipment("class:rogue:weapon",[["rapier"],["shortsword"]]),equipment("class:rogue:secondary",[["shortbow","20Arrows"],["shortsword"]]),pack("rogue",["burglarsPack"],["dungeoneersPack"],["explorersPack"]),choice("class:rogue:expertise","expertise",2,[],{optionsSource:{type:"selected-skills-and-thieves-tools"}})]),
  sorcerer:classData("sorcerer",["arcana","deception","insight","intimidation","persuasion","religion"],2,{weapons:["dagger","dart","sling","quarterstaff","lightCrossbow"],savingThrows:["constitution","charisma"],features:[feature("spellcasting","Incantesimi"),feature("sorcerous-origin","Origine Stregonesca")]},[equipment("class:sorcerer:weapon",[["lightCrossbow","20Bolts"],["simpleWeapon"]]),equipment("class:sorcerer:secondary",[["componentPouch"],["arcaneFocus"]]),pack("sorcerer",["dungeoneersPack"],["explorersPack"]),choice("class:sorcerer:cantrips","cantrip",4,[],{optionsSource:{type:"legacy-spell-list",classKey:"stregone",level:0}}),choice("class:sorcerer:spells","spell",2,[],{optionsSource:{type:"legacy-spell-list",classKey:"stregone",level:1}}),choice("class:sorcerer:origin","subclass",1,["draconic-bloodline","wild-magic"])],{ability:"charisma",knownCantrips:4,knownSpells:2,slots:[2]}),
  warlock:classData("warlock",["arcana","deception","history","intimidation","investigation","nature","religion"],2,{armor:["light"],weapons:["simple"],savingThrows:["wisdom","charisma"],features:[feature("otherworldly-patron","Patrono Ultraterreno"),feature("pact-magic","Magia del Patto")]},[equipment("class:warlock:weapon",[["lightCrossbow","20Bolts"],["simpleWeapon"]]),equipment("class:warlock:focus",[["componentPouch"],["arcaneFocus"]]),pack("warlock",["scholarsPack"],["dungeoneersPack"]),choice("class:warlock:cantrips","cantrip",2,[],{optionsSource:{type:"legacy-spell-list",classKey:"warlock",level:0}}),choice("class:warlock:patron","subclass",1,["the-archfey","the-fiend","the-great-old-one"]),choice("class:warlock:spells","spell",2,[],{optionsSource:{type:"legacy-spell-list",classKey:"warlock",level:1}})],{ability:"charisma",knownCantrips:2,knownSpells:2,pactSlots:{count:1,level:1}}),
  wizard:classData("wizard",["arcana","history","insight","investigation","medicine","religion"],2,{weapons:["dagger","dart","sling","quarterstaff","lightCrossbow"],savingThrows:["intelligence","wisdom"],features:[feature("spellcasting","Incantesimi"),feature("arcane-recovery","Recupero Arcano")]},[equipment("class:wizard:weapon",[["quarterstaff"],["dagger"]]),equipment("class:wizard:focus",[["componentPouch"],["arcaneFocus"]]),pack("wizard",["scholarsPack"],["explorersPack"]),choice("class:wizard:cantrips","cantrip",3,[],{optionsSource:{type:"legacy-spell-list",classKey:"mago",level:0}}),choice("class:wizard:spellbook","spell",6,[],{optionsSource:{type:"legacy-spell-list",classKey:"mago",level:1}}),choice("class:wizard:prepared-spells","preparedSpell",null,[],{optionsSource:{type:"selected-spellbook"},formula:"intelligenceModifier + 1, minimum 1"})],{ability:"intelligence",knownCantrips:3,preparedFormula:"intelligenceModifier + level",slots:[2]})
});

const BACKGROUND_PRIVILEGE_DESCRIPTIONS = Object.freeze({
  acolyte:"Può ricevere cure gratuite e sostegno modesto nei templi e santuari della sua fede.",
  charlatan:"Ha una seconda identità con documenti, conoscenze e travestimenti a sostegno.",
  criminal:"Ha un contatto affidabile nella rete criminale per far arrivare messaggi e informazioni.",
  entertainer:"Trova esibizioni in luoghi adatti e riceve vitto e alloggio modesti in cambio.",
  folkHero:"La gente comune offre riparo, vitto modesto e protezione entro i propri mezzi.",
  guildArtisan:"La gilda offre contatti, alloggio e sostegno secondo le sue regole e quote.",
  guildMerchant:"La gilda offre contatti commerciali, alloggio e sostegno secondo le sue regole e quote.",
  hermit:"Ha fatto una scoperta significativa concordata con il DM.",
  noble:"È accolto nell'alta società e può ottenere udienza da altri nobili.",
  knight:"Tre servitori leali accompagnano il cavaliere nei limiti del privilegio del manuale.",
  outlander:"Ricorda mappe e geografia e può trovare cibo e acqua per sé e compagni in terre selvagge.",
  sage:"Se non conosce un'informazione, sa dove o da chi potrebbe cercarla.",
  sailor:"Può ottenere un passaggio gratuito su una nave per sé e il gruppo, prestando servizio a bordo.",
  pirate:"La sua cattiva reputazione scoraggia le persone comuni dal denunciare piccoli reati.",
  soldier:"Il suo grado è riconosciuto dai soldati della sua organizzazione militare.",
  urchin:"Conosce i percorsi segreti della città e viaggia più velocemente con i compagni fuori dal combattimento.",
  spy:"Ha un contatto affidabile nella rete di spionaggio o criminale.",
  gladiator:"Trova esibizioni in luoghi adatti e riceve vitto e alloggio modesti in cambio.",
});
const background = (key,it,skills,tools,languages,privilege,equipmentItems,choices=[]) => Object.freeze({key,label:label(it),source:CHARACTER_CREATION_RULESET,skillProficiencies:skills,toolProficiencies:tools,languages,privilege:feature(`background:${key}`,privilege,BACKGROUND_PRIVILEGE_DESCRIPTIONS[key] ?? null),equipment:equipmentItems,choices});
const BASE_BACKGROUNDS = Object.freeze({
  acolyte:background("acolyte","Accolito",["insight","religion"],[],2,"Rifugio dei Fedeli",["holySymbol","5Incense","vestments","commonClothes","15gp"],[choice("background:acolyte:languages","language",2,allLanguages),equipment("background:acolyte:devotion",[["prayerBook"],["prayerWheel"]])]),
  charlatan:background("charlatan","Ciarlatano",["deception","sleightOfHand"],["disguiseKit","forgeryKit"],0,"Identità Fasulla",["fineClothes","disguiseKit","15gp"],[equipment("background:charlatan:con-tools",[["tenStopperedBottles"],["weightedDice"],["markedCards"],["signetRingOfImaginaryDuke"]])]),
  criminal:background("criminal","Criminale",["deception","stealth"],["thievesTools"],0,"Contatti Criminali",["crowbar","darkCommonClothes","15gp"],[choice("background:criminal:gaming-set","tool",1,["diceSet","dragonchessSet","playingCardSet","threeDragonAnteSet"])]),
  entertainer:background("entertainer","Intrattenitore",["acrobatics","performance"],["disguiseKit"],0,"Popolarità",["musicalInstrument","admirersFavor","costume","15gp"],[choice("background:entertainer:instrument","tool",1,MUSICAL_INSTRUMENTS)]),
  folkHero:background("folkHero","Eroe Popolare",["animalHandling","survival"],["landVehicles"],0,"Ospitalità Rustica",["artisansTools","shovel","ironPot","commonClothes","10gp"],[choice("background:folkHero:tools","tool",1,ARTISAN_TOOLS)]),
  guildArtisan:background("guildArtisan","Artigiano di Gilda",["insight","persuasion"],[],1,"Appartenenza a una Gilda",["artisansTools","guildLetter","travelerClothes","15gp"],[choice("background:guildArtisan:tools","tool",1,ARTISAN_TOOLS),choice("background:guildArtisan:language","language",1,allLanguages)]),
  hermit:background("hermit","Eremita",["medicine","religion"],["herbalismKit"],1,"Scoperta",["scrollCase","winterBlanket","commonClothes","herbalismKit","5gp"],[choice("background:hermit:language","language",1,allLanguages)]),
  noble:background("noble", "Nobile",["history","persuasion"],[],1,"Posizione Privilegiata",["fineClothes","signetRing","pedigreeScroll","25gp"],[choice("background:noble:gaming-set","tool",1,["diceSet","dragonchessSet","playingCardSet","threeDragonAnteSet"]),choice("background:noble:language","language",1,allLanguages),choice("background:noble:privilege","backgroundPrivilege",1,[{key:"privilegedPosition",label:label("Posizione Privilegiata")},{key:"retainers",label:label("Servitù")}])]),
  outlander:background("outlander","Forestiero",["athletics","survival"],[],1,"Vagabondo",["staff","huntingTrap","trophy","travelerClothes","10gp"],[choice("background:outlander:instrument","tool",1,MUSICAL_INSTRUMENTS),choice("background:outlander:language","language",1,allLanguages)]),
  sage:background("sage","Sapiente",["arcana","history"],[],2,"Ricercatore",["inkBottle","quill","smallKnife","letterFromDeadColleague","commonClothes","10gp"],[choice("background:sage:languages","language",2,allLanguages)]),
  sailor:{...background("sailor","Marinaio",["athletics","perception"],["navigatorsTools","waterVehicles"],0,"Passaggio in Nave",["belayingPin","50SilkRope","commonClothes","10gp"],[equipment("background:sailor:lucky-charm",[["silkRopeBracelet"],["seagullFeather"],["smallStoneFromDistantLand"],["smallVialOfSeaWater"]]),choice("background:sailor:privilege","backgroundPrivilege",1,[{key:"passageOnShip",label:label("Passaggio Via Nave")},{key:"badReputation",label:label("Pessima Fama")}])]),optionalPrivilege:feature("background:sailor:bad-reputation","Pessima Fama",BACKGROUND_PRIVILEGE_DESCRIPTIONS.pirate)},
  soldier:background("soldier","Soldato",["athletics","intimidation"],["landVehicles"],0,"Grado Militare",["insigniaOfRank","boneDiceOrDeckCards","commonClothes","10gp"],[choice("background:soldier:gaming-set","tool",1,["diceSet","dragonchessSet","playingCardSet","threeDragonAnteSet"]),equipment("background:soldier:trophy",[["daggerTakenFromFallenEnemy"],["pieceOfBrokenBanner"],["bulletOrArrow"],["stripOfCloth"]])]),
  urchin:background("urchin","Monello",["sleightOfHand","stealth"],["disguiseKit","thievesTools"],0,"Segreti della Città",["smallKnife","cityMap","petMouse","parentsToken","commonClothes","10gp"])
});
export const BACKGROUNDS = Object.freeze({ ...BASE_BACKGROUNDS,
  guildMerchant: background("guildMerchant","Mercante di Gilda",["insight","persuasion"],[],0,"Appartenenza a una Gilda",["guildLetter","travelerClothes","15gp"],[choice("background:guildMerchant:language","language",1,allLanguages),choice("background:guildMerchant:proficiency","toolOrLanguage",1,[...ARTISAN_TOOLS,"navigatorsTools",...allLanguages]),equipment("background:guildMerchant:equipment",[["artisansTools"],["mule","cart"]])]),
  spy: background("spy","Spia",["deception","stealth"],["thievesTools"],0,"Contatti Criminali",["crowbar","darkCommonClothes","15gp"],[choice("background:spy:gaming-set","tool",1,["diceSet","dragonchessSet","playingCardSet","threeDragonAnteSet"])]),
  gladiator: background("gladiator","Gladiatore",["acrobatics","performance"],["disguiseKit"],0,"Popolarità",["admirersFavor","costume","15gp"],[choice("background:gladiator:instrument","tool",1,MUSICAL_INSTRUMENTS),equipment("background:gladiator:performance-item",[["musicalInstrument"],["inexpensiveUnusualWeapon"]])]),
  pirate: {...background("pirate","Pirata",["athletics","perception"],["navigatorsTools","waterVehicles"],0,"Passaggio in Nave",["belayingPin","50SilkRope","commonClothes","10gp"],[equipment("background:pirate:lucky-charm",[["silkRopeBracelet"],["seagullFeather"],["smallStoneFromDistantLand"],["smallVialOfSeaWater"]]),choice("background:pirate:privilege","backgroundPrivilege",1,[{key:"passageOnShip",label:label("Passaggio Via Nave")},{key:"badReputation",label:label("Pessima Fama")}])]),optionalPrivilege:feature("background:pirate:bad-reputation","Pessima Fama",BACKGROUND_PRIVILEGE_DESCRIPTIONS.pirate)},
  knight: background("knight","Cavaliere",["history","persuasion"],[],1,"Servitù",["fineClothes","signetRing","pedigreeScroll","25gp"],[choice("background:knight:gaming-set","tool",1,["diceSet","dragonchessSet","playingCardSet","threeDragonAnteSet"]),choice("background:knight:language","language",1,allLanguages)]),
});

function optionLabel(value, kind) { if (typeof value === "object") return value; const catalogs={skill:SKILLS,language:LANGUAGES,tool:{...TOOLS,...ARTISAN_TOOL_LABELS,...ADDITIONAL_EQUIPMENT_LABELS},feat:FEATS,equipment:EQUIPMENT,equipmentItem:{...EQUIPMENT,...WEAPON_LABELS,...ADDITIONAL_EQUIPMENT_LABELS,...ARTISAN_TOOL_LABELS},weapon:{...EQUIPMENT,...WEAPON_LABELS},maneuver:FEAT_MANEUVERS,fightingStyle:FIGHTING_STYLE_LABELS,favoredTerrain:FAVORED_TERRAIN_LABELS,favoredEnemy:FAVORED_ENEMY_LABELS,humanoidRace:HUMANOID_RACES,draconicAncestry:DRACONIC_ANCESTRY_LABELS,spellClass:{bard:"Bardo",cleric:"Chierico",druid:"Druido",sorcerer:"Stregone",warlock:"Warlock",wizard:"Mago"},damageType:{acid:"Acido",cold:"Freddo",lightning:"Fulmine",fire:"Fuoco",thunder:"Tuono"}}; const fallback=String(value).replace(/([a-z])([A-Z])/g,"$1 $2").replace(/(^|\s)\S/g,(part)=>part.toUpperCase()); return {key:value,label:label(kind === "subclass" ? SUBCLASS_RULES[value]?.labels?.it ?? fallback : catalogs[kind]?.[value] ?? EQUIPMENT[value] ?? BACKGROUND_EQUIPMENT_LABELS[value] ?? TOOLS[value] ?? LANGUAGES[value] ?? SKILLS[value] ?? fallback)}; }
function spellOptions(source) { const list=SPELL_CHOICE_CATALOG[source.classKey] ?? []; return list.filter((spell)=>spell.level===source.level).map((spell)=>({key:spell.name,label:label(spell.label ?? spell.name)})); }
function cloneChoice(slot, owner) { const source=slot.optionsSource; const raw=slot.options.length ? slot.options : source?.type==="legacy-spell-list" ? spellOptions(source) : source?.type==="wizard-spell-list" ? spellOptions({classKey:"mago",level:0}) : source?.type==="phb-feat" ? Object.keys(FEATS) : []; return { ...slot, owner, options:raw.map((value)=>optionLabel(value,slot.kind)) }; }
function selected(input, id) { const value=input?.selections?.[id]; return Array.isArray(value) ? value.filter((item) => typeof item === "string") : typeof value === "string" ? [value] : []; }
function addIssue(issues,path,code,message,meta) { issues.push({path,code,message,...(meta ? {meta}: {})}); }
function checkFeatPrerequisite(issues, path, featKey, finalAbilities, raceData, subrace, classData, domain) {
  const prerequisite = FEAT_PREREQUISITES[featKey];
  if (!prerequisite) return;
  for (const [ability, minimum] of Object.entries(prerequisite)) {
    if (ABILITY_KEYS.includes(ability) && finalAbilities[ability] < minimum) {
      addIssue(issues, path, "feat_prerequisite", "Il talento non soddisfa il prerequisito di caratteristica.", { featKey, ability, minimum });
    }
  }
  if (prerequisite.intelligenceOrWisdom && Math.max(finalAbilities.intelligence, finalAbilities.wisdom) < prerequisite.intelligenceOrWisdom) {
    addIssue(issues, path, "feat_prerequisite", "Incantatore Rituale richiede Intelligenza o Saggezza 13.", { featKey });
  }
  const armor = new Set([...(raceData.armorProficiencies ?? []), ...(subrace?.armorProficiencies ?? []), ...(classData.fixed.armor ?? []), ...(domain?.armor ?? [])]);
  if (prerequisite.armor && !armor.has("all") && !armor.has(prerequisite.armor)) {
    addIssue(issues, path, "feat_prerequisite", "Il talento richiede la competenza nell'armatura indicata.", { featKey, armor: prerequisite.armor });
  }
  const racialSpell = ["cantrip", "drow-magic", "infernal-legacy", "natural-illusionist"].some((key) => [...(raceData.features ?? []), ...(subrace?.features ?? [])].some((feature) => feature.key === key));
  if (prerequisite.spellcasting && !classData.spellcasting && !racialSpell) {
    addIssue(issues, path, "feat_prerequisite", "Il talento richiede la capacità di lanciare almeno un incantesimo.", { featKey });
  }
}
function sumBonuses(...maps) { return maps.reduce((total,map)=>{ for(const [key,value] of Object.entries(map ?? {})) total[key]=(total[key]??0)+value; return total; },{}); }
function choiceSlots(raceData, subrace, classData, background, input = {}) {
  const domain = classData.key === "cleric" ? CLERIC_DOMAINS[selected(input, "class:cleric:domain")[0]] : null;
  const origin = selected(input, "class:sorcerer:origin")[0];
  const featKey = selected(input, "race:variant-human:feat")[0];
  const rangerEnemy = selected(input, "class:ranger:enemy")[0];
  const subclassChoices = origin === "draconic-bloodline"
    ? [choice("class:sorcerer:dragon-ancestor", "draconicAncestry", 1, ["black", "blue", "brass", "bronze", "copper", "gold", "green", "red", "silver", "white"])]
    : [];
  const slots = [
    ...(raceData.choices ?? []).map((item) => cloneChoice(item, "race")),
    ...(subrace?.choices ?? []).map((item) => cloneChoice(item, "subrace")),
    cloneChoice(classData.skills, "class"),
    ...(classData.choices ?? []).filter((item) => !["class:barbarian:pack", "class:druid:pack"].includes(item.id) && !(item.id === "class:ranger:enemy-language" && ["beasts", "oozes", "plants"].includes(rangerEnemy))).map((item) => cloneChoice(item, "class")),
    ...(CLASS_EXTRA_EQUIPMENT[classData.key] ?? []).map((item) => cloneChoice(item, "class")),
    ...(domain?.choices ?? []).map((item) => cloneChoice(item, "classDomain")),
    ...subclassChoices.map((item) => cloneChoice(item, "classSubclass")),
    ...(rangerEnemy === "twoHumanoidRaces" ? [cloneChoice(choice("class:ranger:humanoid-races", "humanoidRace", 2, Object.keys(HUMANOID_RACES)), "class")] : []),
    ...featChoiceSlots(featKey, input).map((item) => cloneChoice(item, "feat")),
    ...(background.choices ?? []).map((item) => cloneChoice(item, "background")),
  ];
  for (const [placeholder, id, options, title] of [["musicalInstrument", "owned-instrument", MUSICAL_INSTRUMENTS, "Strumento musicale posseduto"], ["artisansTools", "owned-tool", ARTISAN_TOOLS, "Strumento da artigiano posseduto"]]) {
    if (background.equipment?.includes(placeholder)) slots.push({ ...cloneChoice(choice(`background:${background.key}:${id}`, "equipmentItem", 1, options), "background"), label: label(title) });
  }
  const classNames = { barbarian:"Barbaro", bard:"Bardo", cleric:"Chierico", druid:"Druido", fighter:"Guerriero", monk:"Monaco", paladin:"Paladino", ranger:"Ranger", rogue:"Ladro", sorcerer:"Stregone", warlock:"Warlock", wizard:"Mago" };
  const fixedGrants = [
    { source: raceData.label?.it ?? "Razza", skills: raceData.skillProficiencies ?? [], tools: raceData.toolProficiencies ?? [] },
    ...(subrace ? [{ source: subrace.label?.it ?? "Sottorazza", skills: subrace.skillProficiencies ?? [], tools: subrace.toolProficiencies ?? [] }] : []),
    { source: classNames[classData.key] ?? classData.key, skills: [], tools: classData.fixed.tools ?? [] },
    { source: background.label?.it ?? "Background", skills: background.skillProficiencies ?? [], tools: background.toolProficiencies ?? [] },
  ];
  const fixedSkills = fixedGrants.flatMap((grant) => grant.skills);
  const fixedTools = fixedGrants.flatMap((grant) => grant.tools);
  const replacementSkills = fixedSkills.length - new Set(fixedSkills).size;
  const replacementTools = fixedTools.length - new Set(fixedTools).size;
  const conflictsFor = (kind) => {
    const sourcesByKey = new Map();
    for (const grant of fixedGrants) for (const key of grant[kind]) {
      sourcesByKey.set(key, [...(sourcesByKey.get(key) ?? []), grant.source]);
    }
    return [...sourcesByKey].filter(([, sources]) => sources.length > 1).map(([key, sources]) => ({
      name: optionLabel(key, kind === "skills" ? "skill" : "tool").label.it,
      sources,
    }));
  };
  if (replacementSkills) slots.push({ ...cloneChoice(choice("replacement:skills", "skill", replacementSkills, allSkills, { excludedOptions: [...new Set(fixedSkills)] }), "replacement"), label: label("Scegli un'abilità alternativa"), conflicts: conflictsFor("skills") });
  if (replacementTools) slots.push({ ...cloneChoice(choice("replacement:tools", "tool", replacementTools, SPECIFIC_TOOLS, { excludedOptions: [...new Set(fixedTools)] }), "replacement"), label: label("Scegli uno strumento alternativo"), conflicts: conflictsFor("tools") });
  for (const slot of [...slots].filter((item) => item.kind === "equipment")) {
    for (const selection of [...new Set(selected(input, slot.id))]) {
      const items = slot.options.find((option) => option.key === selection)?.items ?? [];
      items.forEach((item, index) => {
        const generic = GENERIC_EQUIPMENT[item];
        if (generic && !slots.some((item) => item.id === `${slot.id}:detail:${index}`)) slots.push({
          ...cloneChoice(choice(`${slot.id}:detail:${index}`, "equipmentItem", generic.count, generic.options, { distinct: false }), slot.owner),
          label: label(`Scegli ${generic.count} oggetto/i della dotazione`),
        });
      });
    }
  }
  const bonus = sumBonuses(raceData.abilityBonuses, subrace?.abilityBonuses, FEAT_FIXED_BONUSES[featKey]);
  for (const slot of slots.filter((item) => item.kind === "ability")) {
    for (const ability of selected(input, slot.id)) bonus[ability] = (bonus[ability] ?? 0) + 1;
  }
  const ability = classData.spellcasting?.ability;
  const baseScore = input.abilityScores?.[ability];
  const preparedCount = Math.max(1, Math.floor(((Number.isInteger(baseScore) ? baseScore : 10) + (bonus[ability] ?? 0) - 10) / 2) + 1);
  return slots.map((slot) => {
    if (slot.id === "class:warlock:spells") {
      const patron = selected(input, "class:warlock:patron")[0];
      const extraNames = catalogEntry(WARLOCK_PATRON_SPELLS_LEVEL_ONE, patron) ?? [];
      const existing = new Set(slot.options.map((option) => option.key));
      const expanded = extraNames.filter((name) => !existing.has(name)).map((name) => ({key:name,label:label(`${name} (Patrono)`)}));
      return { ...slot, options: [...slot.options, ...expanded] };
    }
    if (slot.id === "class:cleric:armor" && ![...(raceData.armorProficiencies??[]),...(subrace?.armorProficiencies??[]),...(classData.fixed.armor??[]),...(domain?.armor??[])].some((value)=>value === "heavy" || value === "all")) {
      return { ...slot, excludedOptions: ["class:cleric:armor:3"] };
    }
    if (slot.id === "class:cleric:weapon" && ![...(raceData.weaponProficiencies??[]),...(subrace?.weaponProficiencies??[]),...(classData.fixed.weapons??[]),...(domain?.weapons??[])].some((value)=>value === "martial" || value === "warhammer")) {
      return { ...slot, excludedOptions: ["class:cleric:weapon:2"] };
    }
    if (slot.optionsSource?.type === "selected-spellbook") {
      const bookOptions = slots.find((item) => item.id === "class:wizard:spellbook")?.options ?? [];
      const eligibleIds = new Set(bookOptions.map((option) => resolvePhbSpell(option.key)?.id).filter(Boolean));
      const seen = new Set();
      const preparedOptions = selected(input, "class:wizard:spellbook").flatMap((name) => {
        const spell = resolvePhbSpell(name);
        if (!spell || !eligibleIds.has(spell.id) || seen.has(spell.id)) return [];
        seen.add(spell.id);
        return [{ key: name, label: label(spell.label) }];
      });
      return { ...slot, count: preparedCount, options: preparedOptions };
    }
    if (slot.optionsSource?.type === "selected-skills-and-thieves-tools") {
      const chosenSkills = slots.filter((item) => ["skill", "skillOrTool"].includes(item.kind)).flatMap((item) => selected(input, item.id)).filter((key) => Object.hasOwn(SKILLS, key));
      return { ...slot, options: [...new Set([...(raceData.skillProficiencies ?? []), ...(subrace?.skillProficiencies ?? []), ...(background.skillProficiencies ?? []), ...chosenSkills, "thievesTools"])].map((key) => optionLabel(key, key === "thievesTools" ? "tool" : "skill")) };
    }
    if (slot.kind === "preparedSpell") return { ...slot, count: preparedCount };
    return slot;
  });
}

function catalogEntry(catalog, key) {
  return catalog && Object.hasOwn(catalog, key) ? catalog[key] : null;
}

function customBackground(input) {
  if (input?.backgroundKey !== "custom") return null;
  const custom = input?.customBackground;
  const featureSource = catalogEntry(BACKGROUNDS, custom?.featureBackgroundKey);
  const equipmentSource = catalogEntry(BACKGROUNDS, custom?.equipmentBackgroundKey);
  if (!featureSource || !equipmentSource) return null;
  const name = typeof custom?.name === "string" ? custom.name.trim() : "";
  if (!name || name.length > 120) return null;
  const privilege = featureSource.privilege ?? featureSource.optionalPrivilege;
  if (!privilege) return null;
  return Object.freeze({
    key: "custom", label: label(name), source: CHARACTER_CREATION_RULESET,
    skillProficiencies: [], toolProficiencies: [], languages: 0,
    privilege: feature(`background:custom:${featureSource.key}`, privilege.label.it, privilege.description),
    equipment: equipmentSource.equipment ?? [],
    choices: [
      choice("background:custom:skills", "skill", 2, allSkills),
      choice("background:custom:proficiencies", "toolOrLanguage", 2, [...SPECIFIC_TOOLS, ...allLanguages]),
      ...(equipmentSource.choices ?? []).filter((slot) => ["equipment","equipmentItem"].includes(slot.kind)).map((slot) => ({ ...slot, id: slot.id.replace(/^background:[^:]+:/, "background:custom:equipment:") })),
    ],
    customBackground: { featureBackgroundKey: featureSource.key, equipmentBackgroundKey: equipmentSource.key, backgroundDetails: typeof custom.backgroundDetails === "string" ? custom.backgroundDetails.trim() : "" },
  });
}

function selectedBackground(input) {
  const definition = customBackground(input) ?? catalogEntry(BACKGROUNDS, input?.backgroundKey);
  if (!definition) return null;
  const selectedPrivilege = selected(input, `background:${definition.key}:privilege`)[0];
  if (["sailor", "pirate"].includes(definition.key) && selectedPrivilege === "badReputation") return { ...definition, privilege: definition.optionalPrivilege };
  if (definition.key === "noble" && selectedPrivilege === "retainers") return { ...definition, privilege: feature("background:noble:retainers", "Servitù", "Tre servitori fedeli accompagnano il personaggio: possono essere un attendente, un assistente o messaggero. Sono popolani che possono svolgere compiti ordinari, ma non combattono, non seguono il personaggio in aree evidentemente pericolose e lo abbandonano se vengono spesso messi in pericolo o maltrattati. Il loro sostentamento e la protezione sono responsabilità del personaggio. Questo privilegio sostituisce Posizione Privilegiata.") };
  return definition;
}

// Keep receipt normalization independent from catalog versions and choice requirements.
export function normalizeLevelOneCreationInput(input) {
  const normalized = { ...input, selections: { ...(input?.selections ?? {}) } };
  const narrative = input?.narrative;
  const validText = (value) => typeof value === "string" && value.trim() && value.length <= 500;
  if (narrative && Array.isArray(narrative.personalityTraits) && narrative.personalityTraits.length === 2
    && narrative.personalityTraits.every(validText) && ["ideal", "bond", "flaw"].every((key) => validText(narrative[key]))) {
    normalized.narrative = { personalityTraits: narrative.personalityTraits.map((value) => value.trim()), ideal: narrative.ideal.trim(), bond: narrative.bond.trim(), flaw: narrative.flaw.trim(), ...(typeof narrative.backgroundDetails === "string" && narrative.backgroundDetails.length <= 500 ? { backgroundDetails:narrative.backgroundDetails.trim() } : {}) };
  }
  if (typeof input?.customBackground?.backgroundDetails === "string" && input.customBackground.backgroundDetails.length <= 500) {
    normalized.customBackground = { ...input.customBackground, backgroundDetails: input.customBackground.backgroundDetails.trim() };
  }
  return normalized;
}

export function getLevelOneCreationOptions(input = {}) {
  const raceData=catalogEntry(RACES,input.raceKey); const subrace=catalogEntry(raceData?.subraces,input.subraceKey);
  const classData=catalogEntry(LEVEL_ONE_CLASSES,input.classKey); const background=selectedBackground(input);
  return Object.freeze({ ruleset:CHARACTER_CREATION_RULESET, abilities:ABILITY_KEYS, pointBuy:{budget:27,costs:POINT_BUY_COSTS,min:8,max:15}, narrativeFields:GUIDED_NARRATIVE_FIELDS, skills:SKILLS,skillAbilities:SKILL_ABILITIES,languages:LANGUAGES,tools:TOOLS,equipment:EQUIPMENT,feats:FEATS,races:RACES,classes:LEVEL_ONE_CLASSES,backgrounds:BACKGROUNDS, resolved: raceData&&classData&&background ? { race:raceData,subrace,class:classData,background,choiceSlots:choiceSlots(raceData,subrace,classData,background,input) } : null });
}

export function validateLevelOneCreation(input) {
  const issues=[]; const normalizedInput=normalizeLevelOneCreationInput(input);
  const narrative = input?.narrative;
  if (!narrative || typeof narrative !== "object" || Array.isArray(narrative)) {
    addIssue(issues,"narrative","required_narrative","Completa tratti della personalità, ideale, legame e difetto.");
  } else {
    const traits = narrative.personalityTraits;
    if (!Array.isArray(traits) || traits.length !== 2 || traits.some((value) => typeof value !== "string" || !value.trim() || value.length > 500)) {
      addIssue(issues,"narrative.personalityTraits","invalid_personality_traits","Indica due tratti della personalità (massimo 500 caratteri ciascuno).");
    }
    for (const key of ["ideal","bond","flaw"]) {
      if (typeof narrative[key] !== "string" || !narrative[key].trim() || narrative[key].length > 500) {
        addIssue(issues,`narrative.${key}`,"invalid_narrative_field","Completa il campo narrativo (massimo 500 caratteri).");
      }
    }
    if (narrative.backgroundDetails !== undefined && (typeof narrative.backgroundDetails !== "string" || narrative.backgroundDetails.length > 500)) addIssue(issues,"narrative.backgroundDetails","invalid_narrative_field","I dettagli del background devono essere testo di massimo 500 caratteri.");
    if (!issues.some((issue) => issue.path.startsWith("narrative"))) {
      normalizedInput.narrative = { personalityTraits: traits.map((value) => value.trim()), ideal: narrative.ideal.trim(), bond: narrative.bond.trim(), flaw: narrative.flaw.trim(), ...(typeof narrative.backgroundDetails === "string" ? {backgroundDetails:narrative.backgroundDetails.trim()} : {}) };
    }
  }
  const raceData=catalogEntry(RACES,input?.raceKey); const classData=catalogEntry(LEVEL_ONE_CLASSES,input?.classKey); const background=selectedBackground(input);
  if(!raceData) addIssue(issues,"raceKey","unknown_race","Razza non supportata dal catalogo PHB 2014.");
  const subrace=catalogEntry(raceData?.subraces,input?.subraceKey);
  if(raceData?.subraces && !subrace) addIssue(issues,"subraceKey","required_subrace","La razza scelta richiede una sottorazza valida.");
  if(!classData) addIssue(issues,"classKey","unknown_class","Classe non supportata dal catalogo PHB 2014.");
  if(!background) addIssue(issues,input?.backgroundKey === "custom" ? "customBackground" : "backgroundKey","unknown_background","Background non supportato dal catalogo PHB 2014 o configurazione personalizzata non valida.");
  if (input?.backgroundKey === "custom" && input?.customBackground?.backgroundDetails !== undefined && (typeof input.customBackground.backgroundDetails !== "string" || input.customBackground.backgroundDetails.length > 500)) addIssue(issues,"customBackground.backgroundDetails","invalid_background_details","I dettagli del background personalizzato devono essere testo di massimo 500 caratteri.");
  const abilities=input?.abilityScores ?? {}; let total=0;
  for(const key of ABILITY_KEYS) { const score=abilities[key]; if(!Number.isInteger(score)||!(score in POINT_BUY_COSTS)) addIssue(issues,`abilityScores.${key}`,"invalid_point_buy_score","Il point buy consente solo valori interi da 8 a 15."); else total+=POINT_BUY_COSTS[score]; }
  if(total!==27) addIssue(issues,"abilityScores","point_buy_budget","Il point buy deve spendere esattamente 27 punti.",{spent:total,budget:27});
  if(raceData&&classData&&background) {
    const slots=choiceSlots(raceData,subrace,classData,background,input);
    // Compare spell identity through the catalog without rewriting historical snapshot names.
    const rawSelections = input?.selections === undefined ? {} : input.selections;
    const validationSelections = rawSelections && typeof rawSelections === "object" && !Array.isArray(rawSelections)
      ? Object.fromEntries(Object.entries(rawSelections).map(([id, raw]) => {
        const slot = slots.find((item) => item.id === id);
        if (!slot || !["cantrip", "spell", "preparedSpell"].includes(slot.kind)) return [id, raw];
        const canonicalKey = (value) => {
          if (typeof value !== "string") return value;
          const spell = resolvePhbSpell(value);
          return spell ? slot.options.find((option) => resolvePhbSpell(option.key)?.id === spell.id)?.key ?? value : value;
        };
        return [id, Array.isArray(raw) ? raw.map(canonicalKey) : canonicalKey(raw)];
      })) : rawSelections;
    issues.push(...validateRuleSelections(slots, validationSelections));
    const featKey = selected(input,"race:variant-human:feat")[0];
    const racialBonuses=sumBonuses(raceData.abilityBonuses,subrace?.abilityBonuses,FEAT_FIXED_BONUSES[featKey]);
    for(const slot of slots.filter((x)=>x.kind==="ability")) for(const ability of selected(input,slot.id)) racialBonuses[ability]=(racialBonuses[ability]??0)+1;
    const finalAbilities=Object.fromEntries(ABILITY_KEYS.map((key)=>[key,(abilities[key]??0)+(racialBonuses[key]??0)]));
    const beforeFeatBonuses=sumBonuses(raceData.abilityBonuses,subrace?.abilityBonuses);
    for(const slot of slots.filter((x)=>x.kind==="ability" && !x.id.startsWith("feat:"))) for(const ability of selected(input,slot.id)) beforeFeatBonuses[ability]=(beforeFeatBonuses[ability]??0)+1;
    const beforeFeatAbilities=Object.fromEntries(ABILITY_KEYS.map((key)=>[key,(abilities[key]??0)+(beforeFeatBonuses[key]??0)]));
    const eventLanguages = resolveLevelOneEventGrants(classData.key, input?.selections).filter((grant) => grant.kind === "proficiency" && grant.category === "languages").map((grant) => grant.key);
    const already={skill:new Set([...(raceData.skillProficiencies??[]),...(subrace?.skillProficiencies??[]),...(background.skillProficiencies??[])]),language:new Set([...(raceData.languages??[]),...(subrace?.languages??[]),...eventLanguages]),tool:new Set([...(raceData.toolProficiencies??[]),...(subrace?.toolProficiencies??[]),...(classData.fixed.tools??[]),...(background.toolProficiencies??[])] )};
    for(const slot of slots) {
    const values=selected(input,slot.id);
    for(const value of values) {
      if(slot.kind==="feat") checkFeatPrerequisite(issues,`selections.${slot.id}`,value,beforeFeatAbilities,raceData,subrace,classData,CLERIC_DOMAINS[selected(input,"class:cleric:domain")[0]]);
      if (slot.id === "class:cleric:armor" && value === "class:cleric:armor:3") {
        const domain = CLERIC_DOMAINS[selected(input,"class:cleric:domain")[0]];
        const armor = [...(raceData.armorProficiencies??[]),...(subrace?.armorProficiencies??[]),...(classData.fixed.armor??[]),...(domain?.armor??[])];
        if (!armor.includes("heavy") && !armor.includes("all")) addIssue(issues,`selections.${slot.id}`, "equipment_proficiency", "La cotta di maglia richiede competenza nelle armature pesanti.");
      }
      if (slot.id === "class:cleric:weapon" && value === "class:cleric:weapon:2") {
        const domain = CLERIC_DOMAINS[selected(input,"class:cleric:domain")[0]];
        const weapons = [...(raceData.weaponProficiencies??[]),...(subrace?.weaponProficiencies??[]),...(classData.fixed.weapons??[]),...(domain?.weapons??[])];
        if (!weapons.includes("martial") && !weapons.includes("warhammer")) addIssue(issues,`selections.${slot.id}`, "equipment_proficiency", "Il martello da guerra richiede competenza in quest'arma.");
      }
      if(slot.kind==="preparedSpell" && slot.optionsSource?.type==="selected-spellbook" && !selected(input,"class:wizard:spellbook").some((name) => name === value || (resolvePhbSpell(name)?.id && resolvePhbSpell(name)?.id === resolvePhbSpell(value)?.id))) addIssue(issues,`selections.${slot.id}`,"spell_not_in_spellbook","Il mago può preparare solo incantesimi nel suo libro degli incantesimi.",{value});
      const proficiencyKind = slot.kind === "skillOrTool" ? (value in SKILLS ? "skill" : "tool") : slot.kind === "toolOrLanguage" ? (value in LANGUAGES ? "language" : "tool") : slot.kind;
      if(["skill","language","tool"].includes(proficiencyKind)) { const used=already[proficiencyKind]; if(used?.has(value)) addIssue(issues,`selections.${slot.id}`,"duplicate_proficiency","La competenza è già ottenuta da un'altra fonte; scegliere un'alternativa ammessa.",{value}); else used?.add(value); }
    }
  }
  }
  return Object.freeze({ok:issues.length===0,issues:Object.freeze(issues),normalizedInput,resolved:issues.length===0 ? resolve(input,raceData,subrace,classData,background) : null});
}

function resolve(input,raceData,subrace,classData,background) {
  const featKey = selected(input, "race:variant-human:feat")[0];
  const slots=choiceSlots(raceData,subrace,classData,background,input); const racialBonuses=sumBonuses(raceData.abilityBonuses,subrace?.abilityBonuses,FEAT_FIXED_BONUSES[featKey]);
  const domain=classData.key==="cleric" ? CLERIC_DOMAINS[selected(input,"class:cleric:domain")[0]] : null;
  for(const slot of slots.filter((x)=>x.kind==="ability")) for(const ability of selected(input,slot.id)) racialBonuses[ability]=(racialBonuses[ability]??0)+1;
  const finalAbilities=Object.fromEntries(ABILITY_KEYS.map((key)=>[key,(input.abilityScores?.[key]??0)+(racialBonuses[key]??0)]));
  const selectedValues=(kind)=>slots.filter((x)=>x.kind===kind).flatMap((x)=>selected(input,x.id));
  const mixedProficiencies = selectedValues("skillOrTool");
  const mixedToolsOrLanguages = selectedValues("toolOrLanguage");
  const proficiencySkills=[...(raceData.skillProficiencies??[]),...(subrace?.skillProficiencies??[]),...(background.skillProficiencies??[]),...selectedValues("skill"),...mixedProficiencies.filter((key)=>key in SKILLS)];
  const eventLanguages = resolveLevelOneEventGrants(classData.key, input?.selections).filter((grant) => grant.kind === "proficiency" && grant.category === "languages").map((grant) => grant.key);
  const languages=[...(raceData.languages??[]),...(subrace?.languages??[]),...eventLanguages,...selectedValues("language"),...mixedToolsOrLanguages.filter((key)=>key in LANGUAGES)];
  const tools=[...(raceData.toolProficiencies??[]),...(subrace?.toolProficiencies??[]),...(classData.fixed.tools??[]),...(background.toolProficiencies??[]),...selectedValues("tool"),...mixedProficiencies.filter((key)=>!(key in SKILLS)),...mixedToolsOrLanguages.filter((key)=>!(key in LANGUAGES))];
  const equipmentGrants = [];
  const backgroundItems = (background.equipment ?? []).map((item) => {
    if (item === "musicalInstrument") return selected(input, `background:${background.key}:owned-instrument`)[0];
    if (item === "artisansTools") return selected(input, `background:${background.key}:owned-tool`)[0];
    return item;
  });
  const startingGold = backgroundItems.reduce((total, item) => total + (String(item).match(/^(\d+)gp$/)?.[1] ? Number(String(item).match(/^(\d+)gp$/)[1]) : 0), 0);
  for (const key of backgroundItems.filter(item => !/^\d+gp$/.test(String(item)))) equipmentGrants.push({key,source:{kind:"background",key:background.key,label:background.label},acquisition:"fixed"});
  for (const key of CLASS_FIXED_EQUIPMENT[classData.key] ?? []) equipmentGrants.push({key,source:{kind:"class",key:classData.key,label:classData.label},acquisition:"fixed"});
  for (const slot of slots.filter(slot => slot.kind === "equipment" || (slot.kind === "equipmentItem" && !slot.id.includes(":detail:") && !slot.id.endsWith(":owned-instrument") && !slot.id.endsWith(":owned-tool")))) {
    for (const selection of selected(input, slot.id)) {
      const items = slot.options.find(item => item.key === selection)?.items ?? [selection];
      items.forEach((item,index) => {
        const keys = GENERIC_EQUIPMENT[item] ? selected(input, `${slot.id}:detail:${index}`) : [item];
        for (const key of keys) equipmentGrants.push({key,source:{kind:slot.owner === "background" ? "background" : "class",key:slot.owner === "background" ? background.key : classData.key,label:slot.owner === "background" ? background.label : classData.label},choiceId:GENERIC_EQUIPMENT[item] ? `${slot.id}:detail:${index}` : slot.id,acquisition:"chosen"});
      });
    }
  }
  const selectedEquipment = equipmentGrants.filter(item => item.acquisition === "chosen").map(item => item.key);
  const racialArmor = [...(raceData.armorProficiencies??[]), ...(subrace?.armorProficiencies??[])];
  const racialWeapons = [...(raceData.weaponProficiencies??[]), ...(subrace?.weaponProficiencies??[])];
  const featArmor = featKey === "lightlyArmored" ? ["light"] : featKey === "moderatelyArmored" ? ["medium","shields"] : featKey === "heavilyArmored" ? ["heavy"] : [];
  const featWeapons = featKey === "weaponMaster" ? selected(input, "feat:weaponMaster:weapons") : [];
  const featSavingThrows = featKey === "resilient" ? selected(input, "feat:resilient:ability") : [];
  const subclassKey = selected(input, "class:sorcerer:origin")[0] ?? selected(input, "class:warlock:patron")[0];
  const domainKey = selected(input, "class:cleric:domain")[0];
  const domainSpells = CLERIC_DOMAIN_SPELLS_LEVEL_ONE[domainKey] ?? [];
  const featDetails = featKey ? featChoiceSlots(featKey, input).map((slot) => {
    const values = selected(input, slot.id).map((key) => optionLabel(key, slot.kind).label.it);
    return values.length ? `${slot.kind}: ${values.join(", ")}` : null;
  }).filter(Boolean).join("; ") : "";
  const selectedFeatures = [
    ...(FIRST_LEVEL_SUBCLASS_FEATURES[subclassKey] ?? []),
    ...(domainSpells.length ? [feature(`domain-spells:${domainKey}`, "Incantesimi di Dominio", domainSpells.join(", "))] : []),
    ...(featKey ? [feature(`feat:${featKey}`, `Talento: ${FEATS[featKey]}`, featDetails || null)] : []),
    ...selected(input, "class:fighter:fighting-style").map((key) => feature(`fighting-style:${key}`, `Stile di Combattimento: ${optionLabel(key,"fightingStyle").label.it}`)),
    ...selected(input, "class:ranger:enemy").map((key) => feature(`favored-enemy:${key}`, `Nemico Prescelto: ${optionLabel(key,"favoredEnemy").label.it}`)),
    ...selected(input, "class:ranger:humanoid-races").map((key) => feature(`favored-humanoid:${key}`, `Razza umanoide nemica: ${optionLabel(key,"humanoidRace").label.it}`)),
    ...selected(input, "class:ranger:terrain").map((key) => feature(`favored-terrain:${key}`, `Terreno Prescelto: ${optionLabel(key,"favoredTerrain").label.it}`)),
    ...selected(input, "class:sorcerer:dragon-ancestor").map((key) => feature(`dragon-ancestor:${key}`, `Antenato Draconico: ${optionLabel(key,"draconicAncestry").label.it}`)),
    ...selected(input, "race:dragonborn:ancestry").map((key) => feature(`draconic-ancestry:${key}`, `Discendenza Draconica: ${optionLabel(key,"draconicAncestry").label.it}`)),
    ...selected(input, "class:rogue:expertise").map((key) => feature(`expertise:${key}`, `Competenza doppia: ${optionLabel(key,key in SKILLS?"skill":"tool").label.it}`)),
    ...selected(input, "class:cleric:knowledge:skills").map((key) => feature(`knowledge-expertise:${key}`, `Competenza doppia: ${optionLabel(key,"skill").label.it}`)),


  ];
  const selectedBackgroundPrivilege = background.privilege;
  return {abilities:{base:{...input.abilityScores},racialBonuses,final:finalAbilities},narrative:input.narrative,background:{key:background.key,label:background.label,privilege:selectedBackgroundPrivilege,featureBackgroundKey:background.customBackground?.featureBackgroundKey ?? background.key,equipmentBackgroundKey:background.customBackground?.equipmentBackgroundKey ?? background.key,backgroundDetails:background.customBackground?.backgroundDetails || (typeof input.narrative?.backgroundDetails === "string" ? input.narrative.backgroundDetails.trim() : "")},choiceSlots:slots,proficiencies:{skills:[...new Set(proficiencySkills)],languages:[...new Set(languages)],tools:[...new Set(tools)],armor:[...new Set([...(classData.fixed.armor??[]),...(domain?.armor??[]),...racialArmor,...featArmor])],weapons:[...new Set([...(classData.fixed.weapons??[]),...(domain?.weapons??[]),...racialWeapons,...featWeapons])],savingThrows:[...new Set([...(classData.fixed.savingThrows??[]),...featSavingThrows])]},features:[...(raceData.features??[]),...(subrace?.features??[]),...(classData.fixed.features??[]),...(domain?.features??[]),...selectedFeatures,selectedBackgroundPrivilege].filter(Boolean),startingEquipment:{fixed:[...backgroundItems.filter((item)=>!/^\d+gp$/.test(String(item))),...(CLASS_FIXED_EQUIPMENT[classData.key]??[])],chosen:selectedEquipment,grants:equipmentGrants,currency:{gp:startingGold}},spellcasting:classData.spellcasting ? {...classData.spellcasting,domainSpells} : null,choices:Object.fromEntries(slots.map((slot)=>[slot.id,selected(input,slot.id)]))};
}

/** Draft-safe derivation for the wizard. It never returns resolved grants. */
export function resolveLevelOneCreationPreview(input = {}) {
  const validation = validateLevelOneCreation({ ...input, narrative: input.narrative ?? { personalityTraits:["bozza","bozza"], ideal:"bozza", bond:"bozza", flaw:"bozza" } });
  const raceData = catalogEntry(RACES, input.raceKey); const subrace = catalogEntry(raceData?.subraces, input.subraceKey);
  const classData = catalogEntry(LEVEL_ONE_CLASSES, input.classKey); const background = selectedBackground(input);
  if (!raceData || !classData || !background) return Object.freeze({ ok:false, issues:validation.issues, resolved:null });
  const slots = choiceSlots(raceData, subrace, classData, background, input);
  const bonuses = sumBonuses(raceData.abilityBonuses, subrace?.abilityBonuses, FEAT_FIXED_BONUSES[selected(input,"race:variant-human:feat")[0]]);
  for (const slot of slots.filter((slot) => slot.kind === "ability")) for (const key of selected(input, slot.id)) bonuses[key] = (bonuses[key] ?? 0) + 1;
  const abilities = Object.fromEntries(ABILITY_KEYS.map((key) => [key, (Number.isInteger(input.abilityScores?.[key]) ? input.abilityScores[key] : 8) + (bonuses[key] ?? 0)]));
  const previewPrivilege = background.privilege ?? (selected(input, `background:${background.key}:privilege`).length ? background.optionalPrivilege : null);
  return Object.freeze({ ok:validation.ok, issues:validation.issues, resolved:{ background:{key:background.key,label:background.label,privilege:previewPrivilege,featureBackgroundKey:background.customBackground?.featureBackgroundKey ?? background.key,equipmentBackgroundKey:background.customBackground?.equipmentBackgroundKey ?? background.key,backgroundDetails:background.customBackground?.backgroundDetails || (typeof input.narrative?.backgroundDetails === "string" ? input.narrative.backgroundDetails.trim() : "")}, abilities:{base:{...(input.abilityScores ?? {})},racialBonuses:bonuses,final:abilities}, choiceSlots:slots, fixedProficiencies:{skills:[...(raceData.skillProficiencies ?? []),...(subrace?.skillProficiencies ?? []),...(background.skillProficiencies ?? [])],languages:[...(raceData.languages ?? []),...(subrace?.languages ?? [])],tools:[...(raceData.toolProficiencies ?? []),...(subrace?.toolProficiencies ?? []),...(classData.fixed.tools ?? []),...(background.toolProficiencies ?? [])]}} });
}

export function materializeLevelOneCharacter(input) {
  const validation=validateLevelOneCreation(input); if(!validation.ok) return Object.freeze({ok:false,issues:validation.issues});
  const {raceKey,subraceKey,classKey,backgroundKey}=input; const raceData=RACES[raceKey]; const subrace=raceData.subraces?.[subraceKey]??null;
  return Object.freeze({ok:true,identity:{raceKey,subraceKey:subrace?.key??null,classKey,backgroundKey},...validation.resolved,provenance:{ruleset:CHARACTER_CREATION_RULESET,references:["Manuale del Giocatore 5.0, capitoli 2-4"]}});
}
