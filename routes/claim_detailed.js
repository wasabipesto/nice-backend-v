const express = require('express')
const router = express.Router()
const db = require('../helpers/db.js')

async function get_settings(t) {
  return t.many('SELECT * FROM Settings;').then((data) => {
    return data.reduce(
      (obj, item) => Object.assign(obj, { [item.key]: item.value }),
      {}
    )
  })
}

async function get_table_lock(t) {
  return t.none(
    // Must block ROW EXCLUSIVE (UPDATE/INSERT)
    //   and also be self-exclusive (block other similar locks)
    //   https://www.postgresql.org/docs/current/explicit-locking.html
    'LOCK TABLE SearchFieldsDetailed IN SHARE ROW EXCLUSIVE MODE;'
  )
}

async function get_base_data(t, base) {
  return t.oneOrNone('SELECT * FROM BaseData WHERE base = ${base};', {
    base: base,
  })
}

async function set_base_status(t, base, status_code) {
  // Status Codes:
  //   0 = None assigned, 1 = Some assigned, 2 = All assigned, 3 = All complete
  //   0 -> 1 is set when the first field in a base is assigned
  //   1 -> 2 is set when the last field in a base is assigned
  //   2 -> 3 is set when the last fiels in a base is completed
  t.none(
    'UPDATE BaseData \
    SET status_detailed = ${status_code} \
    WHERE base = ${base};',
    {
      base: base,
      status_code: status_code,
    }
  )
}

async function get_incomplete_base_random(t) {
  return t.one(
    'SELECT * FROM BaseData \
    WHERE status_detailed < 2 \
    ORDER BY RANDOM () LIMIT 1;'
  )
}

async function get_incomplete_base_ordered(t) {
  return t.one(
    'SELECT * FROM BaseData \
    WHERE status_detailed < 2 \
    ORDER BY base ASC LIMIT 1;'
  )
}

async function get_previous_field(t, base) {
  return t.one(
    'SELECT * FROM SearchFieldsDetailed WHERE \
        base = ${base} \
      ORDER BY id DESC LIMIT 1;',
    { base: base }
  )
}

async function assign_expired(
  t,
  base,
  username,
  claim_duration_hours,
  max_range
) {
  return t.oneOrNone(
    "UPDATE SearchFieldsDetailed \
    SET \
      username = ${username}, \
      claimed_time = now(), \
      expired_time = now() + interval '1 hour' * ${claim_duration_hours} \
    WHERE id = ( \
      SELECT id FROM SearchFieldsDetailed \
      WHERE \
        base = ${base} AND \
        search_range <= ${max_range} AND \
        completed_time IS NULL AND \
        expired_time < now() \
      ORDER BY id ASC LIMIT 1 \
    ) RETURNING *;",
    {
      base: base,
      username: username,
      claim_duration_hours: claim_duration_hours,
      max_range: max_range,
    }
  )
}

async function assign_expired_any_base(
  t,
  username,
  claim_duration_hours,
  max_range
) {
  return t.oneOrNone(
    "UPDATE SearchFieldsDetailed \
    SET \
      username = ${username}, \
      claimed_time = now(), \
      expired_time = now() + interval '1 hour' * ${claim_duration_hours} \
    WHERE id = ( \
      SELECT id FROM SearchFieldsDetailed \
      WHERE \
        search_range <= ${max_range} AND \
        completed_time IS NULL AND \
        expired_time < now() \
      ORDER BY search_start ASC LIMIT 1 \
    ) RETURNING *;",
    {
      username: username,
      claim_duration_hours: claim_duration_hours,
      max_range: max_range,
    }
  )
}

async function assign_first(
  t,
  base,
  username,
  claim_duration_hours,
  search_start,
  search_end
) {
  return t.oneOrNone(
    "INSERT INTO SearchFieldsDetailed ( \
      base, \
      search_start, \
      search_end, \
      search_range, \
      claimed_time, \
      expired_time, \
      username \
    ) SELECT \
      ${base}, \
      ${search_start}, \
      ${search_end}, \
      ${search_range}, \
      now(), \
      now() + interval '1 hour' * ${claim_duration_hours}, \
      ${username} \
    WHERE NOT EXISTS ( \
      SELECT 1 FROM SearchFieldsDetailed \
      WHERE base = ${base} \
    ) RETURNING *;",
    {
      base: base,
      username: username,
      claim_duration_hours: claim_duration_hours,
      search_start: search_start,
      search_end: search_end,
      search_range: search_start - search_end,
    }
  )
}

