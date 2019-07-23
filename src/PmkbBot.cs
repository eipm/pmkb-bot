using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.ApplicationInsights;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Dialogs;
using Microsoft.Bot.Builder.Dialogs.Choices;
using Microsoft.Bot.Schema;
using Newtonsoft.Json;
using Pmkb.Bot.Data;


namespace Pmkb.Bot
{
    /// <summary>
    /// This bot will respond to the user's input with rich card content.
    /// Microsoft Bot Framework currently supports eight types of rich cards.
    /// We will demonstrate the use of each of these types in this project.
    /// Not all card types are supported on all channels.
    /// Please view the documentation in the ReadMe.md file in this project for more information.
    /// For each user interaction, an instance of this class is created and the OnTurnAsync method is called.
    /// This is a Transient lifetime service.  Transient lifetime services are created
    /// each time they're requested. For each Activity received, a new instance of this
    /// class is created. Objects that are expensive to construct, or have a lifetime
    /// beyond the single turn, should be carefully managed.
    /// For example, the <see cref="MemoryStorage"/> object and associated
    /// <see cref="IStatePropertyAccessor{T}"/> object are created with a singleton lifetime.
    /// </summary>
    /// <seealso cref="https://docs.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection?view=aspnetcore-2.1"/>
    public class PmkbBot : IBot
    {
        /// <summary>
        /// Key in the bot config (.bot file) for the LUIS instance.
        /// In the .bot file, multiple instances of LUIS can be configured.
        /// </summary>
        public static readonly string LuisKey = "pmkb-luis";
        private static IDictionary<string, string> _examplePromptsDictionary;
        private static IDictionary<string, string> _whoAmIPromptsDictionary;
        private static IDictionary<string, string> _helloPromptsDictionary;

        /// <summary>
        /// Services configured from the ".bot" file.
        /// </summary>
        private readonly BotServices _services;
        private readonly Cards _cards;
        private readonly PmkbApi _pmkbApi;
        private readonly DialogSet _dialogs;
        private readonly BotAccessors _accessors;
        private readonly TelemetryClient _telemetryClient;

        /// <summary>
        /// Initializes a new instance of the <see cref="PmkbBot"/> class.
        /// </summary>
        /// <param name="accessors">A class containing <see cref="IStatePropertyAccessor{T}"/> used to manage state.</param>
        /// <param name="services">The <see cref="BotServices"/> required for LUIS.</param>
        /// <param name="pmkbApi">The <see cref="PmkbApi"/> to request data from.</param>
        public PmkbBot(Cards cards, BotAccessors accessors, BotServices services, PmkbApi pmkbApi, TelemetryClient telemetryClient)
        {
            _cards = cards;
            _accessors = accessors ?? throw new ArgumentNullException(nameof(accessors));
            _services = services ?? throw new ArgumentNullException(nameof(services));
            _pmkbApi = pmkbApi ?? throw new ArgumentNullException(nameof(pmkbApi));
            _telemetryClient = telemetryClient ?? throw new ArgumentNullException(nameof(telemetryClient));

            if (!_services.LuisServices.ContainsKey(LuisKey))
            {
                throw new ArgumentException($"Invalid configuration. Please check your '.bot' file for a LUIS service named '{LuisKey}'.");
            }

            _dialogs = new DialogSet(accessors.ConversationDialogState);
            _dialogs.Add(new WaterfallDialog(Resources.Prompts.Examples, new WaterfallStep[] { ExamplesChoiceCardStepAsync }));
            _dialogs.Add(new ChoicePrompt("cardPrompt"));

        }

        private static IDictionary<string, string> ExamplePromptsDictionary
        {
            get
            {
                if (_examplePromptsDictionary == null)
                {
                    _examplePromptsDictionary = GetDictionaryFromPrompts("ExamplePrompt");
                }

                return _examplePromptsDictionary;
            }
        }

        private static IDictionary<string, string> WhoAmIPromptsDictionary
        {
            get
            {
                if (_whoAmIPromptsDictionary == null)
                {
                    _whoAmIPromptsDictionary = GetDictionaryFromPrompts("WhoAmI");
                }

                return _whoAmIPromptsDictionary;
            }
        }

        private static IDictionary<string,string> HelloPromptsDictionary
        {
            get
            {
                if (_helloPromptsDictionary == null)
                {
                    _helloPromptsDictionary = GetDictionaryFromPrompts("HelloPrompt");
                }

                return _helloPromptsDictionary;
            }
        }

