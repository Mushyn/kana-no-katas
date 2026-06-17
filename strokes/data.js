// ── Structure de la grille (lecture droite → gauche) ──
const COLS = [
  { label: 'a', s: ['a','i','u','e','o'] },
  { label: 'k', s: ['ka','ki','ku','ke','ko'] },
  { label: 's', s: ['sa','si','su','se','so'] },
  { label: 't', s: ['ta','ti','tu','te','to'] },
  { label: 'n', s: ['na','ni','nu','ne','no'] },
  { label: 'h', s: ['ha','hi','hu','he','ho'] },
  { label: 'm', s: ['ma','mi','mu','me','mo'] },
  { label: 'y', s: ['ya', null,'yu', null,'yo'] },
  { label: 'r', s: ['ra','ri','ru','re','ro'] },
  { label: 'w', s: ['wa', null, null, null,'wo'] },
  { label: 'n', s: ['n',  null, null, null, null] },
  { label: 'SEP' },
  // ── Dakuten ゛──
  { label: 'g', diacritic: true, s: ['ga','gi','gu','ge','go'] },
  { label: 'z', diacritic: true, s: ['za','zi','zu','ze','zo'] },
  { label: 'd', diacritic: true, s: ['da','di','du','de','do'] },
  { label: 'b', diacritic: true, s: ['ba','bi','bu','be','bo'] },
  { label: 'SEP2' },
  // ── Handakuten ゜──
  { label: 'p', diacritic: true, s: ['pa','pi','pu','pe','po'] },
];

const ROWS_LABELS = ['a','i','u','e','o'];

// ── Tables de caractères ──
const H = {
  a:'あ', i:'い', u:'う', e:'え', o:'お',
  ka:'か', ki:'き', ku:'く', ke:'け', ko:'こ',
  sa:'さ', si:'し', su:'す', se:'せ', so:'そ',
  ta:'た', ti:'ち', tu:'つ', te:'て', to:'と',
  na:'な', ni:'に', nu:'ぬ', ne:'ね', no:'の',
  ha:'は', hi:'ひ', hu:'ふ', he:'へ', ho:'ほ',
  ma:'ま', mi:'み', mu:'む', me:'め', mo:'も',
  ya:'や', yu:'ゆ', yo:'よ',
  ra:'ら', ri:'り', ru:'る', re:'れ', ro:'ろ',
  wa:'わ', wo:'を', n:'ん',
  ga:'が', gi:'ぎ', gu:'ぐ', ge:'げ', go:'ご',
  za:'ざ', zi:'じ', zu:'ず', ze:'ぜ', zo:'ぞ',
  da:'だ', di:'ぢ', du:'づ', de:'で', do:'ど',
  ba:'ば', bi:'び', bu:'ぶ', be:'べ', bo:'ぼ',
  pa:'ぱ', pi:'ぴ', pu:'ぷ', pe:'ぺ', po:'ぽ',
};

const K = {
  a:'ア', i:'イ', u:'ウ', e:'エ', o:'オ',
  ka:'カ', ki:'キ', ku:'ク', ke:'ケ', ko:'コ',
  sa:'サ', si:'シ', su:'ス', se:'セ', so:'ソ',
  ta:'タ', ti:'チ', tu:'ツ', te:'テ', to:'ト',
  na:'ナ', ni:'ニ', nu:'ヌ', ne:'ネ', no:'ノ',
  ha:'ハ', hi:'ヒ', hu:'フ', he:'ヘ', ho:'ホ',
  ma:'マ', mi:'ミ', mu:'ム', me:'メ', mo:'モ',
  ya:'ヤ', yu:'ユ', yo:'ヨ',
  ra:'ラ', ri:'リ', ru:'ル', re:'レ', ro:'ロ',
  wa:'ワ', wo:'ヲ', n:'ン',
  ga:'ガ', gi:'ギ', gu:'グ', ge:'ゲ', go:'ゴ',
  za:'ザ', zi:'ジ', zu:'ズ', ze:'ゼ', zo:'ゾ',
  da:'ダ', di:'ヂ', du:'ヅ', de:'デ', do:'ド',
  ba:'バ', bi:'ビ', bu:'ブ', be:'ベ', bo:'ボ',
  pa:'パ', pi:'ピ', pu:'プ', pe:'ペ', po:'ポ',
};
