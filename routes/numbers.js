const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

// DASHBOARD
router.get('/', async function (req, res, next) {
  return res.send(
    await db.manyOrNone(
      'SELECT \
        NiceNumbers.number AS number, \
        NiceNumbers.uniques/CAST(SearchFieldsDetailed.base AS DECIMAL) \
          AS niceness, \
        SearchFieldsDetailed.username AS discoverer \
      FROM NiceNumbers \
      JOIN SearchFieldsDetailed ON \
        NiceNumbers.field_id = SearchFieldsDetailed.id \
      WHERE \
        NiceNumbers.uniques/CAST(SearchFieldsDetailed.base AS DECIMAL) \
          >= ${min_niceness} AND \
          NiceNumbers.number >= ${min_number} \
      ORDER BY number ASC \
      LIMIT ${limit}',
      {
        min_niceness: req.query.min_niceness || 0,
        min_number: req.query.min_number || 0,
        limit: req.query.limit || 10000,
      }
    )
  )
})

module.exports = router
