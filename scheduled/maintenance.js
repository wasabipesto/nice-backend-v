const db = require('../helpers/db.js')
const schedule = require('node-schedule')

async function set_base_status_detailed(t, base, status_code) {
  // Status Codes:
  //   0 = None assigned, 1 = Some assigned, 2 = All assigned, 3 = All complete
  //   0 -> 1 is set when the first field in a base is assigned
  //   1 -> 2 is set when the last field in a base is assigned
  //   2 -> 3 is set when the last field in a base is completed
  t.none(
    'UPDATE BaseData \
    SET status_detailed = ${status_code} \
    WHERE base = ${base};',
    {
      base: base,
      status_code: status_code,
    }
  )
  console.log(`Set base ${base} status_detailed to ${status_code}`)
}

async function set_base_status_niceonly(t, base, status_code) {
  t.none(
    'UPDATE BaseData \
    SET status_niceonly = ${status_code} \
    WHERE base = ${base};',
    {
      base: base,
      status_code: status_code,
    }
  )
  console.log(`Set base ${base} status_niceonly to ${status_code}`)
}

const job = schedule.scheduleJob('*/10 * * * *', async function () {
  console.log('Starting maintenance...')

  // GET BASES TO UPDATE
  const base_data = await db.many('SELECT * FROM BaseData ORDER BY base ASC;')
  await Promise.all(
    base_data.map(async (i) => {
      const base = i.base

      // UPDATE STATUS
      const last_field_detailed = await db.oneOrNone(
        'SELECT * FROM SearchFieldsDetailed WHERE \
          base = ${base} \
        ORDER BY id DESC LIMIT 1;',
        { base: base }
      )
      if (last_field_detailed) {
        // some fields in base (status 1+)
        if (last_field_detailed.search_end === i.range_end) {
          // all fields assigned (status 2+)
          if (i.range_complete_detailed === i.range_total) {
            // all fields completed (status 3)
            if (i.status_detailed !== 3) {
              await set_base_status_detailed(db, base, 3)
            }
            if (i.status_niceonly !== 3) {
              await set_base_status_niceonly(db, base, 3)
            }
            return // we're done here
          } else {
            // not all fields completed (status 2)
            if (i.status_detailed !== 2) {
              await set_base_status_detailed(db, base, 2)
            }
          }
        } else {
          // not all fields assigned (status 1)
          if (i.status_detailed !== 1) {
            await set_base_status_detailed(db, base, 1)
          }
        }
      } else {
        // no fields in base (status 0)
        if (i.status_detailed !== 0) {
          await set_base_status_detailed(db, base, 0)
        }
      }

      const last_field_niceonly = await db.oneOrNone(
        'SELECT * FROM SearchFieldsNiceonly WHERE \
          base = ${base} \
        ORDER BY id DESC LIMIT 1;',
        { base: base }
      )
      if (last_field_niceonly) {
        // some fields in base (status 1+)
        if (
          last_field_niceonly.search_end === i.range_start ||
          last_field_niceonly.search_end < last_field_detailed.search_end
        ) {
          // all fields assigned (status 2+)
          if (
            i.range_complete_niceonly + i.range_complete_detailed >=
            i.range_total
          ) {
            // all fields completed (status 3)
            if (i.status_niceonly !== 3) {
              await set_base_status_niceonly(db, base, 3)
            }
          } else {
            // not all fields completed (status 2)
            if (i.status_niceonly !== 2) {
              await set_base_status_niceonly(db, base, 2)
            }
          }
        } else {
          // not all fields assigned (status 1)
          if (i.status_niceonly !== 1) {
            await set_base_status_niceonly(db, base, 1)
          }
        }
      } else {
        // no fields in base (status 0)
        if (i.status_niceonly !== 0) {
          await set_base_status_detailed(db, base, 0)
        }
      }
    })
  )
  console.log('Maintenance complete!')
})

module.exports = job
