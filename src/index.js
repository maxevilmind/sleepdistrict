require('dotenv').config();

const Telegraf = require('telegraf');
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')

const mongoose = require('mongoose');
const get = require('lodash/get');

const User = require('./models/User');
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
        location: {
          type: "Point",
          coordinates: [
            0,
            0,
          ]
        },
        stats: {
          attack: 0,
          defence: 0,
          hp: 100,
        }
      });
      user.save(function (err) {if (err) console.log ('[error] could not write to db', err)});
    }
  })
  ctx.reply('Send me your live location in order to enter the sleep district. This is a mandatory rule in our district. Once you are in, you will be visible to the other players. You will be able to collect items and attack other people.')
  ctx.reply('Attacking distance is limited by weapon\'s effective range')
  ctx.reply('Type \'menu\' or \'help\' to acces player menu')
  ctx.reply('You can pick items around you with a \'pick\' command')
  ctx.reply('You can attack people around with an \'attack\' command')
});

bot.on('edited_message', ctx => {
  console.log(`[info] ${get(ctx, 'from.username')} location updated`, ctx.editedMessage.location);
  const user = User.update (
      { id: get(ctx, 'from.id') }, {
      location: {
        type: "Point",
        coordinates: [
          get(ctx, 'editedMessage.location.longitude'),
          get(ctx, 'editedMessage.location.latitude'),
        ]
      }
    },
    //{ upsert: true }
  );
  user.updateOne(function (err) {if (err) console.log ('[error] could not write to db')});
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
  User.findOne({ id: get(ctx, 'from.id') })
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
          if (res && res.length) {
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
  User.findOne({ id: get(ctx, 'from.id') }) // get user location to find nearby entities
    .exec((err, self) => {
      User.find({ // find entities nearby
        'location': {
          '$near': {
            '$maxDistance': 100000, '$geometry': {
              'type': "Point", 'coordinates': [
                get(self, 'location.coordinates[0]'),
                get(self, 'location.coordinates[1]'),
              ]
            }
          }
        }
      })
        .exec((err, users) => {
          if (users && users.length) {
            let menuItems = [];
            users.forEach(user => {
              menuItems.push([`🔫[${user['_id']}] ${user.username}`])
            })
            ctx.reply('Choose a player to attack', Markup
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

bot.hears(/🖐/i, ctx => { // take command
  User.findOne({ id: get(ctx, 'from.id') })
    .exec((err, self) => {
      const item = Item.update({
        '_id': ctx.message.text.match(/\[(.*?)\]/)[1],
        'location': {
          '$near': {
            '$maxDistance': 100, '$geometry': {
              'type': "Point", 'coordinates': [
                get(self, 'location.coordinates[0]'),
                get(self, 'location.coordinates[1]'),
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

bot.hears(/🔫/i, ctx => { // attack command
  User.findOne({ id: get(ctx, 'from.id') })
    .exec((err, self) => {
      User.findOne({
        '_id': ctx.message.text.match(/\[(.*?)\]/)[1],
        'location': {
          '$near': {
            '$maxDistance': 10000, '$geometry': {
              'type': "Point", 'coordinates': [
                get(self, 'location.coordinates[0]'),
                get(self, 'location.coordinates[1]'),
              ]
            }
          }
        }
      })
        .exec((err, attackedUser)=> {
          Item.findOne({ carried_by: get(ctx, 'from.id') })
            .sort({ 'stats.attack': -1 })
            .exec((err, attackersStrongestWeapon) => {
              Item.findOne({ carried_by: get(ctx, 'from.id') })
                .sort({ 'stats.defence': -1 })
                .exec((err, victimsStrongestArmor) => {
                  if (attackersStrongestWeapon) {
                    if (attackedUser && attackedUser.stats) {
                      let updatedVictimStats = Object.assign({}, attackedUser.stats)
                      let damage = 0
                      if (victimsStrongestArmor) {
                        damage = damage + attackersStrongestWeapon.stats.attack - victimsStrongestArmor.stats.defence
                      }
                      updatedVictimStats.hp = updatedVictimStats.hp - damage
                      User.updateOne({
                        '_id': ctx.message.text.match(/\[(.*?)\]/)[1]},
                        {
                          stats: updatedVictimStats
                        })
                        .exec((err, res) => {
                          if (err) console.log ('[error] could not write to db')
                          else {
                            ctx.reply(`You hit ${attackedUser.username} with your ${attackersStrongestWeapon.name} causing -${damage} damage`)
                            bot.telegram.sendMessage(attackedUser.id, `You have been attacked with a ${attackersStrongestWeapon.name} by ${self.username} hitting -${damage}`)
                            checkDead(attackedUser.id)
                          }
                        })
                    }
                  } else {
                    ctx.reply(`You don't have any weapon to attack with. Go find something!`)
                  }
                })
            })
        })
    })
})

bot.hears(/inventory/i, ctx => { // take command
  Item.find({
    carried_by: ctx.from.id
  })
  .exec((err, items) => {
    if (items && items.length) {
      let itemsList = 'You have the following items equipped:\n';
      items && items.forEach(elem => {
        itemsList = itemsList + `[${elem['_id']}] ${elem.name}\n`;
      })
      ctx.reply(itemsList);
    } else {
      ctx.reply('You don\'t have any items');
    }
  });
})

bot.hears(/^(help|menu)$/i, ctx => { // take command
  let menuItems = [
    ['attack'],
    ['inventory'],
    ['me'],
    ['pick'],
  ];
  ctx.reply('Choose a command or send your location to scan for items', Markup
    .keyboard(menuItems)
    .oneTime()
    .resize()
    .extra());
})

bot.hears(/me/i, ctx => { // take command
  User.findOne({ id: get(ctx, 'from.id') })
    .exec((err, self) => {
      if (err) console.log (`[error] could not get stats for ${get(ctx, 'from.id')}`)
      else {
        Item.findOne({ carried_by: get(ctx, 'from.id') })
          .sort({ 'stats.defence': -1 })
          .exec((err, strongestArmor) => {
            Item.findOne({ carried_by: get(ctx, 'from.id') })
              .sort({ 'stats.weapon': -1 })
              .exec((err, strongestWeapon) => {
                ctx.reply(`
Your stats:\n
❤️ Health: ${self.stats.hp}
⚔ Attack: ${get(strongestWeapon, 'stats.attack') || 0}
🛡 Defence: ${get(strongestArmor, 'stats.defence') || 0}
              `);
            })
          })
      }
    })
})

const checkDead = victimId => {
  User.findOne({ id: victimId })
    .exec((err, user) => {
      if (get(user, 'stats.hp') <= 0) {
        Item.updateMany({ carried_by: victimId }, { location: user.location, carried_by: undefined })
          .exec((err, items) => {
            if (err) console.log (`[error] could not update killed user ${user.username}`)
            else bot.telegram.sendMessage(victimId, 'Bro u got shot too bad. You are lucky the ambulance has been passing close by. You were rescued and your hp has been restored to 100hp. You dropped your weapon at the place you were hit, you can try to find it there.')
          })
        let updatedVictimStats = Object.assign({}, user.stats)
        updatedVictimStats.hp = 100;
        User.updateOne({ id: victimId }, { stats: updatedVictimStats })
          .exec((err, user) => {
            if (err) console.log (`[error] could not restore hp for dead ${user.username}`)
          })
      }
    })
}

bot.launch();
