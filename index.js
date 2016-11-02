const Chance = require('chance');
const co = require('co');
const monsters = require('./monsters');
const qauth = require('qauth');
const tracery = require('tracery-grammar');
const tipots = require('this-is-probably-ok-to-say');
const Twitter = require('twitter');
const Wordnik = require('wordnik-as-promised');

const chance = new Chance();
const encounterGrammar = tracery.createGrammar({
    encounter: [
        '#monster.a.capitalize# appears!\n',
        '#Some monster.s# appear!\n',
        '#monster.a.capitalize# attacks!\n',
        'Some #monster.s# attack!\n',
        'You snuck up on #monster.a#!\n',
        'You snuck up on some #monster.s#!\n',
        'Ambushed by #monster.s#!\n'
    ],
    monster: monsters
});
encounterGrammar.addModifiers(tracery.baseEngModifiers);

const wordnik = new Wordnik(process.env.WORDNIK_KEY);

co(function* () {
    const auth = yield qauth.init();
    const words = yield wordnik.randomWords({ includePartOfSpeech: 'verb' });
    const definitions = yield words.filter(word => word).map(word => wordnik.definitions(word.word, { useCanonical: true }));
    const allowed = definitions.filter(
        word => Array.isArray(word) && !word.some(
            def => def.labels.find(l => l.text === 'vulgar') || !tipots(def.text) || !tipots(def.word) || def.word.match(/ing$/) || def.word.match(/ed$/) || def.word.match(/s$/)
        )
    ).map(word => word[0].word);

    const options = [
        chance.pickone(['fight', 'attack']),
        ...chance.shuffle(allowed).slice(0, chance.integer({ min: 2, max: 3 })),
        ...chance.pickone([['item'], ['run'], ['item', 'run']])
    ];
    const selected = chance.integer({ min: 0, max: options.length - 1 });
    const text = encounterGrammar.flatten('#encounter#') +
        options.map((o, i) => (i === selected ? '> ' : '\u2007 ') + o).join('\n').toUpperCase();
    const twitterClient = new Twitter(auth);
    twitterClient.post('statuses/update', { status: text }, (err) => { if (err) { console.error(err); } process.exit(); });
});
