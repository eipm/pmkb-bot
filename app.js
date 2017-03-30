var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');
const PMKBClient = require('./lib/pmkbClient');
const async = require('async');
const configs = require('./config/configs');
const _ = require('underscore');
var fs = require('fs');
var client = require('./lib/client');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat bot
var connector = new builder.ChatConnector({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
  // appId: null,
  // appPassword: null
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

var recognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/40854c2f-ef7d-4b0a-9b8c-2423255f02d0?subscription-key=686d01692e8c47ec87bdc838e7e1a95f');
bot.recognizer(recognizer);

// Config PMKB Client
const pmkbClient = new PMKBClient(process.env.PMKB_HOST, process.env.PMKB_USER, process.env.PMKB_PASS);

//=========================================================
// Bots Dialogs
//=========================================================
bot.on('conversationUpdate', function (message) {
  if (message.membersAdded) {
    message.membersAdded.forEach(function (identity) {
      if (identity.id === message.address.bot.id) {
        const greeting = new builder.Message()
          .address(message.address)
          .text(prompts.greetMsg);
        const help = new builder.Message()
          .address(message.address)
          .text(prompts.helpMsg);
        const disclaimer = new builder.Message()
          .address(message.address)
          .text(prompts.disclaimerMsg);
        bot.send(greeting);
        bot.send(help);
        bot.send(disclaimer);
      }
    });
  }
});

bot.dialog('test', function (session) {
  pmkbClient.isAlive(function (err, isUp) {
    session.send('PMKB is ' + (isUp ? 'up' : 'down'));
  })
}).triggerAction({matches: /^test pmkb/});

bot.dialog('find gene',
  //TODO: Refactor with async waterfall
  function (session, luisResults) {
    session.sendTyping();
    makeQuery(luisResults, function (err, query) {
      if (err)
        return session.endDialog(err.message);
      pmkbClient.searchInterpretations(query.value, function (err, interpretations) {
        if (err)
          return session.send(err.message);
        makeInterpretationCards(interpretations, session, query.gene, function (err, cards) {
          let reply = new builder.Message(session)
            .text('Found ' + interpretations.length + ' interpretations for ' + query.value)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(cards);
          session.endDialog(reply);
        });
      });
    });
  }).triggerAction({matches: "findGene"});

bot.dialog('list genes', function (session) {
  pmkbClient.getGenes(function (err, genes) {
    async.map(genes, function (gene, cb) {
      cb(null, gene.name)
    }, function (err, geneNames) {
      session.endDialog(geneNames.join(', '));
    })
  })
}).triggerAction({matches: /^genes/});

bot.dialog('record',[
  function(session){
        builder.Prompts.choice(session, prompts.menuMsg, 'Record', {liststyle:3});
    },
    function(session, results){
         switch (results.response.index) {
            case 0:
              session.beginDialog('doRecording');
              
        }
    
  }
]).triggerAction({matches: /^record/i});

bot.dialog('doRecording', [
  function(session){
    session.send("Recording");
    const exec = require('child_process').exec;
    const child = exec('sox -t waveaudio default new.wav trim 0 4',
          (error, stdout, stderr) => {
              console.log(`stdout: ${stdout}`);
              console.log(`stderr: ${stderr}`);
              if (error !== null) {
                  console.log(`exec error: ${error}`);
              }
              session.send("IM HEREEEE");
              session.beginDialog("thinking");
    });
   
  }
]);

bot.dialog('thinking',[
  function(session){
    var bing = new client.BingSpeechClient('148c262df6f7418fbcca86479848f61a');
    var results = '';
    var wave = fs.readFileSync('./new.wav');

    const text = bing.recognize(wave).then(result => {
      console.log('Speech To Text completed');
      console.log(result.header.lexical)
      console.log('\n');
      session.send(result.header.lexical)
    });
    }]


).triggerAction({matches:/^thinking/i});

bot.dialog('about', [
    function (session) {

        var result = "BRAF"
        var interpretation = "BRAF is ..."

        function randomIntInc (low, high) {
            return Math.floor(Math.random() * (high - low + 1) + low);
        }
        image = randomIntInc(1,6)
        url = "https://pmkb.weill.cornell.edu"

        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                new builder.HeroCard(session)
                    .title("PMKB Bot")
                    .subtitle("About: " + result + ' ' + image)
                    .text(interpretation)
                    .images([
                        builder.CardImage.create(session, "https://pbs.twimg.com/profile_banners/759029706360578048/1469801979/1500x500")
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, url, 'Read more')
                    ])
                    .tap(builder.CardAction.openUrl(session, url))
            ]);
        session.endDialog(msg);
    }
]).triggerAction({matches:/^about/i});

//=====================
// Helper functions
//=====================

function makeQuery(luisResults, callback) {
  const entities = luisResults.intent.entities;
  const geneNames = _.filter(entities, function (entity) {
    return entity.type === 'Gene';
  });
  const mutations = _.filter(entities, function (entity) {
    return entity.type === 'variant';
  });
  const geneName = geneNames.length && geneNames[0].entity;
  const mutation = mutations.length && mutations[0].entity;
  if (!geneName) return callback(new Error('Cannot make a query for interpretations without a gene name'));
  let query = geneName;
  if (mutation) query += ' ' + mutation;
  return callback(null, {
    value: query,
    gene: geneName,
    mutation: mutation
  });
}

function makeInterpretationCards(interpretations, session, mainGene, callback) {
  const interpretationUrlBase = pmkbClient.host + '/therapies/';
  mainGene = mainGene.toUpperCase();
  let parts = _.partition(interpretations, (i) => i.gene.name === mainGene);
  interpretations = parts[0].concat(parts[1]);  //Place most relevant genes first
  const cards = _.map(interpretations, function (i) {
    const interpretationUrl = interpretationUrlBase + i.id;
    const title = 'Interpretation for ' +  i.gene.name;
    const getNames = (objs) => _.map(objs, (obj) => obj.name);
    const subtitle = 'Tumors({tumors}) Tissues({tissues}) Variants({variants})'
      .replace('{tumors}', getNames(i.tumors))
      .replace('{tissues}', getNames(i.tissues))
      .replace('{variants}', getNames(i.variants));
    return new builder.HeroCard(session)
      .title(title)
      .subtitle(subtitle)
      .text(i.interpretation)
      .images([
        builder.CardImage.create(session, __dirname + "/assets/cards/" + randomIntInc(1, 6) + ".png")
      ])
      .buttons([
        builder.CardAction.openUrl(session, interpretationUrl, 'Read more')
      ])
      .tap(builder.CardAction.openUrl(session, interpretationUrl));
  });
  callback(null, cards);
}

function randomIntInc(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}