const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

router.get('/', async function (req, res, next) {
  return res.send(
    await db.many('SELECT * FROM Settings;').then((data) => {
      return data.reduce(
        (obj, item) => Object.assign(obj, { [item.key]: item.value }),
        {}
      )
    })
  )
})

module.exports = router
