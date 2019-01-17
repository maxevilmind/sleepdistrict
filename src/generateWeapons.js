require('dotenv').config();

const mongoose = require('mongoose');
const randomLocation = require('random-location')

const Item = require('./models/Item');

const uristring =
  process.env.MONGOLAB_URI ||
  process.env.MONGOHQ_URL ||
  'mongodb://localhost/sleepdistrict';

mongoose.connect(
  uristring,
  function(err, res) {
    if (err) {
      console.log('[error] while connecting to: ' + uristring + '. ' + err);
    } else {
      console.log('[info] succeeded connected to: ' + uristring);
    }
  }
);

const P = {
  latitude: 42.882004,
  longitude: 74.582748
}
const R = 10000 // meters

for (let index = 0; index < 50000; index++) {
  console.log('[info] iteration number', index);
  const item = new Item ({
    carried_by: undefined,
    location: {
      type: "Point",
      coordinates: [
        randomLocation.randomCirclePoint(P, R).longitude,
        randomLocation.randomCirclePoint(P, R).latitude,
      ]
    },
    type: 'weapon',
    name: 'Glock G17',
    description: 'Glock G17 9 mm short recoil–operated, locked-breech semi-automatic pistol',
    cost: 500,
    stats: {
      attack: 100,
      defence: 0,
    }
  });
  item.save(function (err) {if (err) console.log ('[error] could not write to db')});  
}

// createIndex({location:"2dsphere"});