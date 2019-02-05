using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Pmkb.Bot.Data.Models;

namespace Pmkb.Bot.Data
{
    public class InterpretationsRepository : Repository<Interpretation>
    {
        public InterpretationsRepository(HttpClient httpClient) : base(httpClient)
        {
        }

        public async Task<SearchResponse> SearchAsync(string query)
        {
            var response = await _client.GetAsync($"{_client.BaseAddress}search?query={WebUtility.UrlEncode(query)}");
            return await ReadResponseAsync<SearchResponse>(response);
        }
    }
}
