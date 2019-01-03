var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  intialize: function () {
    this.on('creating', function (model, attrs, options) {
      var shasum = crypto.createHash('sha1');
      //shasum.update(model.get('url'));
      var password = model.get('password');
      var token = shasum.digest('hex').slice(0, 5);
      model.set('token', token );
      bcrypt.hash(password, token).then(function (hash){
        console.log('pass: ',password,' token: ',token,' hash:',hash);
        model.set('password', hash);
      });
    })
  }
});

module.exports = User;