var moment = require('moment');
var sprintf = require('sprintf');
var botkit = require('botkit');
var githubAPI = require('github');

var SLACK_TOKEN = process.env.SLACK_TOKEN;
var GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
var GITHUB_ICON = 'http://www.freeiconspng.com/uploads/github-logo-icon-0.png'

var controller = botkit.slackbot({
    debug: false
});

controller.spawn({
    token: SLACK_TOKEN
}).startRTM();

github = new githubAPI({
    version: '3.0.0'
});

github.authenticate({
    type: 'oauth',
    token: GITHUB_ACCESS_TOKEN
});

var pullRequestsMerge = function(bot, message, args) {
    github.pullRequests.merge({
        user: args.user,
        repo: args.repo,
        number: Number(args.id)
    }, function(err, pr) {
        if (err) {
            bot.botkit.log('Failed to request of GitHub API:', err);
        }
    });
};

controller.hears('^merge +(.+)\/(.+) +([0-9]+)$', 'direct_mention', function(bot, message) {
    var matches = message.text.match(/^merge +(.+)\/(.+) +([0-9]+)$/i);
    var user = matches[1];
    var repo = matches[2];
    var id   = Number(matches[3]);

    github.pullRequests.get({
        user: user,
        repo: repo,
        number: id
    }, function(err, pr) {
        if (err) {
            bot.botkit.log('Failed to request of GitHub API:', err);
            if (err.code == '404') {
                var reply_with_attachments = {
                    'username': 'P-R',
                    'attachments': [
                    {
                        'pretext': 'No such Pull Request... :cry:',
                        'title': sprintf('Issues? (#%d)', id),
                        'title_link': sprintf('https://github.com/%s/%s/pull/%d', user, repo, id),
                        'text': '',
                        'color': '#B52003',
                        'footer': sprintf('%s/%s#%d', user, repo, id),
                        'footer_icon': GITHUB_ICON,
                        'ts': moment().format('X')
                    }
                    ],
                    'icon_emoji': ':octocat:'
                }
                bot.reply(message, reply_with_attachments);
            } else {
                bot.reply(message, sprintf('GitHub API Error: %s', err.toString()));
            }
            return;
        }
        if (pr.merged || !pr.mergeable) {
            var reply_with_attachments = {
                'username': 'P-R',
                'attachments': [
                {
                    'pretext': 'This Pull Request has been already merged or closed',
                    'title': sprintf('%s (#%d)', pr.title, pr.number),
                    'title_link': pr.html_url,
                    'text': pr.body,
                    'color': '#65488D',
                    'fields': [
                    {
                        'title': 'State',
                        'value': pr.state,
                        'short': true,
                    },
                    {
                        'title': 'Merged At',
                        'value': moment(pr.merged_at).format('YYYY-MM-DD HH:mm:ss Z'),
                        'short': true,
                    }
                    ],
                    'thumb_url': pr.user.avatar_url,
                    'footer': sprintf('%s/%s#%d', user, repo, id),
                    'footer_icon': GITHUB_ICON,
                    'ts': moment(pr.created_at).format('X')
                }
                ],
                'icon_emoji': ':octocat:'
            }
            bot.reply(message, reply_with_attachments);
            return;
        }

        // Diff
        var request = require('request');
        var options = {
            url: pr.diff_url,
        };
        request.get(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var messageObj = {
                    token: SLACK_TOKEN,
                    content: body,
                    filetype: 'diff',
                    filename: sprintf('diff-%d.txt', pr.number),
                    title: pr.title,
                    channels: message.channel
                };
                bot.api.files.upload(messageObj, function(err, res){
                    if (err) {
                        console.log(err);
                    }
                });
            } else {
                console.log('error: '+ response.statusCode);
            }
        })

        // Merge
        var reply_with_attachments = {
            'text': sprintf('*<%s/files|Diff>*', pr.html_url),
            'username': 'P-R',
            'attachments': [
            {
                'pretext': 'Are you sure you want to merge? [y/N]',
                'title': sprintf('%s (#%d)', pr.title, pr.number),
                'title_link': pr.html_url,
                'text': pr.body,
                'color': '#67C63D',
                'fields': [
                {
                    'title': 'commits',
                    'value': pr.commits,
                    'short': true,
                },
                {
                    'title': 'changed files',
                    'value': pr.changed_files,
                    'short': true,
                }
                ],
                'thumb_url': pr.user.avatar_url,
                'footer': sprintf('%s/%s#%d', user, repo, id),
                'footer_icon': GITHUB_ICON,
                'ts': moment(pr.created_at).format('X')
            }
            ],
            'icon_emoji': ':octocat:'
        }
        bot.startConversation(message, function(err,convo) {
            convo.ask(reply_with_attachments, [{
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    pullRequestsMerge(bot, response, {
                        user: user,
                        repo: repo,
                        id:   id
                    });

                    convo.next();
                }
            }, {
                pattern: bot.utterances.no,
                callback: function(response, convo) {
                    bot.api.reactions.add({
                        timestamp: response.ts,
                        channel: response.channel,
                        name: 'ok_woman',
                    }, function(err, _) {
                        if (err) {
                            bot.botkit.log('Failed to add emoji reaction:', err);
                        }
                    });

                    convo.next();
                }
            }]);
        });
    });
});
