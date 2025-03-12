const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const db = require('./models');
const { Op } = require('sequelize');

const app = express();

const ANDROID_TOP_GAMES_URL = 'https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/android.top100.json';
const TOP_FREE_GAMES_INDEX = 0;
const TOP_SALES_GAMES_INDEX = 1;
const TOP_GROSSING_GAMES_INDEX = 2;
const IOS_TOP_GAMES_URL = 'https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/ios.top100.json';


app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

app.get('/api/games', (req, res) => db.Game.findAll()
  .then(games => res.send(games))
  .catch((err) => {
    console.log('There was an error querying games', JSON.stringify(err));
    return res.send(err);
  }));

app.post('/api/games', (req, res) => {
  const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
  return db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
    .then(game => res.send(game))
    .catch((err) => {
      console.log('***There was an error creating a game', JSON.stringify(err));
      return res.status(400).send(err);
    });
});

app.post('/api/games/search', (req, res) => {
  const { name, platform } = req.body;
  return db.Game.findAll({
      where: {
        name: { [Op.substring]: name },
        platform: { [Op.substring]: platform }
      }
    })
    .then(games => res.send(games))
    .catch((err) => {
      console.log('There was an error searching games', JSON.stringify(err));
      return res.send(err);
    });
});

const mapAppStoreEntryToGame = (entry, platform) => ({
  publisherId: entry.publisher_id,
  name: entry.name,
  platform: platform,
  storeId: entry.id,
  bundleId: entry.bundle_id,
  appVersion: entry.version,
  isPublished: true,
});

app.post('/api/games/populate', (_req, res) => {
  const fetchAndroidTopGames = axios.get(ANDROID_TOP_GAMES_URL, { responseType: "json" });
  const fetchIOSTopGames = axios.get(IOS_TOP_GAMES_URL, { responseType: "json" });
  Promise.all([fetchAndroidTopGames, fetchIOSTopGames])
    .then(([androidResponse, iosResponse]) => {
      const androidTopGames = androidResponse.data.map(entry => mapAppStoreEntryToGame(entry[TOP_GROSSING_GAMES_INDEX], 'android'));
      const iosTopGames = iosResponse.data.map(entry => mapAppStoreEntryToGame(entry[TOP_GROSSING_GAMES_INDEX], 'ios'));
      const gameList = androidTopGames.concat(iosTopGames);
      return gameList;
    })
    .then(gameList => db.Game.bulkCreate(gameList))
    .then(() => db.Game.findAll())
    .then(games => res.send(games));
});

app.delete('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then(game => game.destroy({ force: true }))
    .then(() => res.send({ id }))
    .catch((err) => {
      console.log('***Error deleting game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.put('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then((game) => {
      const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
      return game.update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
        .then(() => res.send(game))
        .catch((err) => {
          console.log('***Error updating game', JSON.stringify(err));
          res.status(400).send(err);
        });
    });
});


app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
