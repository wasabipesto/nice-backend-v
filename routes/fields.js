const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

// DASHBOARD
router.get('/', async function (req, res, next) {
  return res.send({
    nice: await db.manyOrNone(
      "SELECT * FROM SearchFieldsNiceonly WHERE nice_list <> '[]';"
    ),
  })
})

module.exports = router
