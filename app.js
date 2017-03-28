var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');
const PMKBClient = require('./lib/pmkbClient');
const async = require('async');
const configs = require('./config/configs');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(configs.get('APPLICATION_PORT'), function () {
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

var recognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/9b2622c4-2a83-4f33-9fb0-e819ddb5f894?subscription-key=686d01692e8c47ec87bdc838e7e1a95f');
bot.recognizer(recognizer);

// Config PMKB Client
const pmkbClient = new PMKBClient(configs.get('PMKB_HOST'), configs.get('PMKB_USER'), configs.get('PMKB_PASS'));

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', function (session) {
  session.send(prompts.greetMsg);
  session.send(prompts.helpMsg),
  session.send(prompts.disclaimerMsg),
  session.beginDialog('help');
}).triggerAction({matches: /(^hello)|(^hi)/i});

bot.dialog('newSearch', [
    function(session){
        builder.Prompts.choice(session, prompts.newSearchMsg, 'Yes|No')
    },
    function(session, results){
        switch (results.response.index) {
            case 0:
                session.beginDialog('help');
                break;
            case 1:
                session.send(prompts.exitMsg);
                session.endDialog();
                break;
            default:
                session.send(prompts.exitMsg);
                session.endDialog();
                break;
        }
    }]);

bot.dialog('help', [
    function(session){

        builder.Prompts.choice(session, prompts.menuMsg, 'Gene|Variant|Primary Site|Tumor Type|Exit')
    },
    function(session, results){
         switch (results.response.index) {
            case 0:
                session.sendTyping();
                session.beginDialog('find gene');
                break;
            case 1:
                session.sendTyping();
                session.send('Searching Variant...');
                session.beginDialog('newSearch');
                break;
            case 2:
                session.sendTyping();
                session.send('Searching Primary Site ...');
                session.beginDialog('newSearch');
                break;
            case 3:
                session.sendTyping();
                session.send('Searching Tumor Type ...');
                session.beginDialog('newSearch');
                break;
            case 4:
                session.send(prompts.exitMsg);
                session.endDialog();
                break;
            default:
                session.send(prompts.exitMsg);
                session.endDialog();
                break;
    }
}]).triggerAction({matches: /^help/i});

bot.dialog('test', function (session) {
  pmkbClient.isAlive(function (err, isUp) {
    session.send('PMKB is ' + (isUp ? 'up' : 'down'));
  })
}).triggerAction({matches: /^test pmkb/});

bot.dialog('find gene', [
  function (session) {
    builder.Prompts.text(session, 'What gene are you looking for?');
  },
  function (session, results) {
    session.sendTyping();
    const geneName = results.response;
    pmkbClient.getGenes(function (err, genes) {
      async.filter(genes, function (gene, cb) {
        cb(null, gene.name === geneName)  //TODO: match via regex
      }, function (err, res) {
        session.endDialog(res.length && res[0].name || ('Gene ' + geneName + ' does not exist'));
        // TODO: Find all interpretations for this gene
      })
    })
  } 
]).triggerAction({matches: "findGene"});

bot.dialog('list genes', function (session) {
  pmkbClient.getGenes(function (err, genes) {
    async.map(genes, function (gene, cb) {
      cb(null, gene.name)
    }, function (err, geneNames) {
      session.endDialog(geneNames.join(', '));
    })
  })
}).triggerAction({matches: /^genes/});



var record = require('node-record-lpcm16')
var fs = require('fs')

bot.dialog('record',[
  function(session){
        builder.Prompts.choice(session, prompts.menuMsg, 'Record')
    },
    function(session, results){
         switch (results.response.index) {
            case 0:
              async.waterfall([
                function(callback){
                  session.send("Recording");
                  callback(null,null);
                },
                function(arg1, callback){
                  startRecord(session);
                }])
              
        }
  }
]).triggerAction({matches: /^record/i});

function startRecord(session){

  var file = fs.createWriteStream('test.wav', { encoding: 'binary' })

  record.start({verbose: true}).pipe(file)

  // Stop recording after three seconds and write to file
  setTimeout(function () {
    record.stop()
  }, 3000)
}