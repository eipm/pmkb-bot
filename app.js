var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');
const PMKBClient = require('./lib/pmkbClient');
const async = require('async');
const configs = require('./config/configs');
const _ = require('underscore');
var fs = require('fs');
var client = require('./lib/client');
// var tts = require('./TTSService.js');  

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

// Executed when conversation starts.
bot.on('conversationUpdate', function (message) {
  if (message.membersAdded) {
    message.membersAdded.forEach(function (identity) {
      if (identity.id === message.address.bot.id) {
        const greeting = new builder.Message()
          .address(message.address)
          .text(prompts.greetMsg);
        bot.send(greeting);
        bot.beginDialog(message.address, '*:disclaimerStart');
      }
    });
  }
});

// Disclaimer message
bot.dialog('disclaimerStart', [
    function (session) {
        var url = "https://pmkb.weill.cornell.edu"
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.markdown)
            .attachments([
                new builder.ThumbnailCard(session)
                    .title("Disclaimer")
                    .subtitle("PMKB Bot")
                    .text(prompts.disclaimerMsg)
                    .images([
                        builder.CardImage.create(session, "http://ipm.weill.cornell.edu/sites/default/files/logo_englander_2line_rgb_comp_1.jpg")
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, url, 'Visit Website')
                    ])
                    .tap(builder.CardAction.openUrl(session, url))
            ]);
            session.send(msg);
        session.beginDialog('getStarted');
   }
]);

// Getting Started Dialog.
bot.dialog('getStarted', [
    function (session) {
        var url = "https://pmkb.weill.cornell.edu"
        var msg = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                    .title("PMKB Bot")
                    .subtitle("Getting Started")
                    .text(prompts.gettingStartedMsg)
                    .images([
                        builder.CardImage.create(session, "https://pbs.twimg.com/profile_banners/759029706360578048/1469801979/1500x500")
                    ])
                    .buttons([
                        builder.CardAction.imBack(session, "examples", 'Show me Examples'),
                        //  builder.CardAction.imBack(session, "record", 'Say it')
                    ])
                    .tap(builder.CardAction.openUrl(session, url))
            ]);
        //    tts.Synthesize('What gene are you looking for?');

        session.endDialog(msg);
    }
]);

// Examples Dialog.
bot.dialog('examples', [
    function (session) {
        var url = "https://pmkb.weill.cornell.edu"
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                new builder.HeroCard(session)
                    .title("PMKB Bot")
                    .subtitle("Examples")
                    .text(prompts.gettingStartedMsg)
                    .images([
                        builder.CardImage.create(session, "https://pbs.twimg.com/profile_banners/759029706360578048/1469801979/1500x500")
                    ])
                    .buttons([
                        builder.CardAction.imBack(session, "examples", 'Show me Examples')
                    ])
                    .tap(builder.CardAction.openUrl(session, url))
            ]);
            
        var exampleCards = getExampleCardsAttachments();
        var reply = new builder.Message(session)
        .text('Examples')
        .attachmentLayout(builder.AttachmentLayout.carousel)
        .attachments(exampleCards);

        session.endDialog(reply);
    }
]).triggerAction({matches:/(^examples)|(^help)/i});

// Disclaimer message
bot.dialog('disclaimer', [
    function (session) {
        var url = "https://pmkb.weill.cornell.edu"
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.markdown)
            .attachments([
                new builder.ThumbnailCard(session)
                    .title("Disclaimer")
                    .subtitle("PMKB Bot")
                    .text(prompts.disclaimerMsg)
                    .images([
                        builder.CardImage.create(session, "http://ipm.weill.cornell.edu/sites/default/files/logo_englander_2line_rgb_comp_1.jpg")
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, url, 'Visit Website')
                    ])
                    .tap(builder.CardAction.openUrl(session, url))
            ]);
        session.endDialog(msg);
    }
]).triggerAction({matches:/^disclaimer/i});

// About Dialog.
bot.dialog('about', [
    function (session) {
        var url = "https://pmkb.weill.cornell.edu"
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                new builder.HeroCard(session)
                    .title("PMKB Bot")
                    .subtitle("About")
                    .text(prompts.gettingStartedMsg)
                    .images([
                        builder.CardImage.create(session, "https://pbs.twimg.com/profile_banners/759029706360578048/1469801979/1500x500")
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, url, 'Visit Website')
                    ])
                    .tap(builder.CardAction.openUrl(session, url))
            ]);
        session.endDialog(msg);
    }
]).triggerAction({matches:/^about/i});