async function assign_subsequent(
  t,
  base,
  username,
  claim_duration_hours,
  search_start,
  search_end
) {
  return t.one(
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
      username: username,
      claim_duration_hours: claim_duration_hours,
      search_start: search_start,
      search_end: search_end,
      search_range: search_end - search_start,
    }
  )
}

router.get('/', async function (req, res, next) {
  // GET SETTINGS AND INPUTS
  let base
  const settings = await get_settings(db)
  const username = req.query.username || settings.username_default
  const max_range = +req.query.max_range || +settings.checkout_range_default
  const claim_duration_hours = +settings.claim_duration_hours
  const claim_chance_random = +settings.claim_chance_random
  if (
    !Number.isInteger(max_range) ||
    max_range < settings.checkout_range_minimum ||
    max_range > settings.checkout_range_maximum
  ) {
    return res.status(400).send('Error: max_range is out of bounds or invalid.')
  }

  if (req.query.base) {
    // the user requested a specific base
    base = +req.query.base
    if (!Number.isInteger(base) || base % 5 === 1) {
      return res
        .status(400)
        .send(
          'Error: requested base is invalid. Base must be an integer and not 1 mod 5.'
        )
    }
  }

  // ASSIGN EXPIRED FIELD
  if (req.query.base) {
    // try to assign from the requested base
    const expired_field = await assign_expired(
      db,
      base,
      username,
      claim_duration_hours,
      max_range
    )
    if (expired_field) {
      console.log('    Assigning expired field...')
      return res.send(expired_field)
    }
  } else {
    // try to assign from any base
    const expired_field = await assign_expired_any_base(
      db,
      username,
      claim_duration_hours,
      max_range
    )
    if (expired_field) {
      console.log('    Assigning expired field...')
      return res.send(expired_field)
    }
  }
  // no expired fields, proceeding...

  db.tx(async (t) => {
    await get_table_lock(t)

    let base_data
    if (req.query.base) {
      // user requested base - get the data and validate
      base_data = await get_base_data(t, base)
      if (!base_data) {
        return res
          .status(400)
          .send(`Requested base is not part of the current search effort.`)
      }
      if (base_data.status_detailed > 1) {
        return res.status(400).send(`No available fields in requested base.`)
      }
    } else {
      // no request - get a valid one
      if (Math.random() < claim_chance_random) {
        base_data = await get_incomplete_base_random(t)
      } else {
        base_data = await get_incomplete_base_ordered(t)
      }
      base = +base_data.base
    }
    const base_status = +base_data.status_detailed

    // calculate start and end points
    const base_range_start = BigInt(base_data.range_start)
    const base_range_end = BigInt(base_data.range_end)
    const first_range_start = base_range_start
    const first_range_end_tentative = first_range_start + BigInt(max_range)
    const first_range_end =
      first_range_end_tentative > base_range_end
        ? base_range_end
        : first_range_end_tentative // clamp to high end of range

    if (base_status === 0) {
      // ASSIGN FIRST FIELD
      const first_field = await assign_first(
        t,
        base,
        username,
        claim_duration_hours,
        first_range_start,
        first_range_end
      )
      if (first_field) {
        console.log('    Assigning first field in new base...')
        await set_base_status(t, base, 1)
        return res.send(first_field)
      } else {
        console.log(
          `    Base ${base} status was set to 0 but first field could not be assigned.`
        )
        await set_base_status(t, base, 1)
      }
    }

    // ASSIGN SUBSEQUENT FIELD
    // Step 1. Get previous field
    const prev_field = await get_previous_field(t, base)

    // Step 2. Calculate new range
    const subseq_range_start = BigInt(prev_field.search_end)
    const subseq_range_end_tentative = subseq_range_start + BigInt(max_range)
    const subseq_range_end =
      subseq_range_end_tentative > base_range_end
        ? base_range_end
        : subseq_range_end_tentative
    if (subseq_range_start === subseq_range_end) {
      console.log(
        `    Base ${base} status was set to ${base_status} but there's no room left in the base!.`
      )
      await set_base_status(t, base, 2)
      return res.status(500).send(`Internal server error.`)
    }

    // Step 3. Insert new field
    const subseq_field = await assign_subsequent(
      t,
      base,
      username,
      claim_duration_hours,
      subseq_range_start,
      subseq_range_end
    )

    // Step 4. Return new field
    console.log('    Assigning new subsequent field...')
    return res.send(subseq_field)
  })
})

module.exports = router
