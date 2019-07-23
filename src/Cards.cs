using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Bot.Schema;
using Pmkb.Bot.Data.Models;

namespace Pmkb.Bot
{
    public class Cards
    {

        private static Random rnd = new Random();
        private static string[] _pathsOfCardImages;

        private readonly IHostingEnvironment _hostingEnvironment;
        private readonly Settings _settings;

        /// <summary>
        /// 
        /// </summary>
        /// <param name="hostingEnvironment">Hosting environment.</param>
        /// <param name="settings">The application's <see cref="Settings"/>.</param>
        public Cards(IHostingEnvironment hostingEnvironment, Settings settings)
        {
            _hostingEnvironment = hostingEnvironment ?? throw new ArgumentNullException(nameof(hostingEnvironment));
            _settings = settings;
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
        /// Gets a card for an interpretation.
        /// </summary>
        /// <returns>The card with the interpretation.</returns>
        /// <param name="activityText">The text sent in the activity.</param>
        /// <param name="interpretation">The <see cref="Interpretation"/> to create the card for.</param>
        public Attachment GetInterpretationCard(string activityText, Interpretation interpretation)
        {
            return new HeroCard
            (
                (interpretation.Tier != null ? $"Tier {interpretation.Tier} " : "") + Resources.Prompts.Interpretation,
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
        public Attachment GetReadMoreCard(string activityText, string query, IEnumerable<Interpretation> interpretations)
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
        /// Gets the disclaimer message.
        /// </summary>
        /// <returns>An <see cref="Attachment"/> with disclaimer message.</returns>
        public Attachment GetDisclaimerMessage()
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
        public Attachment GetGettingStartedCard()
        {
            return new HeroCard
            {
                Title = Resources.Prompts.GettingStartedTitle,
                Subtitle = "PMKB Bot",
                Text = Resources.Prompts.GettingStartedText,
                Images = new List<CardImage> { new CardImage(_settings.Host + "/assets/pmkb.jpg") },
                Buttons = new List<CardAction> { new CardAction(ActionTypes.ImBack, Resources.Prompts.Examples, value: Resources.Prompts.Examples) }
            }.ToAttachment();
        }

        /// <summary>
        /// Gets the genes card.
        /// </summary>
        /// <returns>An <see cref="Attachment"/> with the genes card.</returns>
        /// <param name="genes">An <see cref="IEnumerable{T}"/> of <see cref="Gene"/>
        /// to be included in the card.</param>
        public Attachment GetGenesCard(IEnumerable<Gene> genes)
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
