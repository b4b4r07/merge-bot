var sprintf = require('sprintf');

controller.hears('', ['direct_mention','mention','ambient'], function(bot, message) {
    var matches = message.text.match(/#[0-9]+/g);
    for (m in matches) {
        bot.reply(message, sprintf('https://github.com/zplug/zplug/issues/%s', matches[m].replace('#', '')));
    }
});