        /// <summary>
        /// Creates a <see cref="IDictionary"/> from <see cref="Resources.Prompts"/> with all the properties that start with <paramref name="startsWithText"/>.
        /// </summary>
        /// <returns>The <see cref="IDictionary"/> from the <see cref="Resources.Prompts"/>.</returns>
        /// <param name="startsWithText">A <see cref="string"/>.</param>
        private static IDictionary<string, string> GetDictionaryFromPrompts(string startsWithText)
        {
            var dictionary = new Dictionary<string, string>();
            typeof(Resources.Prompts).GetProperties(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
                .Where(x => x.Name.StartsWith(startsWithText, StringComparison.OrdinalIgnoreCase))
                .Select(x => dictionary[x.Name] = x.GetValue(null, null).ToString()).ToList();

            return dictionary;
        }

        /// <summary>
        /// Prompts the user for input by sending a <see cref="ChoicePrompt"/> so the user may select their
        /// choice from a list of options.
        /// </summary>
        /// <param name="step">A <see cref="WaterfallStepContext"/> provides context for the current waterfall step.</param>
        /// <param name="cancellationToken">A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        /// <returns>A <see cref="DialogTurnResult"/> to communicate some flow control back to the containing WaterfallDialog.</returns>
        private static async Task<DialogTurnResult> ExamplesChoiceCardStepAsync(WaterfallStepContext step, CancellationToken cancellationToken)
        {
            return await step.PromptAsync("cardPrompt", GenerateExampleOptions(step.Context.Activity), cancellationToken);
        }

        /// <summary>
        /// Creates options for a <see cref="ChoicePrompt"/> so the user may select an option.
        /// </summary>
        /// <param name="activity">The message activity the bot received.</param>
        /// <returns>A <see cref="PromptOptions"/> to be used in a prompt.</returns>
        /// <remarks>Related type <see cref="Choice"/>.</remarks>
        private static PromptOptions GenerateExampleOptions(Activity activity)
        {
            return new PromptOptions
            {
                Prompt = activity.CreateReply($"{Resources.Prompts.GettingStartedText}\n{string.Join('\n', ExamplePromptsDictionary.Select(x => x.Value))}"),
                Choices = ExamplePromptsDictionary.Select(x => new Choice(x.Key)
                {
                    Action = new CardAction(ActionTypes.ImBack, x.Value, value: x.Value)
                }).ToList()
            };
        }

        /// <summary>
        /// Sends a temporary typing animation to the user.
        /// </summary>
        /// <returns>A <see cref="Task"/> that represents the work queued to execute.</returns>
        /// <param name="dialogContext">A <see cref="DialogContext"/> containing all the data needed
        /// for processing this dialog.</param>
        /// <param name="cancellationToken"> A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        private static async Task SendTyping(DialogContext dialogContext, CancellationToken cancellationToken)
        {
            var typingReply = dialogContext.Context.Activity.CreateReply();
            typingReply.Text = null;
            typingReply.Type = ActivityTypes.Typing;
            await dialogContext.Context.SendActivityAsync(typingReply, cancellationToken);
        }

        /// <summary>
        /// This controls what happens when an activity gets sent to the bot.
        /// </summary>
        /// <param name="turnContext">A <see cref="ITurnContext"/> containing all the data needed
        /// for processing this conversation turn. </param>
        /// <param name="cancellationToken">(Optional) A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        /// <returns>A <see cref="Task"/> that represents the work queued to execute.</returns>
        /// <seealso cref="BotStateSet"/>
        /// <seealso cref="ConversationState"/>
        /// <seealso cref="IMiddleware"/>
        public async Task OnTurnAsync(ITurnContext turnContext, CancellationToken cancellationToken = default(CancellationToken))
        {
            if (turnContext == null)
            {
                throw new ArgumentNullException(nameof(turnContext));
            }

            _telemetryClient.TrackEvent($"{turnContext.Activity.Type} event detected");

            if (turnContext.Activity.Type == ActivityTypes.Message)
            {
                var dialogContext = await _dialogs.CreateContextAsync(turnContext, cancellationToken);
                var text = dialogContext.Context.Activity.Text;

                _telemetryClient.TrackTrace($"Incoming message text: '{text}'");

                if (text.Contains(Resources.Prompts.Genes, StringComparison.OrdinalIgnoreCase))
                {
                    await SendGenes(dialogContext, cancellationToken);
                }
                else if (WhoAmIPromptsDictionary.Any(x => text.Contains(x.Value, StringComparison.OrdinalIgnoreCase)))
                {
                    var reply = dialogContext.Context.Activity.CreateReply();
                    reply.Text = Resources.Prompts.IAmThePmkbBot;
                    await dialogContext.Context.SendActivityAsync(reply, cancellationToken);
                }
                else if (text.Contains(Resources.Prompts.Examples, StringComparison.OrdinalIgnoreCase))
                {
                    await dialogContext.BeginDialogAsync(Resources.Prompts.Examples, cancellationToken);
                }
                else if (text.Equals(Resources.Prompts.DisclaimerTitle, StringComparison.OrdinalIgnoreCase))
                {
                    await SendDisclaimer(turnContext, cancellationToken);
                }
                else if (HelloPromptsDictionary.Any(x => text.Equals(x.Value, StringComparison.OrdinalIgnoreCase)))
                {
                    await SendWelcomeMessageAsync(turnContext, cancellationToken);
                }
                else
                {
                    await SendTyping(dialogContext, cancellationToken);

                    var recognizerResult = await _services.LuisServices[LuisKey].RecognizeAsync(turnContext, cancellationToken);
                    var topIntent = recognizerResult?.GetTopScoringIntent();
                    if (topIntent != null && topIntent.HasValue && topIntent.Value.intent != "None")
                    {
                        if (topIntent.Value.intent == "findGene")
                        {
                            await SendFindGeneResponseAsync(turnContext, recognizerResult, cancellationToken);
                        }
                        else
                        {
                            await turnContext.SendActivityAsync($"==>LUIS Top Scoring Intent: {topIntent.Value.intent}, Score: {topIntent.Value.score}\n");
                        }
                    }
                    else
                    {
                        await turnContext.SendActivityAsync(Resources.Prompts.ErrorMessage);
                        await dialogContext.BeginDialogAsync(Resources.Prompts.Examples, cancellationToken);
                    }
                }
            }
            else if (turnContext.Activity.Type == ActivityTypes.ConversationUpdate)
            {
                if (turnContext.Activity.MembersAdded != null)
                {
                    await SendMesageToNewUserAsync(turnContext, cancellationToken);
                }
            }
            else if (turnContext.Activity.Type == ActivityTypes.ContactRelationUpdate)
            {
                await SendMesageToNewUserAsync(turnContext, cancellationToken);
            }

            // Save the dialog state into the conversation state.
            await _accessors.ConversationState.SaveChangesAsync(turnContext, false, cancellationToken);
        }

        /// <summary>
        /// Sends mesages to a new user.
        /// </summary>
        /// <returns>A <see cref="Task"/> that represents the work queued to execute.</returns>
        /// <param name="turnContext">A <see cref="ITurnContext"/> containing all the data needed
        /// for processing this conversation turn. </param>
        /// <param name="cancellationToken">(Optional) A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        private async Task SendMesageToNewUserAsync(ITurnContext turnContext, CancellationToken cancellationToken)
        {
            foreach (var member in turnContext.Activity.MembersAdded)
            {
                if (member.Id != turnContext.Activity.Recipient.Id)
                {
                    await SendWelcomeMessageAsync(turnContext, cancellationToken);
                }
            }
        }

        /// <summary>
        /// Sends a message for the findResponse intent.
        /// </summary>
        /// <returns>A <see cref="Task"/> that represents the work queued to execute.</returns>
        /// <param name="turnContext">A <see cref="ITurnContext"/> containing all the data needed
        /// for processing this conversation turn. </param>
        /// <param name="recognizerResult">A <see cref="RecognizerResult"/> containing the refined
        /// data returned by LUIS.</param>
        /// <param name="cancellationToken">(Optional) A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        private async Task SendFindGeneResponseAsync(ITurnContext turnContext, RecognizerResult recognizerResult, CancellationToken cancellationToken)
        {
            var text = turnContext.Activity.Text;
            var reply = turnContext.Activity.CreateReply();
            reply.AttachmentLayout = AttachmentLayoutTypes.Carousel;
            foreach (var entity in recognizerResult.Entities)
            {
                Luis.Response deserializedEntity;
                try
                {
                    deserializedEntity = JsonConvert.DeserializeObject<Luis.Response>(entity.Value.ToString());
                }
                catch
                {
                    continue;
                }

                var query = string.Join(' ',
                    deserializedEntity.Genes.Select(x => x.Text)
                    .Concat(deserializedEntity.Variants.Select(x => x.Text))
                    .Concat(deserializedEntity.TumorTypes.Select(x => x.Text))
                    .Concat(deserializedEntity.TissueTypes.Select(x => x.Text)));

                _telemetryClient.TrackTrace($"Find Gene -- Text sent: '{text}', query: '{query}'");

                var interpretations = (await _pmkbApi.Interpretations.SearchAsync(query)).Results.Interpretations;

                _telemetryClient.TrackTrace($"{interpretations.Count()} Interpretations returned by PMKB API: {JsonConvert.SerializeObject(interpretations)}");

                reply.Text = $"{Resources.Prompts.Found} {interpretations.Count()} {Resources.Prompts.InterpretationsAssociatedWith} \"{text}\"";
                var sortedInterpretations = interpretations.OrderByDescending(x => x.GetRelevanceScore(query)).ToList();
                foreach (var i in sortedInterpretations.Take(10))
                {
                    reply.Attachments.Add(_cards.GetInterpretationCard(text, i));
                }

                if (interpretations.Count() > 10)
                {
                    reply.Attachments.Add(_cards.GetReadMoreCard(text, query, interpretations));
                }

                await turnContext.SendActivityAsync(reply, cancellationToken);
            }
        }

        /// <summary>
        /// Sends the message with all the genes.
        /// </summary>
        /// <returns>The genes.</returns>
        /// <param name="dialogContext">A <see cref="DialogContext"/> containing all the data needed
        /// for processing this conversation turn. </param>
        /// <param name="cancellationToken">(Optional) A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        private async Task SendGenes(DialogContext dialogContext, CancellationToken cancellationToken)
        {
            var reply = dialogContext.Context.Activity.CreateReply();
            var genes = (await _pmkbApi.Genes.GetGenesAsync()).ToArray();
            Array.Sort(genes, (x, y) => string.Compare(x.Name, y.Name));
            reply.Attachments.Add(_cards.GetGenesCard(genes));
            await dialogContext.Context.SendActivityAsync(reply, cancellationToken);
        }

        /// <summary>
        /// Sends a series of welcoming messages to the user.
        /// </summary>
        /// <param name="turnContext">A <see cref="ITurnContext"/> containing all the data needed
        /// for processing this conversation turn. </param>
        /// <param name="cancellationToken">(Optional) A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        /// <returns>A <see cref="Task"/> that represents the work queued to execute.</returns>
        private async Task SendWelcomeMessageAsync(ITurnContext turnContext, CancellationToken cancellationToken)
        {
            await SendGreeting(turnContext, cancellationToken);
            await SendDisclaimer(turnContext, cancellationToken);
            await SendGettingStarted(turnContext, cancellationToken);
        }

        /// <summary>
        /// Sends a getting started message to the user.
        /// </summary>
        /// <param name="turnContext">A <see cref="ITurnContext"/> containing all the data needed
        /// for processing this conversation turn. </param>
        /// <param name="cancellationToken">(Optional) A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        /// <returns>A <see cref="Task"/> that represents the work queued to execute.</returns>
        private async Task SendGettingStarted(ITurnContext turnContext, CancellationToken cancellationToken)
        {
            var gettingStarted = turnContext.Activity.CreateReply();
            gettingStarted.Attachments.Add(_cards.GetGettingStartedCard());
            await turnContext.SendActivityAsync(gettingStarted, cancellationToken);
        }

        /// <summary>
        /// Sends a greeting message to the user.
        /// </summary>
        /// <param name="turnContext">A <see cref="ITurnContext"/> containing all the data needed
        /// for processing this conversation turn. </param>
        /// <param name="cancellationToken">(Optional) A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        /// <returns>A <see cref="Task"/> that represents the work queued to execute.</returns>
        private static async Task SendGreeting(ITurnContext turnContext, CancellationToken cancellationToken)
        {
            var reply = turnContext.Activity.CreateReply();
            reply.Text = Resources.Prompts.Greeting;
            await turnContext.SendActivityAsync(reply, cancellationToken);
        }

        /// <summary>
        /// Sends a disclaimer message to the user.
        /// </summary>
        /// <param name="turnContext">A <see cref="ITurnContext"/> containing all the data needed
        /// for processing this conversation turn. </param>
        /// <param name="cancellationToken">(Optional) A <see cref="CancellationToken"/> that can be used by other objects
        /// or threads to receive notice of cancellation.</param>
        /// <returns>A <see cref="Task"/> that represents the work queued to execute.</returns>
        private async Task SendDisclaimer(ITurnContext turnContext, CancellationToken cancellationToken)
        {
            var disclaimer = turnContext.Activity.CreateReply();
            disclaimer.Attachments.Add(_cards.GetDisclaimerMessage());
            await turnContext.SendActivityAsync(disclaimer, cancellationToken);
        }
    }
}
