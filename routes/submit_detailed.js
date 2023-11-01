const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')
const pgp = require('pg-promise')({ capSQL: true })

router.post('/', async function (req, res, next) {
  // GET INPUT DATA
  const field_id = req.body.id
  const username = req.body.username
  const client_version = req.body.client_version
  const near_misses = req.body.near_misses
  const unique_count = req.body.unique_count
  if (!field_id || !username || !near_misses || !unique_count) {
    return res.status(400).send('Error: missing one or more required values.')
  }

  // VALIDATE INPUT DATA
  // check if field exists
  const selected_field = await db.oneOrNone(
    'SELECT * FROM SearchFieldsDetailed WHERE id = ${id}',
    { id: field_id }
  )
  if (!selected_field) {
    console.log(`    Error: field ${field_id} does not exist.`)
    return res.status(400).send('Error: field does not exist.')
  }
  // check if field is complete
  if (selected_field.completed_time != null) {
    console.log(`    Error: field ${field_id} has already been submitted.`)
    return res.status(400).send('Error: field has already been submitted.')
  }
  // check distribution covers all values
  const unique_count_keys = Object.keys(unique_count)
  if (
    unique_count_keys.length !== selected_field.base ||
    new Set(unique_count_keys).size !== unique_count_keys.length
  ) {
    console.log(`    Error: invalid unique_count keys - ${unique_count}`)
    return res.status(400).send('Error: invalid unique_count keys.')
  }
  // check quantity covers entire range
  const sum_unique_count = Object.values(unique_count).reduce(
    (acc, val) => acc + val,
    0
  )
  if (sum_unique_count !== +selected_field.search_range) {
    console.log([sum_unique_count, +selected_field.search_range])
    console.log(`    Error: invalid unique_count values - ${unique_count}`)
    return res.status(400).send('Error: invalid unique_count values.')
  }
  // check there are enough near misses
  const threshold = Math.floor(0.9 * selected_field.base)
  for (let i = threshold + 1; i <= selected_field.base; i++) {
    const unique_count_value = unique_count[i.toString()] || 0
    const count_near_misses = Object.values(near_misses).filter(
      (v) => v === i
    ).length
    if (unique_count_value !== count_near_misses) {
      console.log(
        `    Error: invalid near_misses count - expected ${unique_count_value} but got ${count_near_misses}`
      )
      return res.status(400).send('Error: invalid near_misses count.')
    }
  }
  console.log(
    `Accepted detailed field #${req.body.id} from ${req.body.username}/v${req.body.client_version}.`
  )
  if (req.app.get('env') === 'development') {
    console.log(JSON.stringify(req.body))
  }

  // INSERT NEAR MISSES
  if (Object.keys(near_misses).length > 0) {
    const nm_columns = new pgp.helpers.ColumnSet([
      'field_id',
      'number',
      'uniques',
    ])
    const nm_data = Object.entries(near_misses).map(([number, uniques]) => {
      // TODO: test if `number` and `uniques` are valid
      return { field_id: field_id, number: number, uniques: uniques }
    })
    db.none(pgp.helpers.insert(nm_data, nm_columns, 'nicenumbers')) // table name has to match case exactly
  }

  // UPDATE FIELD
  const completed_field = await db.one(
    'UPDATE SearchFieldsDetailed SET \
        completed_time = now(), \
        username = ${username}, \
        client_version = ${client_version}, \
        unique_distribution = ${unique_distribution} \
      WHERE id = ${id} \
      RETURNING *;',
    {
      username: username,
      client_version: client_version,
      unique_distribution: unique_count,
      id: field_id,
    }
  )

  const time_seconds =
    (completed_field.completed_time - completed_field.claimed_time) / 1000
  console.log(
    `  Searched ${
      completed_field.search_range
    } numbers in ${time_seconds} seconds at ${(
      completed_field.search_range / time_seconds
    ).toExponential(3)} nps`
  )

  res.status(200).send('Success.')
})

module.exports = router
