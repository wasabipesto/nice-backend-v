const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

router.get('/', async function (req, res, next) {
  return res.send(await db.many('SELECT * FROM BaseData ORDER BY base ASC;'))
})

module.exports = router
