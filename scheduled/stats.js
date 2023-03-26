const db = require('../helpers/db.js')
const schedule = require('node-schedule')

const job = schedule.scheduleJob('*/10 * * * *', async function () {
  console.log('Processing stats...')

  // GET BASES TO UPDATE
  const bases = await db
    .many('SELECT * FROM BaseData ORDER BY base ASC;')
    .then((res) => res.map((row) => row.base))

  // LOOP THROUGH ALL BASES
  await Promise.all(
    bases.map(async (base) => {
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
    })
  )
  console.log('Stats processing complete!')
})

module.exports = job
