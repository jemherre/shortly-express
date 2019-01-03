var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'keyboard cat',
  saveUninitialized: false,
  resave: false
}));

/////////////
//All routes below check to see if a user is logged in, if not then redirects the
//user to the login



app.get('/', 
  function(req, res) {
    console.log( 'req.session', req.session);
    if (req.session.user) {
      next();
      console.log('Active Session');
      res.render('index');
    } else {
      console.log('redirecting');
      res.redirect('login');
    }
  });

app.get('/create', 
  function(req, res) {
    if (req.session) {
      next();
      res.render('index');
    } else {
      res.redirect(301, 'login');
    }
  }
);

app.get('/links', 
//only allowed registered members
  function(req, res) {
    if (req.session) {
      next();
      Links.reset().fetch().then(function(links) {
        res.status(200).send(links.models);
      });
    } else {
      res.redirect('/login');
    }
  }
);

app.post('/links', 
  function(req, res) {
    var uri = req.body.url;

    if (!util.isValidUrl(uri)) {
      console.log('Not a valid url: ', uri);
      return res.sendStatus(404);
    }

    new Link({ url: uri }).fetch().then(function(found) {
      if (found) {
        res.status(200).send(found.attributes);
      } else {
        util.getUrlTitle(uri, function(err, title) {
          if (err) {
            console.log('Error reading URL heading: ', err);
            return res.sendStatus(404);
          }

          Links.create({
            url: uri,
            title: title,
            baseUrl: req.headers.origin
          })
            .then(function(newLink) {
              res.status(200).send(newLink);
            });
        });
      }
    });
  });

/************************************************************/
// Authentication routes here - when a user has already been authenticated
/************************************************************/

// app.use(session({
//   secret: 'keyboard cat',
//   saveUninitialized: false,
//   resave: true
// }));

app.post('/signup', function(req, res) {
  //require - username, password
  //check if username exists throw error with msg "Username already exists"
  //if doesn't exist, input username into the database
  var username = req.body.username;
  var password = req.body.password;
  bcrypt.hash(password, null, null, function (err, hash) {
    if (err) {
      console.log('Hash error');
      res.end();
    } else {
      var newUser = new User({username: username, password: hash});
      console.log('new user >>>>>>>>', newUser);
      newUser.save()
        .then(function(user) {
          console.log('user', user);
          req.session.regenerate(function() {
            req.session.user = newUser;
            res.redirect('/');
          });
        });
    }
  });
});

app.post('/login', function(req, response) {
  var username = req.body.username;
  var password = req.body.password;
  //query select * FROM user WHERE 'username' = username
  //creates new User in database
  console.log('LOGGING IN');
  new User({'username': username})
    .fetch().then(function(user) {
      if (user) {
      //compare entered password with token salt and the saved password
        bcrypt.compare(password, user.get('password'), function(err, res) {
          if (res) {
          //redirect to the main page
            req.session.regenerate(function() {
              console.log('password matches');
              response.location('/');
              console.log('response headers =-------->>>>> ', response.headers);
              response.redirect('/');
              req.session.user = user.username;
            });
          } else {
            console.log('password did not match');
            response.end('/login');
          }
        });
      } else {
        console.log('User does not exist');
        response.end('/signup');
      }
    });
});
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
