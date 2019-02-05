using System.Collections.Generic;
using Newtonsoft.Json;

namespace Pmkb.Bot.Data.Models
{
    public partial class Results
    {
        [JsonProperty("interpretations")]
        public IEnumerable<Interpretation> Interpretations { get; set; }

        [JsonProperty("variants")]
        public IEnumerable<Variant> Variants { get; set; }
    }
}
