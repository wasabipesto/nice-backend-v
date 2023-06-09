const createError = require('http-errors')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const logger = require('morgan')

const dashboardRouter = require('./routes/dashboard.js')
const settingsRouter = require('./routes/settings.js')
const basesRouter = require('./routes/bases.js')
const numbersRouter = require('./routes/numbers.js')
const fieldsRouter = require('./routes/fields.js')
const historyRouter = require('./routes/history.js')

const claimDetailedRouter = require('./routes/claim_detailed.js')
const claimNiceOnlyRouter = require('./routes/claim_niceonly.js')
const submitDetailedRouter = require('./routes/submit_detailed.js')
const submitNiceOnlyRouter = require('./routes/submit_niceonly.js')

const app = express()

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

app.use('/api/dashboard', dashboardRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/bases', basesRouter)
app.use('/api/numbers', numbersRouter)
app.use('/api/fields', fieldsRouter)
app.use('/api/history', historyRouter)

app.use('/api/claim/detailed', claimDetailedRouter)
app.use('/api/claim/niceonly', claimNiceOnlyRouter)
app.use('/api/submit/detailed', submitDetailedRouter)
app.use('/api/submit/niceonly', submitNiceOnlyRouter)

// start scheduled jobs
if (app.get('env') === 'production') {
  const scheduledJob = require('./routes/scheduled.js')
  scheduledJob.job()
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

// handle uncaught exceptions
process.on('uncaughtException', function (err) {
  console.error(err)
  console.error('Uncaught exception occurred.')
})

module.exports = app
