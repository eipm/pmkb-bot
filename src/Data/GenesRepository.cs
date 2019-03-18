using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Pmkb.Bot.Data.Models;

namespace Pmkb.Bot.Data
{
    public class GenesRepository : Repository<Gene>
    {
        public GenesRepository(HttpClient httpClient) : base(httpClient)
        {
        }

        public async Task<IEnumerable<Gene>> GetGenesAsync()
        {
            var response = await _client.GetAsync(_client.BaseAddress + "genes");
            var geneResponse = await ReadResponseAsync<GetGenesResponse>(response);
            return geneResponse.Genes;
        }
    }
}
