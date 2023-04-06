const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

router.get('/', async function (req, res, next) {
  return res.send(
    await db.many('SELECT * FROM History ORDER BY start_time ASC;')
  )
})

module.exports = router
