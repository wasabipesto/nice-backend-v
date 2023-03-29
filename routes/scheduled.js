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

      // CALCULATE STATISTICS
      // get completed ranges
      const { range_complete_detailed } = await db.one(
        'SELECT \
          sum(search_range) AS range_complete_detailed \
        FROM SearchFieldsDetailed \
        WHERE \
          base = ${base} AND \
          completed_time IS NOT NULL;',
        { base: base }
      )
      const { range_complete_niceonly } = await db.one(
        'SELECT \
          sum(search_range) AS range_complete_niceonly \
        FROM SearchFieldsNiceonly \
        WHERE \
          base = ${base} AND \
          completed_time IS NOT NULL;',
        { base: base }
      )
      // get unique distributions
      const unique_distribution = await db
        .manyOrNone(
          'SELECT unique_distribution \
          FROM SearchFieldsDetailed \
          WHERE \
            base = ${base} AND \
            completed_time IS NOT NULL;',
          { base: base }
        )
        .then((data) => {
          return data.reduce((acc, obj) => {
            const dist = obj.unique_distribution
            Object.keys(dist).forEach((key) => {
              acc[key] = (acc[key] || 0) + dist[key]
            })
            return acc
          }, {})
        })

      // calculate mean & niceness
      let niceness_mean = null
      let niceness_stdev = null
      let niceness_distribution = null

      if (unique_distribution) {
        let uniques_mean = 0
        let uniques_stdev = 0
        const count = Object.values(unique_distribution).reduce(
          (acc, val) => acc + val,
          0
        )

        for (const [key, value] of Object.entries(unique_distribution)) {
          uniques_mean += key * value
          uniques_stdev += value * key ** 2
        }

        uniques_mean /= count
        niceness_mean = uniques_mean / base || 0

        uniques_stdev = Math.sqrt(uniques_stdev / count - uniques_mean ** 2)
        niceness_stdev = uniques_stdev / base || 0

        // normalize unique distribution to range between 0 and 1
        const maxCount = Math.max(...Object.values(unique_distribution))
        niceness_distribution = {}
        for (const [key, value] of Object.entries(unique_distribution)) {
          niceness_distribution[Number.parseFloat((key / base).toFixed(3))] =
            value / maxCount
        }
      }

      // submit to db
      await db.none(
        'UPDATE BaseData \
        SET \
          range_complete_detailed = ${range_complete_detailed}, \
          range_complete_niceonly = ${range_complete_niceonly}, \
          niceness_mean = ${niceness_mean}, \
          niceness_stdev = ${niceness_stdev}, \
          niceness_distribution = ${niceness_distribution} \
        WHERE base = ${base};',
        {
          base: base,
          range_complete_detailed: range_complete_detailed || 0,
          range_complete_niceonly: range_complete_niceonly || 0,
          niceness_mean: niceness_mean,
          niceness_stdev: niceness_stdev,
          niceness_distribution: niceness_distribution,
        }
      )

      // UPDATE STATUS
      const last_field_detailed = await db.oneOrNone(
        'SELECT * FROM SearchFieldsDetailed WHERE \
          base = ${base} \
        ORDER BY id DESC LIMIT 1;',
        { base: base }
      )
      let last_field_detailed_end
      if (last_field_detailed) {
        last_field_detailed_end = last_field_detailed.search_end
        // some fields in base (status 1+)
        if (last_field_detailed_end === i.range_end) {
          // all fields assigned (status 2+)
          if (range_complete_detailed === i.range_total) {
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
        last_field_detailed_end = 0
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
          last_field_niceonly.search_end < last_field_detailed_end
        ) {
          // all fields assigned (status 2+)
          if (
            range_complete_niceonly + range_complete_detailed >=
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
