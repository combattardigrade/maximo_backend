require('dotenv').load()
const cors = require('cors')
const express = require('express')
const pathc = require('path')
const bodyParser = require('body-parser')
const passport = require('passport')
const fileUpload = require('express-fileupload')
// require('./api/config/passport')
const session = require('express-session')
const routesApi = require('./routes/index')
const app = express()
app.use(session({secret: '&25653666%^'}));
app.use(cors({ origin: '*' }))
app.use(fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }))
app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
app.use(passport.initialize())
app.use('/api', routesApi)

app.use((err, req, res, next) => {
	if (err.name === 'UnauthorizedError') {
		res.status(401)
		res.json({ message: err.name + ': ' + err.message })
	}
})

if (process.env.NODE_ENV === 'production') {
	app.set('port', process.env.PORT || 3000);
	app.listen(app.get('port'), function () {
		console.log('Listening on port ' + app.get('port'));
	});
} else if (process.env.NODE_ENV === 'dev') {
	app.set('port', process.env.PORT || 3000);
	app.listen(app.get('port'), function () {
		console.log('Listening on port ' + app.get('port'));
	});
}

module.exports = app