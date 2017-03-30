var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');
const PMKBClient = require('./lib/pmkbClient');
const async = require('async');
const configs = require('./config/configs');
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
//   appId: process.env.MICROSOFT_APP_ID,
//   appPassword: process.env.MICROSOFT_APP_PASSWORD
  appId: null,
  appPassword: null
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
bot.on('conversationUpdate', (message) => {
    if (message.membersAdded) {
        message.membersAdded.forEach((identity) => {
            if (identity.id === message.address.bot.id) {
                var hello = new builder.Message()
                    .address(message.address)
                    .text(prompts.greetMsg);
                bot.send(hello);
                bot.beginDialog(message.address, '*:/');
            
    }
})}});

bot.dialog('/', [
    (session)=>
    {
        session.send(prompts.helpMsg),
        session.send(prompts.disclaimerMsg)
        session.beginDialog('help');
}]).triggerAction({matches: /(^hello)|(^hi)/i});

bot.dialog('newSearch', [
    function(session){
        builder.Prompts.choice(session, prompts.newSearchMsg, 'Yes|No',  {listStyle:3})
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

        builder.Prompts.choice(session, prompts.menuMsg, 'Gene|Variant|Primary Site|Tumor Type|Exit',  {listStyle:3})
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



bot.dialog('record',[
  function(session){
      builder.Prompts.choice(session, "", "Record")
 
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
      console.log(result.header.lexical);
      console.log('\n');
      var card = createThumbnailCard(session,result.header.lexical);
      var reply = new builder.Message()
        .addAttachment(card);
      session.send(reply)
    });
    }]


).triggerAction({matches:/^thinking/i});

function createThumbnailCard(session, text) {
    return new builder.ThumbnailCard(session)
        .text("You said "+ text + ". Is this correct?")
        
        .buttons([
            builder.CardAction.imBack(session, text, 'Yes'),
            builder.CardAction.imBack(session, "BYE", 'No'),

        ]);
}


