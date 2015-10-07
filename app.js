var express = require('express');
var bodyParser = require('body-parser');
var Twitter = require('twitter');
var twitter = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

var app = express();
var port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));

function postToTwitter(command, text, user_name, token, cb) {
  if ( !process.env.SLACK_TOKEN || token != process.env.SLACK_TOKEN ) {
    throw new Error( 'Slack token is invalid' );
  }

  if (text == undefined || text == null || text == '') {
    var valid_commands = [];

    if ( !(process.env.DISABLED_FUNCTIONS && process.env.DISABLED_FUNCTIONS.match(/status_update/g)) )
      valid_commands.push( command + " a status update" );
    if ( !(process.env.DISABLED_FUNCTIONS && process.env.DISABLED_FUNCTIONS.match(/reply/g)) )
      valid_commands.push( command + "@user a reply to a tweet" + " | " + "https://twitter.com/SupportKit/status/650007346236760064" );
    if ( !(process.env.DISABLED_FUNCTIONS && process.env.DISABLED_FUNCTIONS.match(/retweet/g)) )
      valid_commands.push( command + " retweet" + " | " + "https://twitter.com/SupportKit/status/650007346236760064" );
    if ( !(process.env.DISABLED_FUNCTIONS && process.env.DISABLED_FUNCTIONS.match(/favorite/g)) )
      valid_commands.push( command + " favorite" + " | " + "https://twitter.com/SupportKit/status/650007346236760064" );

    throw new Error( valid_commands.join("\n") );
  }

  // only authorize certain slack users to tweet, if null, allow all slack users
  if ( process.env.ALLOWED_SLACK_USERS && 
      !process.env.ALLOWED_SLACK_USERS.match('\\b(' + user_name + ')\\b') ) {
    throw new Error('This slack user, ' + user_name + ', is not authorized to tweet.');
  }

  var tweet = text.split('|');
  var tweet_status = tweet.shift().trim().replace(/\/$/, ''); 
  var tweet_status_id = ( tweet_status_id = tweet.shift() ) ? tweet_status_id.trim().replace(/\/$/, '') : null;

  if ( !tweet_status ) {
    throw new Error('Nothing to tweet about.')
  }

  // retweet
  if (  tweet_status.match(/^retweet$/) ) {
    if ( process.env.DISABLED_FUNCTIONS && process.env.DISABLED_FUNCTIONS.match(/retweet/g) )
      throw new Error('favorites are disabled');

    if ( id = getStatusId(tweet_status_id) )  
      twitter.post('statuses/retweet', {id: id}, function(error, tweet, response) {
        cb(error, tweet, 'retweeted');
      });
    else
      throw new Error('Unable to retweet. Please specify a valid status id or url.');
  } 
  // favorite
  else if ( tweet_status.match(/^favo(u?)rite$/) ) {
    if ( process.env.DISABLED_FUNCTIONS && process.env.DISABLED_FUNCTIONS.match(/favo(u?)rite/g) )
      throw new Error('favorites are disabled');

    if ( id = getStatusId(tweet_status_id) )
      twitter.post('favorites/create', {id: id}, function(error, tweet, response) {
        cb(error, tweet, 'favorited');
      }); 
    else
      throw new Error('Unable to favorite. Please specify a valid status id or url.');
  } 
  // reply
  else if ( tweet_status_id && ( id = getStatusId( tweet_status_id ) ) ) {
    if ( process.env.DISABLED_FUNCTIONS && process.env.DISABLED_FUNCTIONS.match(/reply/g) )
      throw new Error('replies are disabled');

    if ( tweet_status[0] != '@' ) 
      throw new Error('Replies must being with @twitter_username');

    if ( id )
      twitter.post('statuses/update', {status: tweet_status, in_reply_to_status_id: id}, function(error, tweet, response) {
      cb(error, tweet, 'replied');
    });
    else
      throw new Error('Unable to reply. Please specify a valid status id or url.');
  } 
  // status update
  else {
    if ( process.env.DISABLED_FUNCTIONS && process.env.DISABLED_FUNCTIONS.match(/status_update/g) )
      throw new Error('status updates are disabled');

    twitter.post('statuses/update', {status: tweet_status}, function(error, tweet, response) {
        cb(error, tweet, 'status updated');
      });
  }

  function getStatusId(status) {
    if ( status.match(/^https?:\/\/twitter\.com\/(?:#!\/)?(\w+)\/status(es)?\/(\d+)$/) || status.match(/^[0-9]*$/) ) {
      return status.split('/').pop();
    }

    return null;
  }
}

app.post('/*', function(req, res, next) {
  var command = req.body.command,
  text = req.body.text,
  user_name = req.body.user_name,
  token = req.body.token;

  postToTwitter( command, text, user_name, token,  function(error, tweet, action) {
    if (error) return next(error[0]);
    res.status(200).send(action + ": " + tweet.text);
  });
});

// test route
app.get('/', function (req, res) { res.status(200).send('SupportKit.io loves Slack and Twitter!') });

// error handler
app.use(function (err, req, res, next) {
  console.log(err.message);
  res.status(400).send(err.message);
});

app.listen(port, function () {
  console.log('Started Tweet from Slack ' + port);
});
