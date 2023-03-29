const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

router.post('/', async function (req, res, next) {
  // GET INPUT DATA
  const field_id = req.body.id
  const username = req.body.username
  const client_version = req.body.client_version
  const nice_list = req.body.nice_list
  if (!field_id || !username || !nice_list) {
    return res.status(400).send('Error: missing one or more required values.')
  }

  // VALIDATE INPUT DATA
  // check if field exists
  const selected_field = await db.oneOrNone(
    'SELECT * FROM SearchFieldsNiceonly WHERE id = ${id}',
    { id: field_id }
  )
  if (!selected_field) {
    return res.status(400).send('Error: field does not exist.')
  }
  // check if field is complete
  if (selected_field.completed_time != null) {
    return res.status(400).send('Error: field has already been submitted.')
  }
  // check if nice_list is a list
  if (typeof nice_list !== 'object' && !Array.isArray(nice_list)) {
    return res.status(400).send('Error: nice_list must be a list.')
  }

  // UPDATE FIELD
  await db.one(
    'UPDATE SearchFieldsNiceonly SET \
        completed_time = now(), \
        username = ${username}, \
        client_version = ${client_version}, \
        nice_list = ${nice_list} \
      WHERE id = ${id} \
      RETURNING *;',
    {
      username: username,
      client_version: client_version,
      nice_list: JSON.stringify(nice_list),
      id: field_id,
    }
  )

  res.status(200).send('Success.')
})

module.exports = router
