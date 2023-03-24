const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

// DETAILED CLAIM
router.get('/detailed', async function (req, res, next) {
  // GET SETTINGS
  const settings = await db
    .many('SELECT * FROM Settings;')
    .then((data) => {
      return data.reduce(
        (obj, item) => Object.assign(obj, { [item.key]: item.value }),
        {}
      )
    })
    .catch((error) => {
      return res.status(500).send(error)
    })

  // GET QUERY DATA
  const username = req.query.username || settings.username_default
  const base = +req.query.base || +settings.base_current_detailed
  const max_range = +req.query.max_range || +settings.checkout_range_default

  // VALIDATE INPUTS
  if (
    !Number.isInteger(base) ||
    base < settings.base_current_detailed ||
    base > settings.base_maximum ||
    base % 5 === 1
  ) {
    return res.status(400).send('Error: base is out of bounds or invalid.')
  }
  if (
    !Number.isInteger(max_range) ||
    max_range < settings.checkout_range_minimum ||
    max_range > settings.checkout_range_maximum
  ) {
    return res.status(400).send('Error: max_range is out of bounds or invalid.')
  }

  // ASSIGN EXPIRED FIELD
  try {
    const expired_field = await db.oneOrNone(
      "UPDATE SearchFieldsDetailed \
      SET \
        username = ${username}, \
        claimed_time = now(), \
        expired_time = now() + interval '1 hour' * ${claim_duration_hours} \
      WHERE id = ( \
        SELECT id FROM SearchFieldsDetailed \
        WHERE \
          canon = TRUE AND \
          base = ${base} AND \
          search_range <= ${max_range} AND \
          completed_time IS NULL AND \
          expired_time < now() \
        ORDER BY id DESC LIMIT 1 \
      ) RETURNING *;",
      {
        username: username,
        claim_duration_hours: +settings.claim_duration_hours,
        base: base,
        max_range: max_range,
      }
    )
    if (expired_field) {
      console.log('Assigning expired field...')
      return res.send(expired_field)
    }
  } catch (e) {
    return res.status(500).send(e)
  }

  // GET BASE BOUNDS
  const base_info = await db
    .one('SELECT * FROM BaseData WHERE base = ${base};', { base: base })
    .catch(function (error) {
      return res.status(500).send(error)
    })
  const valid_start = BigInt(base_info.range_start)
  const valid_end = BigInt(base_info.range_end)

  // ASSIGN FIRST FIELD
  const first_range_start = valid_start
  const first_range_end_tentative = first_range_start + BigInt(max_range)
  const first_range_end =
    first_range_end_tentative > valid_end
      ? valid_end
      : first_range_end_tentative // clamp to high end of range

  try {
    const first_field = await db.oneOrNone(
      "INSERT INTO SearchFieldsDetailed ( \
              base, \
              search_start, \
              search_end, \
              search_range, \
              claimed_time, \
              expired_time, \
              username \
            ) SELECT \
              ${base}, ${search_start}, ${search_end}, ${search_range}, \
              now(), now() + interval '1 hour' * ${claim_duration_hours}, \
              ${username} \
            WHERE NOT EXISTS ( \
              SELECT 1 FROM SearchFieldsDetailed \
              WHERE canon = TRUE AND base = ${base} \
            ) RETURNING *;",
      {
        base: base,
        search_start: first_range_start,
        search_end: first_range_end,
        search_range: first_range_end - first_range_start,
        claim_duration_hours: +settings.claim_duration_hours,
        username: username,
      }
    )
    if (first_field) {
      console.log('Assigning first field in new base...')
      return res.send(first_field)
    }
  } catch (e) {
    return res.status(500).send(e)
  }

  // ASSIGN SUBSEQUENT FIELD
  try {
    db.tx(async (t) => {
      // Step 0. Acquire table lock
      t.none(
        // Must block ROW EXCLUSIVE (INSERT) and also be self-exclusive
        //   (block other attempts to claim the same lock type)
        //   https://www.postgresql.org/docs/current/explicit-locking.html
        'LOCK TABLE SearchFieldsDetailed IN SHARE ROW EXCLUSIVE MODE;'
      )

      // Step 1. Get previous field
      const prev_field = await t.one(
        'SELECT * FROM SearchFieldsDetailed WHERE \
          canon = TRUE AND \
          base = ${base} \
        ORDER BY id DESC LIMIT 1;',
        { base: base }
      )

      // Step 2. Calculate new range
      const subseq_range_start = BigInt(prev_field.search_end)
      const subseq_range_end_tentative = subseq_range_start + BigInt(max_range)
      const subseq_range_end =
        subseq_range_end_tentative > valid_end
          ? valid_end
          : subseq_range_end_tentative
      if (subseq_range_start === subseq_range_end) {
        console.log('No room left in base, incrementing current_base.')
        const next_base = base % 5 === 0 ? base + 2 : base + 1
        await t.none(
          "UPDATE Settings SET value = ${base} \
        WHERE key = 'base_current_detailed';",
          { base: next_base }
        )
        return res.redirect(req.originalUrl)
      }

      // Step 3. Insert new field
      const subseq_field = await t.one(
        "INSERT INTO SearchFieldsDetailed ( \
				base, search_start, search_end, search_range, \
				claimed_time, expired_time, username \
			) VALUES ( \
				${base}, ${search_start}, ${search_end}, ${search_range}, \
				now(), now() + interval '1 hour' * ${claim_duration_hours}, \
        ${username} \
			) RETURNING *;",
        {
          base: base,
          search_start: subseq_range_start,
          search_end: subseq_range_end,
          search_range: subseq_range_end - subseq_range_start,
          claim_duration_hours: settings.claim_duration_hours,
          username: username,
        }
      )

      // Step 4. Return new field
      console.log('Assigning new subsequent field...')
      return res.send(subseq_field)
    })
  } catch {
    return res.status(500).send(error)
  }
})

module.exports = router