// Exit Dialog.
bot.dialog('exit', [
    function (session) {
        session.endDialog(prompts.exitMsg);
    }
]).triggerAction({matches:/^bye/i});

bot.dialog('test', function (session) {
  pmkbClient.isAlive(function (err, isUp) {
    session.send('PMKB is ' + (isUp ? 'up' : 'down'));
  })
}).triggerAction({matches: /^test pmkb/});

// Exit Dialog.
bot.dialog('whoAmI', [
    function (session) {
        session.endDialog(prompts.whoAmI);
    }
]).triggerAction({matches:/^who are you.*/i});

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

// bot.dialog('startRecording', [
//   function(session){
//     session.send("Recording");
//     const exec = require('child_process').exec;
//     const child = exec('sox -t waveaudio default new.wav trim 0 6',
//           (error, stdout, stderr) => {
//               console.log(`stdout: ${stdout}`);
//               console.log(`stderr: ${stderr}`);
//               if (error !== null) {
//                   console.log(`exec error: ${error}`);
//               }
//               session.beginDialog("thinking");
//     });
//   }
// ]).triggerAction({matches:/(^record)/i});

// bot.dialog('thinking',[
//   function(session){
//     var bing = new client.BingSpeechClient('148c262df6f7418fbcca86479848f61a');
//     var results = '';
//     var wave = fs.readFileSync('./new.wav');

//     const text = bing.recognize(wave).then(result => {
//       console.log('Speech To Text completed');
//       console.log(result.header.lexical);
//       console.log('\n');
//       var card = createThumbnailCard(session,result.header.lexical);
//       var reply = new builder.Message()
//         .addAttachment(card);
//       session.send(reply)
//     });
//     }]
// ).triggerAction({matches:/^thinking/i});

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
  if (!geneName) return callback(new Error(prompts.errorMsg));
  let query = geneName;
  if (mutation) query += ' ' + mutation;
  return callback(null, {
    value: query,
    gene: geneName,
    mutation: mutation
  });
}

function makeInterpretationCards(interpretations, session, mainGene, callback) {
  const interpretationUrlBase = "https://pmkb.weill.cornell.edu" + '/therapies/';
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
        // builder.CardImage.create(session, __dirname + "\\assets\\cards\\" + randomIntInc(1, 6) + ".png")
        builder.CardImage.create(session, "https://www.dropbox.com/s/3t56ozrs1kjvjvf/" + randomIntInc(1, 6) + ".png")
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

function getExampleCardsAttachments(session) {
    return [
        new builder.HeroCard(session)
            .title('Find EGFR')
            .images([
                builder.CardImage.create(session, __dirname + "\\assets\\cards\\" + randomIntInc(1,6)+".png")
            ])
            .buttons([
                builder.CardAction.imBack(session, "Find EGFR", 'Try It')
            ]),

        new builder.HeroCard(session)
            .title('Find BRAF V600E')
            .images([
                builder.CardImage.create(session, __dirname + "\\assets\\cards\\" + randomIntInc(1,6)+".png")
            ])
            .buttons([
                builder.CardAction.imBack(session, "Find BRAF V600E", 'Try It')
            ]),

        new builder.HeroCard(session)
            .title('Find prostate cancer')
            .images([
                builder.CardImage.create(session, __dirname + "\\assets\\cards\\" + randomIntInc(1,6)+".png")
            ])
            .buttons([
                builder.CardAction.imBack(session, "Find prostate cancer", 'Try It')
            ]),

        new builder.HeroCard(session)
            .title('Find BRAF')
            .images([
                builder.CardImage.create(session, __dirname + "\\assets\\cards\\" + randomIntInc(1,6)+".png")
            ])
            .buttons([
                builder.CardAction.imBack(session, "Find BRAF", 'Try It')
            ])
    ];
}

// function createThumbnailCard(session, text) {
//     return new builder.ThumbnailCard(session)
//         .text("You said "+ text + ". Is that correct?")
//         .buttons([
//             builder.CardAction.imBack(session, text, 'Yes'),
//             // builder.CardAction.imBack(session, "record", 'Record again'),
//             builder.CardAction.imBack(session, "bye", 'No'),
//         ]);
// }