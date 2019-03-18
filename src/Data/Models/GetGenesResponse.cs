using System.Collections.Generic;
using Newtonsoft.Json;

namespace Pmkb.Bot.Data.Models
{
    public class GetGenesResponse
    {
        [JsonProperty("genes")]
        public IEnumerable<Gene> Genes { get; set; }

        [JsonProperty("meta")]
        public Meta Meta { get; set; }
    }
}
