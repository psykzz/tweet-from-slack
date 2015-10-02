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
    throw new Error(
                    "status update: " + command + " I love tweeting from @SlackHQ. Thanks @SupportKit!" + "\n" +
                    "reply: " + command + " @Edchan77 I also love croissants" + " | " + "https://twitter.com/Edchan77/status/649603747279147008" + "\n" +
                    "retweet: " + command + " https://twitter.com/Edchan77/status/649603747279147008" + " | " + "retweet" + "\n" +
                    "favorite: " + command + " https://twitter.com/Edchan77/status/649603747279147008" + " | " + "favorite" + "\n" +
                    "You can also just pass the status id, 649603747279147008, instead of the full status url."
                    );
  }

  // only authorize certain slack users to tweet, if null, allow all slack users
  if ( process.env.ALLOWED_SLACK_USERS && 
      !process.env.ALLOWED_SLACK_USERS.match('\\b(' + user_name + ')\\b') ) {
    throw new Error('This slack user, ' + user_name + ', is not authorized to tweet.');
  }

  var tweet = text.split('|');
  var tweet_status = tweet.shift().trim().replace(/\/$/, ''); 
  var tweet_option = ( tweet_option = tweet.shift() ) ? tweet_option.trim().replace(/\/$/, '') : null;

  if ( !tweet_status ) {
    throw new Error('Nothing to tweet about.')
  }

  // retweet
  if ( tweet_option == 'retweet' ) {
    if ( id = getStatusId(tweet_status) )  
      twitter.post('statuses/retweet', {id: id}, cb);
    else
      throw new Error('Unable to retweet. Please specify a valid status id or url.');
  } 
  // favorite
  else if ( tweet_option == 'favorite' ) {
    if ( id = getStatusId(tweet_status) )
      twitter.post('favorites/create', {id: id}, cb); 
    else
      throw new Error('Unable to favorite. Please specify a valid status id or url.');
  } 
  // reply
  else if ( tweet_option && ( id = getStatusId( tweet_option ) ) ) {
      if ( tweet_status[0] != '@' ) 
        throw new Error('Replies must being with @twitter_username');

      if ( id )
        twitter.post('statuses/update', {status: tweet_status, in_reply_to_status_id: id}, cb);
      else
        throw new Error('Unable to reply. Please specify a valid status id or url.');
  } 
  // status update
  else {
    twitter.post('statuses/update', {status: tweet_status}, cb);
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

  postToTwitter( command, text, user_name, token,  function(error, tweet) {
    if (error) return next(error[0]);
    res.status(200).send('Tweeted: ' + tweet.text);
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
