var moment = require('moment');
var sprintf = require('sprintf');
var botkit = require('botkit');
var githubAPI = require('github');

var SLACK_TOKEN = process.env.SLACK_TOKEN;
var GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
var GITHUB_ICON = 'http://www.freeiconspng.com/uploads/github-logo-icon-0.png'

const COLOR_MERGED    = '#65488D';
const COLOR_CLOSED    = '#B52003';
const COLOR_OPEN      = '#67C63D';
const COLOR_NOT_FOUND = '#D3D3D3';

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

var color = function(issue, args) {
    if ('pull_request' in issue) {
        // P-R
            if (pr.state === 'open') {
                return COLOR_OPEN;
            } else {
                if (pr.merged === true) {
                    return COLOR_MERGED;
                } else {
                    return COLOR_CLOSED;
                }
            }
    } else {
        // Issue
        if (issue.state === 'open') {
            return COLOR_OPEN;
        } else {
            return COLOR_CLOSED;
        }
    }
    return COLOR_NOT_FOUND;
};

var issuesGet = function(bot, message, args) {
    github.issues.get({
        user: args.user,
        repo: args.repo,
        number: Number(args.id)
    }, function(err, issue) {
        if (err) {
            bot.botkit.log('Failed to request of GitHub API:', err);
            var reply_with_attachments = {
                'attachments': [
                {
                    'title': sprintf('%s (#%d)', 'No such data', args.id),
                    'title_link': sprintf('https://github.com/%s/%s', args.user, args.repo),
                    'color': COLOR_NOT_FOUND,
                    'footer': 'N/A',
                    'footer_icon': GITHUB_ICON,
                    'ts': moment().format('X')
                }
                ]
            }
            bot.reply(message, reply_with_attachments);
            return;
        }
        var reply_with_attachments = {
            'attachments': [
            {
                'title': sprintf('%s (#%d)', issue.title, issue.number),
                'title_link': issue.html_url,
                'text': issue.body,
                'color': color(issue, args),
                'fields': [
                {
                    'title': 'State',
                    'value': issue.state,
                    'short': true,
                },
                {
                    'title': 'Type',
                    'value': 'pull_request' in issue ? 'Pull Request' : 'Issue',
                    'short': true,
                }
                ],
                'thumb_url': issue.user.avatar_url,
                'footer': sprintf('%s/%s#%d', args.user, args.repo, args.id),
                'footer_icon': GITHUB_ICON,
                'ts': moment(issue.created_at).format('X')
            }
            ]
        }
        bot.reply(message, reply_with_attachments);
    })
};

controller.hears('', ['direct_mention','mention','ambient'], function(bot, message) {
    if (message.text.match(/^#[0-9]+$/)) {
        var matches = message.text.match(/#[0-9]+/g);
        var user = 'zplug';
        var repo = 'zplug';
        var id   = Number(matches[0].replace('#', ''));

        issuesGet(bot, message, {
            user: user,
            repo: repo,
            id:   id
        });
    } else {
        var matches = message.text.match(/#[0-9]+/g);
        for (m in matches) {
            bot.reply(message, sprintf('https://github.com/zplug/zplug/issues/%s', matches[m].replace('#', '')));
        }
    }
});

