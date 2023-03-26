const createError = require('http-errors')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const logger = require('morgan')

const dashboardRouter = require('./routes/dashboard.js')
const claimDetailedRouter = require('./routes/claim_detailed.js')
const claimNiceOnlyRouter = require('./routes/claim_niceonly.js')
const submitDetailedRouter = require('./routes/submit_detailed.js')
const submitNiceOnlyRouter = require('./routes/submit_niceonly.js')
const statsJob = require('./scheduled/stats.js')
const maintenanceJob = require('./scheduled/maintenance.js')

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
app.use('/api/claim/detailed', claimDetailedRouter)
app.use('/api/claim/niceonly', claimNiceOnlyRouter)
app.use('/api/submit/detailed', submitDetailedRouter)
app.use('/api/submit/niceonly', submitNiceOnlyRouter)
statsJob.job()
maintenanceJob.job()

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

module.exports = app
