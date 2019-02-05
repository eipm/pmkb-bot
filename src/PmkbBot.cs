using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Dialogs;
using Microsoft.Bot.Builder.Dialogs.Choices;
using Microsoft.Bot.Schema;
using Newtonsoft.Json;
using Pmkb.Bot.Data;
using Pmkb.Bot.Data.Models;

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
        private static Random rnd = new Random();
        private static string[] _pathsOfCardImages;

        /// <summary>
        /// Services configured from the ".bot" file.
        /// </summary>
        private readonly BotServices _services;
        private readonly Settings _settings;
        private readonly PmkbApi _pmkbApi;
        private readonly DialogSet _dialogs;
        private readonly IHostingEnvironment _hostingEnvironment;
        private readonly BotAccessors _accessors;

        /// <summary>
        /// Initializes a new instance of the <see cref="PmkbBot"/> class.
        /// </summary>
        /// <param name="hostingEnvironment">Hosting environment.</param>
        /// <param name="accessors">A class containing <see cref="IStatePropertyAccessor{T}"/> used to manage state.</param>
        /// <param name="services">The <see cref="BotServices"/> required for LUIS.</param>
        /// <param name="settings">The application's <see cref="Settings"/>.</param>
        /// <param name="pmkbApi">The <see cref="PmkbApi"/> to request data from.</param>
        public PmkbBot(IHostingEnvironment hostingEnvironment, BotAccessors accessors, BotServices services, Settings settings, PmkbApi pmkbApi)
        {
            _hostingEnvironment = hostingEnvironment ?? throw new ArgumentNullException(nameof(hostingEnvironment));
            _accessors = accessors ?? throw new ArgumentNullException(nameof(accessors));
            _services = services ?? throw new ArgumentNullException(nameof(services));
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _pmkbApi = pmkbApi ?? throw new ArgumentNullException(nameof(pmkbApi));

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
        /// Gets the paths of card images to be used randomly.
        /// </summary>
        /// <value>The paths of card images.</value>
        private string[] PathsOfCardImages
        {
            get
            {
                if (_pathsOfCardImages == null)
                {
                    _pathsOfCardImages = Directory.GetFiles($"{_hostingEnvironment.WebRootPath}/assets/cards", "*.jpg", SearchOption.TopDirectoryOnly)
                        .Select(x => x.Replace(_hostingEnvironment.WebRootPath, "")).ToArray();
                }

                return _pathsOfCardImages;
            }
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

            if (turnContext.Activity.Type == ActivityTypes.Message)
            {
                var dialogContext = await _dialogs.CreateContextAsync(turnContext, cancellationToken);
                var text = dialogContext.Context.Activity.Text;

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
            else
            {
                await turnContext.SendActivityAsync($"{turnContext.Activity.Type} event detected", cancellationToken: cancellationToken);
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

                var interpretations = (await _pmkbApi.Interpretations.SearchAsync(query)).Results.Interpretations;

                reply.Text = $"{Resources.Prompts.Found} {interpretations.Count()} {Resources.Prompts.InterpretationsAssociatedWith} \"{text}\"";
                var sortedInterpretations = interpretations.OrderByDescending(x => x.GetRelevanceScore(query)).ToList();
                foreach (var i in sortedInterpretations.Take(10))
                {
                    reply.Attachments.Add(GetInterpretationCard(text, i));
                }

                if (interpretations.Count() > 10)
                {
                    reply.Attachments.Add(GetReadMoreCard(text, query, interpretations));
                }

                await turnContext.SendActivityAsync(reply, cancellationToken);
            }
        }

        /// <summary>
        /// Gets a card for an interpretation.
        /// </summary>
        /// <returns>The card with the interpretation.</returns>
        /// <param name="activityText">The text sent in the activity.</param>
        /// <param name="interpretation">The <see cref="Interpretation"/> to create the card for.</param>
        private Attachment GetInterpretationCard(string activityText, Interpretation interpretation)
        {
            return new HeroCard
            (
                $"Tier {interpretation.Tier} {Resources.Prompts.Interpretation}",
                $@"{Resources.Prompts.Gene}: {interpretation.Gene.Name}
                {Resources.Prompts.Variants}: {string.Join(", ", interpretation.Variants.Take(10).Select(x => x.Name))}
                {Resources.Prompts.TumorTypes}: {string.Join(", ", interpretation.TumorTypes.Take(10).Select(x => x.Name))}
                {Resources.Prompts.PrimarySites}: {string.Join(", ", interpretation.PrimarySites.Take(10).Select(x => x.Name))}",
                interpretation.Text,
                new List<CardImage> { new CardImage(_settings.Host + GetImagePathForCard()) },
                new List<CardAction> { new CardAction(ActionTypes.OpenUrl, Resources.Prompts.ReadMore, value: $"{_settings.PmkbHost}therapies/{interpretation.Id}") }
            ).ToAttachment();
        }

        /// <summary>
        /// Gets the read more card.
        /// </summary>
        /// <returns>The read more card.</returns>
        /// <param name="activityText">Activity text.</param>
        /// <param name="query">Query.</param>
        /// <param name="interpretations">Interpretations.</param>
        private Attachment GetReadMoreCard(string activityText, string query, IEnumerable<Interpretation> interpretations)
        {
            return new HeroCard
            (
                $"{Resources.Prompts.Interpretationfor} {activityText}",
                null,
                $"{Resources.Prompts.ThereAre} {interpretations.Count()} {Resources.Prompts.InterpretationsInTotal}",
                new List<CardImage> { new CardImage(_settings.Host + GetImagePathForCard()) },
                new List<CardAction> { new CardAction(ActionTypes.OpenUrl, Resources.Prompts.ReadMore, value: $"{_settings.PmkbHost}search?utf8=✓&search={query.Replace(' ', '+')}") }
            ).ToAttachment();
        }

        /// <summary>
        /// Gets the image path for a card.
        /// </summary>
        /// <returns>The image path for card.</returns>
        private string GetImagePathForCard()
        {
            var randomIndex = rnd.Next(PathsOfCardImages.Count());
            return PathsOfCardImages[randomIndex];
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
            reply.Attachments.Add(GetGenesCard(genes));
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
            gettingStarted.Attachments.Add(GetGettingStartedCard());
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
            disclaimer.Attachments.Add(GetDisclaimerMessage());
            await turnContext.SendActivityAsync(disclaimer, cancellationToken);
        }

        /// <summary>
        /// Gets the disclaimer message.
        /// </summary>
        /// <returns>An <see cref="Attachment"/> with disclaimer message.</returns>
        private Attachment GetDisclaimerMessage()
        {
            return new ThumbnailCard
            {
                Title = Resources.Prompts.DisclaimerTitle,
                Subtitle = "PMKB Bot",
                Text = Resources.Prompts.DisclaimerText,
                Images = new List<CardImage> { new CardImage(_settings.Host + "/assets/eipm.png") },
                Buttons = new List<CardAction> { new CardAction(ActionTypes.OpenUrl, Resources.Prompts.VisitWebsite, value: _settings.PmkbHost) },
            }.ToAttachment();
        }

        /// <summary>
        /// Gets the getting started card.
        /// </summary>
        /// <returns>An <see cref="Attachment"/> with the getting started card.</returns>
        private Attachment GetGettingStartedCard()
        {
            return new HeroCard
            {
                Title = Resources.Prompts.GettingStartedTitle,
                Subtitle = "PMKB Bot",
                Text = Resources.Prompts.GettingStartedText,
                Images = new List<CardImage> { new CardImage(_settings + "/assets/pmkb.jpg") },
                Buttons = new List<CardAction> { new CardAction(ActionTypes.ImBack, Resources.Prompts.Examples, value: Resources.Prompts.Examples) }
            }.ToAttachment();
        }

        /// <summary>
        /// Gets the genes card.
        /// </summary>
        /// <returns>An <see cref="Attachment"/> with the genes card.</returns>
        /// <param name="genes">An <see cref="IEnumerable{T}"/> of <see cref="Gene"/>
        /// to be included in the card.</param>
        private Attachment GetGenesCard(IEnumerable<Gene> genes)
        {
            return new HeroCard
            {
                Title = Resources.Prompts.GetGenesTitle,
                Subtitle = genes.Count().ToString(),
                Text = string.Join(", ", genes.Select(x => x.Name))
            }.ToAttachment();
        }
    }
}
