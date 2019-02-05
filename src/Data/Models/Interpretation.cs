using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;

namespace Pmkb.Bot.Data.Models
{
    public partial class Interpretation
    {
        private static int s_pointsIfInGene = 100;
        private static int s_pointsIfInVariant = 50;
        private static int s_pointsIfInTumorType = 10;
        private static int s_pointsIfInPrimarySite = 10;
        private static int s_pointsAwardedOnTier = -5;

        [JsonProperty("id")]
        public long Id { get; set; }

        [JsonProperty("gene")]
        public Gene Gene { get; set; }

        [JsonProperty("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [JsonProperty("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }

        [JsonProperty("interpretation")]
        public string Text { get; set; }

        [JsonProperty("tissues")]
        public IEnumerable<PrimarySite> PrimarySites { get; set; }

        [JsonProperty("tier")]
        public int Tier { get; set; }

        [JsonProperty("tumors")]
        public IEnumerable<TumorType> TumorTypes { get; set; }

        [JsonProperty("variants")]
        public IEnumerable<Variant> Variants { get; set; }

        /// <summary>
        /// Gets the relevance score.
        /// </summary>
        /// <returns>The relevance score based on the given query.</returns>
        /// <param name="query">The string to be used to determine the relevance score.</param>
        public int GetRelevanceScore(string query)
        {
            var score = query.Contains(Gene.Name, StringComparison.OrdinalIgnoreCase) ? s_pointsIfInGene : 0;
            var relatedVariants = Variants.Where(v => query.Contains(v.Name, StringComparison.OrdinalIgnoreCase));
            var relatedTumorTypes = TumorTypes.Where(t => query.Contains(t.Name, StringComparison.OrdinalIgnoreCase));
            var relatedPrimarySites = PrimarySites.Where(s => query.Contains(s.Name, StringComparison.OrdinalIgnoreCase));
            return score
             + relatedVariants.Count() * s_pointsIfInVariant
             + relatedTumorTypes.Count() * s_pointsIfInTumorType
             + relatedPrimarySites.Count() * s_pointsIfInPrimarySite
             + Tier * s_pointsAwardedOnTier;
        }
    }
}
