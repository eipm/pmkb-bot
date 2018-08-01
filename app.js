var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');
const PMKBClient = require('./lib/pmkbClient');
const async = require('async');
const _ = require('underscore');
var handlebars = require('node-handlebars');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

//=========================================================
// Bot Setup
//=========================================================

var host = process.env.HOST;
var pmkb_host = process.env.PMKB_HOST;

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

var bot = new builder.UniversalBot(connector).set('storage', new builder.MemoryBotStorage());
server.post('/api/messages', connector.listen());

// Configure LUIS recognizer. ENV variables are stored in Azure.
var recognizer = new builder.LuisRecognizer(process.env.LUIS_URL);
bot.recognizer(recognizer);

// Configure PMKB Client. ENV variables are stored in Azure.
const pmkbClient = new PMKBClient(pmkb_host, process.env.PMKB_USER, process.env.PMKB_PASS);
var path = __dirname + '/views';
var views = handlebars.create({partialsDir: path});

server.get(/\/assets\/?.*/, restify.serveStatic({
  directory: __dirname
}));

server.get('/index.html', function (req, res) {
  var url = 'https://webchat.botframework.com/api/tokens';
  var botKey = process.env.MICROSOFT_WEB_CHAT_SECRET_KEY;
  var speechKey = process.env.MICROSOFT_SPEECH_API_KEY;
  var botToken = getBotToken(url, botKey);
  views.engine(path + '/index.html', {botToken: botToken, speechKey: speechKey}, function(err, html) {
    if (err) {
      throw err;
    }
    res.end(html);
  });
});

function getBotToken(url, key) {
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.open("GET", url, false); // false for synchronous request'
  xmlHttp.setRequestHeader("Authorization", "BotConnector " + key);
  xmlHttp.send(null);
  return xmlHttp.responseText;
}

//=========================================================
// Bot Dialogs
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

// Hello message
bot.dialog('hello', [
    function (session) {
        session.send(prompts.greetMsg);
        session.beginDialog('disclaimerStart');
    }
]).triggerAction({matches:/(^hello)|(^hi)|(^help)/i});

// Disclaimer message
bot.dialog('disclaimerStart', [
    function (session) {
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.markdown)
            .attachments([
                new builder.ThumbnailCard(session)
                    .title("Disclaimer")
                    .subtitle("PMKB Bot")
                    .text(prompts.disclaimerMsg)
                    .images([
                        builder.CardImage.create(session, host + "/assets/eipm.png")
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, pmkb_host, 'Visit Website')
                    ])
                    .tap(builder.CardAction.openUrl(session, pmkb_host))
            ]);
            session.send(msg);
        session.beginDialog('getStarted');
   }
]);

// Getting Started Dialog.
bot.dialog('getStarted', [
    function (session) {
        var msg = new builder.Message(session)
            .attachments([
                makeHeroCard(session, "PMKB Bot", host + "/assets/pmkb.png", "examples", 'Show Me Examples', pmkb_host, "Getting Started", prompts.gettingStartedMsg)
            ]);
        session.endDialog(msg);
    }
]);

// Examples Dialog.
bot.dialog('examples', [
    function (session) {
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                makeHeroCard(session, "PMKB Bot", host + "/assets/pmkb.png", "examples", 'Show Me Examples', pmkb_host, "Examples", prompts.gettingStartedMsg)
            ]);

        var exampleCards = getExampleCardsAttachments();
        var reply = new builder.Message(session)
        .text('Examples')
        .attachmentLayout(builder.AttachmentLayout.carousel)
        .attachments(exampleCards);

        session.endDialog(reply);
    }
]).triggerAction({matches:/(^examples)/i});

// Disclaimer message
bot.dialog('disclaimer', [
    function (session) {
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.markdown)
            .attachments([
                new builder.ThumbnailCard(session)
                    .title("Disclaimer")
                    .subtitle("PMKB Bot")
                    .text(prompts.disclaimerMsg)
                    .images([
                        builder.CardImage.create(session, host + "/assets/eipm.png")
                    ])
                    .buttons([
                        builder.CardAction.openUrl(session, pmkb_host, 'Visit Website')
                    ])
                    .tap(builder.CardAction.openUrl(session, pmkb_host))
            ]);
        session.endDialog(msg);
    }
]).triggerAction({matches:/^disclaimer/i});

// About Dialog
bot.dialog('about', [
    function (session) {
        var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                makeHeroCard(session, "PMKB Bot", host + "/assets/pmkb.png", pmkb_host, 'Visit Website', pmkb_host, "About", prompts.gettingStartedMsg)
            ]);
        session.endDialog(msg);
    }
]).triggerAction({matches:/^about/i});

// Exit Dialog
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

// Who Are you? Dialog
bot.dialog('whoAmI', [
    function (session) {
        session.endDialog(prompts.whoAmI);
    }
]).triggerAction({matches:/(^who are you.*)|(^what is your name.*)/i});

