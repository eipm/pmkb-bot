using System.Collections.Generic;
using Newtonsoft.Json;

namespace Pmkb.Bot.Luis
{
    public class Response
    {
        public Response()
        {
            Genes = new List<Entity>(); 
            Variants = new List<Entity>(); 
            TumorTypes = new List<Entity>(); 
            TissueTypes = new List<Entity>();
        }

        [JsonProperty("Gene")]
        public IEnumerable<Entity> Genes { get; set; }

        [JsonProperty("Variant")]
        public IEnumerable<Entity> Variants { get; set; }

        [JsonProperty("TumorType")]
        public IEnumerable<Entity> TumorTypes { get; set; }

        [JsonProperty("TissueType")]
        public IEnumerable<Entity> TissueTypes { get; set; }
    }
}
