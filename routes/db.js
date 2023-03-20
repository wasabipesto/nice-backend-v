var express = require('express')
var router = express.Router()

require('dotenv').config()
const pgp = require('pg-promise')({})
pgp.pg.types.setTypeParser(20, BigInt) // Type Id 20 = BIGINT | BIGSERIAL
const db = pgp({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_USER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  allowExitOnIdle: true,
})

router.get('/', async function (req, res, next) {
  var resp = await db
    .many('SELECT * FROM BaseData;')
    .then(function (data) {
      return data
    })
    .catch(function (error) {
      res.status(400)
      res.send(error)
    })
  res.send(resp)
})

module.exports = router
