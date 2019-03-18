using System;
using Microsoft.AspNetCore.Mvc;

namespace Pmkb.Bot.Controllers
{
    public class Home : Controller
    {
        private readonly Settings _settings;

        public Home(Settings settings)
        {
            _settings = settings;
        }

        public IActionResult Index()
        {
            return View(new BotHelper(_settings));
        }
    }
}
