var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');
const PMKBClient = require('./lib/pmkbClient');
const async = require('async');
const _ = require('underscore');
var handlebars = require('node-handlebars');
var ssml = require('./ssml');
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
                makeHeroCard(session, "PMKB Bot", host + "/assets/pmkb.jpg", "examples", 'Show Me Examples', pmkb_host, "Getting Started", prompts.gettingStartedMsg)
            ])
            .speak(speak(session, prompts.gettingStartedMsg));
        session.endDialog(msg);
    }
]);

// Examples Dialog.
bot.dialog('examples', [
    function (session) {
        const text = "Here are some examples";
        var exampleCards = getExampleCardsAttachments();
        var reply = new builder.Message(session)
          .text(text)
          .attachmentLayout(builder.AttachmentLayout.carousel)
          .attachments(exampleCards)
          .speak(speak(session, text));
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
                makeHeroCard(session, "PMKB Bot", host + "/assets/pmkb.jpg", pmkb_host, 'Visit Website', pmkb_host, "About", prompts.gettingStartedMsg)
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
      var msg = new builder.Message(session)
        .text(prompts.whoAmI)
        .speak(speak(session, prompts.whoAmI));
      session.endDialog(msg);
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
        if (query && query.value && !(query.value === '')) {
          makeInterpretationCards(interpretations, session, query, function (err, cards) {
            const text = `Found ${interpretations.length} interpretations associated with "${session.message.text}"`;
            const reply = new builder.Message(session)
              .text(text)
              .attachmentLayout(builder.AttachmentLayout.carousel)
              .attachments(cards)
              .speak(speak(session, text));
            session.endDialog(reply);
          });
        } else {
          session.beginDialog('unknown entity');
        }
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
function speak(session, prompt) {
    var localized = session.gettext(prompt);
    return ssml.speak(localized);
}

function makeHeroCard(session, title, imagePath, buttonLink, buttonTitle, link, subtitle, text, openUrl) {
    return new builder.HeroCard(session)
      .title(title)
      .subtitle(subtitle)
      .text(text)
      .images([
        builder.CardImage.create(session, imagePath)
      ])
      .buttons([ openUrl
         ? builder.CardAction.openUrl(session, buttonLink, buttonTitle)
         : builder.CardAction.imBack(session, buttonLink, buttonTitle)
      ])
      .tap(builder.CardAction.openUrl(session, link));
}

function makeRandomStockImagePath() {
  return host + "/assets/cards/" + randomIntInc(1, 6) + ".jpg";
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
  let parts = _.partition(interpretations, (i) => query);
  interpretations = parts[0].concat(parts[1]);  // Place most relevant genes first
  const cards = _.map(interpretations, function (i) {
    const interpretationUrl = interpretationUrlBase + i.id;
    const title = 'Interpretation for ' + query.value;
    const getNames = (objs) => _.map(objs, (obj) => obj.name);
    var genes = "";
    if (i.gene && i.gene.name) {
      genes = i.gene.name;
    }
    const tumors = makeListForSubtitle(i.tumors, getNames);
    const tissues = makeListForSubtitle(i.tissues, getNames);
    const variants = makeListForSubtitle(i.variants, getNames);
    const subtitle = `Genes: ${genes}

Tumors: ${tumors}

Tissues: ${tissues}

Variants: ${variants}`;
    return makeHeroCard(session, title, makeRandomStockImagePath(), interpretationUrl, 'Read more', interpretationUrl, subtitle, i.interpretation, 1);
  });

  max_cards = 10;
  if (interpretations.length > max_cards) {
      reduced_cards = cards.slice(0, max_cards - 1);
      var total_cards = reduced_cards.concat(getReadMoreCard(session, query, interpretations.length));
      callback(null, total_cards);
  }
  else {
    callback(null, cards);
  }
}

function makeListForSubtitle(array, getNames) {
  if (array) {
    if (array.length > 10) {
      const leftover = array.length - 10;
      return getNames(array.slice(0, 9)).join(", ") + ", and " + leftover + " others";
     } else {
      return getNames(array).join(", ");
     }
  }
  return '';
}

function randomIntInc(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

function getExampleCardsAttachments(session) {
  return [
    makeHeroCard(session, 'Tell me more about BRCA1.', makeRandomStockImagePath(), "Tell me more about BRCA1.", 'Try It'),
    makeHeroCard(session, 'What do you know about BRAF V600E?', makeRandomStockImagePath(), "What do you know about BRAF V600E?", 'Try It'),
    makeHeroCard(session, 'Give me interpretations for EGFR in lung cancer.', makeRandomStockImagePath(), "Give me interpretations for EGFR in lung cancer.", 'Try It'),
    makeHeroCard(session, 'What do you know about Acute Myeloid Leukemia?', makeRandomStockImagePath(), "What do you know about Acute Myeloid Leukemia?", 'Try It')
  ];
}

function getReadMoreCard(session, query, total_interpretations) {
    const url = pmkb_host + "/search?utf8=✓&search=" + query.value.replace(" ", "+");
    const text = "There are " + total_interpretations + " interpretations in total. Please click below to read more";
    return [
      makeHeroCard(session, `Interpretations for ${query.value}`, makeRandomStockImagePath(), url, 'Read More', url, "", text, 1)
    ];
}
