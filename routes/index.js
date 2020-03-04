const express = require('express')
const router = express.Router()
const jwt = require('express-jwt')
const auth = jwt({
    secret: process.env.JWT_SECRET
})

const maximoController = require('../controllers/maximo')
const testController = require('../controllers/test')

router.post('/authentication', maximoController.authentication)
router.get('/workOrders', auth, maximoController.getWorkOrders)
router.get('/workOrderWithPlans/:wonum', auth, maximoController.getWorkOrderWithPlans)
router.get('/asset/:assetnum', auth, maximoController.getAsset)
router.get('/jobPlan/:jpnum', auth, maximoController.getJobPlan)
router.get('/test', auth, testController.test)

module.exports = router