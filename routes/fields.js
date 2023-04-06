const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

router.get('/detailed/by-base', async function (req, res, next) {
  return res.send(
    await db.manyOrNone(
      'SELECT * FROM SearchFieldsDetailed \
      WHERE base = ${base} AND id > ${after} \
      ORDER BY id ASC LIMIT ${limit};',
      {
        base: req.query.base || 10,
        after: req.query.after || 0,
        limit: req.query.limit || 1000,
      }
    )
  )
})
router.get('/niceonly/by-base', async function (req, res, next) {
  return res.send(
    await db.manyOrNone(
      'SELECT * FROM SearchFieldsNiceonly \
      WHERE base = ${base} AND id > ${after} \
      ORDER BY id ASC LIMIT ${limit};',
      {
        base: req.query.base || 10,
        after: req.query.after || 0,
        limit: req.query.limit || 1000,
      }
    )
  )
})

router.get('/detailed/incomplete', async function (req, res, next) {
  return res.send(
    await db.manyOrNone(
      'SELECT * FROM SearchFieldsDetailed \
      WHERE completed_time IS NULL AND id > ${after} \
      ORDER BY id ASC LIMIT ${limit};',
      {
        after: req.query.after || 0,
        limit: req.query.limit || 1000,
      }
    )
  )
})
router.get('/niceonly/incomplete', async function (req, res, next) {
  return res.send(
    await db.manyOrNone(
      'SELECT * FROM SearchFieldsNiceonly \
      WHERE completed_time IS NULL AND id > ${after} \
      ORDER BY id ASC LIMIT ${limit};',
      {
        after: req.query.after || 0,
        limit: req.query.limit || 1000,
      }
    )
  )
})

router.get('/detailed/stats', async function (req, res, next) {
  return res.send(
    await db.oneOrNone(
      "SELECT \
        SUM(search_range) / (3600 * ${hours}) AS total_hash_rate, \
        AVG( \
          search_range / EXTRACT(EPOCH FROM (completed_time - claimed_time)) \
        ) AS avg_hash_rate, \
        AVG( \
          EXTRACT(EPOCH FROM (completed_time - claimed_time)) \
        ) AS avg_seconds_per_field \
      FROM SearchFieldsNiceonly  \
      WHERE completed_time > (NOW() - INTERVAL '1 hour' * ${hours});",
      {
        hours: req.query.hours || 1,
      }
    )
  )
})
router.get('/niceonly/stats', async function (req, res, next) {
  return res.send(
    await db.oneOrNone(
      "SELECT \
        SUM(search_range) / (3600 * ${hours}) AS total_hash_rate, \
        AVG( \
          search_range / EXTRACT(EPOCH FROM (completed_time - claimed_time)) \
        ) AS avg_hash_rate, \
        AVG( \
          EXTRACT(EPOCH FROM (completed_time - claimed_time)) \
        ) AS avg_seconds_per_field \
      FROM SearchFieldsNiceonly  \
      WHERE completed_time > (NOW() - INTERVAL '1 hour' * ${hours});",
      {
        hours: req.query.hours || 1,
      }
    )
  )
})

router.get('/niceonly/found-nice', async function (req, res, next) {
  return res.send(
    await db.manyOrNone(
      "SELECT * FROM SearchFieldsNiceonly \
      WHERE nice_list <> '[]' AND id > ${after} \
      ORDER BY id ASC LIMIT ${limit};",
      {
        after: req.query.after || 0,
        limit: req.query.limit || 1000,
      }
    )
  )
})

module.exports = router
