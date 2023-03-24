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

module.exports = db
