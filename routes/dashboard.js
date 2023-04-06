const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

// DASHBOARD
router.get('/', async function (req, res, next) {
  try {
    return res.send({
      base_data: await db.many('SELECT * FROM BaseData ORDER BY base;'),
      nice_numbers: await db.manyOrNone(
        'SELECT \
          NiceNumbers.number AS number, \
          CAST( \
            NiceNumbers.uniques/CAST(SearchFieldsDetailed.base AS DECIMAL) AS DECIMAL(6,5) \
          ) AS niceness, \
          SearchFieldsDetailed.username AS discoverer \
        FROM NiceNumbers \
        JOIN SearchFieldsDetailed ON \
          NiceNumbers.field_id = SearchFieldsDetailed.id \
        WHERE NiceNumbers.uniques/CAST(SearchFieldsDetailed.base AS DECIMAL) > 0.94 \
        ORDER BY niceness DESC LIMIT 10000'
      ),
      history: await db.many('SELECT * FROM History ORDER BY start_time ASC;'),
    })
  } catch (e) {
    return res.status(500).send(e)
  }
})

module.exports = router
