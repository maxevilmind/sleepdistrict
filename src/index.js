require('dotenv').config();

const Telegraf = require('telegraf');
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')

const mongoose = require('mongoose');
const get = require('lodash/get');

const User = require('./models/User');
const Location = require('./models/Location');
const Item = require('./models/Item');

const uristring =
  process.env.MONGOLAB_URI ||
  process.env.MONGOHQ_URL ||
  'mongodb://localhost/sleepdistrict';
const theport = process.env.PORT || 5000;

const bot = new Telegraf(process.env.BOT_TOKEN);

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

bot.start(ctx => {
  console.log('[info] Hi', ctx.from);
  User.findOne({ id: ctx.from.id }, (err, docs) => {
    if (!docs) { // If a user does not exist in the db create one
      const user = new User ({
        id: ctx.from.id,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        username: ctx.from.username,
      });
      user.save(function (err) {if (err) console.log ('[error] could not write to db')});
    }
  })
  ctx.reply('Send me your live location in order to enter the sleep district')
});

bot.on('edited_message', ctx => {
  console.log(`[info] ${get(ctx, 'from.username')} location updated`, ctx.editedMessage.location);
  const location = Location.update (
      { user_id: get(ctx, 'from.id') }, {
      location: {
        type: "Point",
        coordinates: [
          get(ctx, 'editedMessage.location.longitude'),
          get(ctx, 'editedMessage.location.latitude'),
        ]
      }
    },
    { upsert: true }
  );
  location.updateOne(function (err) {if (err) console.log ('[error] could not write to db')});
});

bot.on('location', ctx => {
  ctx.reply('Scanning entities within 100m');
  Item.find({
    'location': {
      '$near': {
        '$maxDistance': 100, '$geometry': {
          'type': "Point", 'coordinates': [
            get(ctx, 'message.location.longitude'),
            get(ctx, 'message.location.latitude'),
          ]
        }
      }
    }
  },
  {
    type: 1,
    description: 1
  })
  .exec((err, res) => {
    let parsedItems = '';
    res && res.forEach(curr => {
      parsedItems = parsedItems + `[${curr.type}] ${curr.description}\n`
    })
    ctx.reply(parsedItems)
  }, '');
})

bot.hears(/pick/i, ctx => {
  Location.findOne({ user_id: ctx.from.id })
    .exec((err, res) => {
      Item.find({
        'location': {
          '$near': {
            '$maxDistance': 100, '$geometry': {
              'type': "Point", 'coordinates': [
                get(res, 'location.coordinates[0]'),
                get(res, 'location.coordinates[1]'),
              ]
            }
          }
        }
      })
        .exec((err, res) => {
          if (res) {
            let menuItems = [];
            res.forEach(elem => {
              menuItems.push([`🖐[${elem['_id']}] ${elem.name}`])
            })
            ctx.reply('Choose an item to pick', Markup
            .keyboard(menuItems)
            .oneTime()
            .resize()
            .extra());
          } else {
            ctx.reply('No entities found nearby')
          }
        })
    });
})

bot.hears(/attack/i, ctx => {
  Location.findOne({ user_id: get(ctx, 'from.id') }) // get user location to find nearby entities
    .exec((err, res) => {
      Location.find({ // find entities nearby
        'location': {
          '$near': {
            '$maxDistance': 1000000, '$geometry': {
              'type': "Point", 'coordinates': [
                get(res, 'location.coordinates[0]'),
                get(res, 'location.coordinates[1]'),
              ]
            }
          }
        }
      })
        .exec((err, locations) => {
          if (locations) {
            Location.aggregate([{ // add user entity to location
              '$lookup': {
                from: 'users',
                localField: 'user_id',
                foreignField: 'id',
                as: 'user'
              }
            }]).exec((err, users) => {
              let menuItems = [];
              users.forEach(location => {
                menuItems.push([`🔫[${location['_id']}] ${location.user[0].username}`])
              })
              ctx.reply('Choose a player to attack', Markup
              .keyboard(menuItems)
              .oneTime()
              .resize()
              .extra());
            })
          } else {
            ctx.reply('No entities found nearby')
          }
        })
    });
})

bot.hears(/🖐/i, ctx => { // take command
  Location.findOne({ user_id: get(ctx, 'from.id') })
    .exec((err, res) => {
      const item = Item.update({
        '_id': ctx.message.text.match(/\[(.*?)\]/)[1],
        'location': {
          '$near': {
            '$maxDistance': 100, '$geometry': {
              'type': "Point", 'coordinates': [
                get(res, 'location.coordinates[0]'),
                get(res, 'location.coordinates[1]'),
              ]
            }
          }
        }
      }, {
        location: undefined,
        carried_by: get(ctx, 'from.id')
      });
      item.updateOne(err => {
        if (err) console.log ('[error] could not write to db')
        else ctx.reply('Successfully picked an item')
      });
    });
})

bot.hears(/inventory/i, ctx => { // take command
  Item.find({
    carried_by: ctx.from.id
  })
  .exec((err, res) => {
    let itemsList = 'You have the following items equipped:\n';
    res && res.forEach(elem => {
      itemsList = itemsList + `[${elem['_id']}] ${elem.name}\n`;
    })
    ctx.reply(itemsList);
  });
})

bot.hears(/^(help|menu)$/i, ctx => { // take command
  let menuItems = [
    ['attack'],
    ['inventory'],
    ['pick'],
  ];
  ctx.reply('Choose a command or send your location to scan for items', Markup
    .keyboard(menuItems)
    .oneTime()
    .resize()
    .extra());
})

bot.launch();