// Find Gene Dialog
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
        if (query.value == '')
          session.beginDialog('unknown entity');
        makeInterpretationCards(interpretations, session, query, function (err, cards) {
          let reply = new builder.Message(session)
            .text('Found ' + interpretations.length + ' interpretations associated with ' + "\"" + session.message.text + "\"")
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(cards);
          session.endDialog(reply);
        });
      });
    });
  }).triggerAction({matches: "findGene"});

bot.dialog('none', [
  function (session) {
    session.endDialog(prompts.errorMsg);
  }
]).triggerAction({matches: "None"});

bot.dialog('unknown entity', [
 function (session) {
     session.endDialog(prompts.errorMsg);
 }
]);

// List Genes Dialog
bot.dialog('list genes', function (session) {
  pmkbClient.getGenes(function (err, genes) {
    async.map(genes, function (gene, cb) {
      cb(null, gene.name)
    }, function (err, geneNames) {
      session.endDialog(geneNames.join(', '));
    })
  })
}).triggerAction({matches: /^genes/});

//=====================
// Helper functions
//=====================
function makeHeroCard(session, title, imagePath, buttonCardTitle, buttonTitle, link, subtitle, text) {
  if (link === undefined && subtitle === undefined && text === undefined) {
    return new builder.HeroCard(session)
    .title(title)
    .images([
      builder.CardImage.create(session, imagePath)
    ])
    .buttons([
      builder.CardAction.imBack(session, buttonCardTitle, buttonTitle)
    ])
  } else {
    return new builder.HeroCard(session)
    .title(title)
    .subtitle(subtitle)
    .text(text)
    .images([
      builder.CardImage.create(session, imagePath)
    ])
    .buttons([
      builder.CardAction.imBack(session, buttonCardTitle, buttonTitle)
    ])
    .tap(builder.CardAction.openUrl(session, link));
  }
}

function makeRandomStockImagePath() {
  return host + "/assets/cards/" + randomIntInc(1, 6) + ".png";
}

function makeQuery(luisResults, callback) {
  const queryParams = [];
  if (luisResults && luisResults.intent) {
    const entities = luisResults.intent.entities;
    if (entities && entities.length) {
      for (let entity of entities) {
        if (checkEntity(entity)) {
          queryParams.push(entity.resolution.values[0]);
        }
      }
    }
  }

  return callback(null, {
    value: queryParams.join(' ')
  });
}

function checkEntity(entity) {
  return entity && entity.resolution && entity.resolution.values.length;
}

function makeInterpretationCards(interpretations, session, query, callback) {
  const interpretationUrlBase = pmkb_host + '/therapies/';
  let parts = _.partition(interpretations, (i) => i.gene.name === query);
  interpretations = parts[0].concat(parts[1]);  // Place most relevant genes first
  console.log(query);
  const cards = _.map(interpretations, function (i) {
    const interpretationUrl = interpretationUrlBase + i.id;
    const title = 'Interpretation for ' + query.value;
    const getNames = (objs) => _.map(objs, (obj) => obj.name);
    const tumors = getNames(i.tumors).join(", ");
    const tissues = getNames(i.tissues).join(", ");
    const variants = getNames(i.variants).join(", ");
    const subtitle = "Tumors: " + tumors + "<br/><br/>" + "Tissues: " + tissues + "<br/><br/>" + "Variants: " + variants;
    return makeHeroCard(session, title, makeRandomStockImagePath(), interpretationUrl, 'Read more', interpretationUrl, subtitle, i.interpretation);
  });

  total_interpretations = interpretations.length
  max_cards = 10;
  if (interpretations.length > max_cards) {
      reduced_cards = cards.slice(0, max_cards - 1);
      var total_cards = reduced_cards.concat(getReadMoreCard(session, query, total_interpretations))
      callback(null, total_cards);
  }
  else {
    callback(null, cards);
  }
}

function randomIntInc(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

function getExampleCardsAttachments(session) {
    return [
        makeHeroCard(session, 'Tell me more about EGFR.', makeRandomStockImagePath(), "Tell me more about EGFR.", 'Try It'),
        makeHeroCard(session, 'What do you know about BRAF V600E?', makeRandomStockImagePath(), "What do you know about BRAF V600E?", 'Try It'),
        makeHeroCard(session, 'Give me interpretations for EGFR in lung cancer.', makeRandomStockImagePath(), "Give me interpretations for EGFR in lung cancer.", 'Try It'),
        makeHeroCard(session, 'Find BRAF', makeRandomStockImagePath(), "Find BRAF", 'Try It')
    ];
}

function getReadMoreCard(session, query, total_interpretations) {
    return [
        new builder.HeroCard(session)
            .title('Interpretations for ' +  query.value)
            .images([
                builder.CardImage.create(session, host + "/assets/cards/" + randomIntInc(1,6) + ".png")
            ])
            .text("There are " + total_interpretations + " interpretations in total. Please click below to read more", 'Read more')
            .buttons([
                builder.CardAction.openUrl(session, pmkb_host + "/search?utf8=✓&search=" + query.value.replace(" ", "+"), 'Read more')
            ])
            .tap(builder.CardAction.openUrl(session, pmkb_host + "/search?utf8=✓&search=" + query.value.replace(" ", "+")))
    ];
}
