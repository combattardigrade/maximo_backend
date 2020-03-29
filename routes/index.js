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
router.get('/workOrder/:wonum', auth, maximoController.getWorkOrder)
router.get('/asset/:assetnum', auth, maximoController.getAsset)
router.get('/jobPlan/:jpnum', auth, maximoController.getJobPlan)
router.get('/location/:location', auth, maximoController.getLocation)
router.get('/locations', auth, maximoController.getLocations)
router.post('/findLocation', auth, maximoController.findLocation)
router.get('/labor/:laborcode', auth, maximoController.getLabor)
router.get('/whoami', auth, maximoController.getWhoAmI)
router.get('/assets', auth, maximoController.getAssets)
router.post('/findAsset', auth, maximoController.findAsset)
router.get('/assetSafety/:assetnum', auth, maximoController.getAssetSafetyData)
router.get('/woSafety/:wonum', auth, maximoController.getWOSafetyData)
router.get('/inventory', auth, maximoController.getInventory)
router.post('/findInventoryItem', auth, maximoController.findInventoryItem)
router.post('/findWorkOrder', auth, maximoController.findWorkOrder)
router.post('/checkWOHazardVerification', auth, maximoController.checkWOHazardVerification)
router.post('/sendWOHazardVerification', auth, maximoController.sendWOHazardVerification)
router.post('/getLaborCatalog', auth, maximoController.getLaborCatalog)
router.get('/getFailureCodes', auth, maximoController.getFailureCodes)
router.post('/findFailureCode', auth, maximoController.findFailureCode)
router.post('/findMaterial', auth, maximoController.findMaterial)
router.get('/getMaterials', auth, maximoController.getMaterials)


router.post('/task/updateStatus', auth, maximoController.updateTaskStatus)
router.post('/createWO', auth, maximoController.createWO)

router.get('/test', auth, testController.test)

module.exports = router

