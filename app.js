var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');

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
    // appId: process.env.MICROSOFT_APP_ID,
    // appPassword: process.env.MICROSOFT_APP_PASSWORD
    appId: null,
    appPassword: null
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// var recognizer = new builder.LuisRecognizer('');
// bot.recognizer(recognizer);

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('start', function (session) {
    session.send("Hi there!");
    session.beginDialog('help');
}).triggerAction({matches: /^hello/i});

bot.dialog('/', [
    function(session){
        session.send(prompts.helpMessage),
        builder.Prompts.choice(session, prompts.newSearchMessage, "Yes|No")
    }]);

bot.dialog('help', [
    function(session){
        session.send(prompts.helpMessage),
        builder.Prompts.choice(session, prompts.newSearchMessage, "Yes|No")
    },
    function(session, results){
         switch (results.response.index) {
            case 0:
                session.beginDialog('help');
                break;
            case 1:
                session.beginDialog('start');
                break;
            default:
                session.endDialog();
                break;
    }
}]).triggerAction({matches: /^help/i});

