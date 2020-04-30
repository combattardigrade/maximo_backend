const Maximo = require('ibm-maximo-api')
const jwt = require('jsonwebtoken')
const rp = require('request-promise')
const https = require('https')
const xml2js = require('xml2js')
const parser = new xml2js.Parser({ attrkey: "ATTR" })
var Q = require('q');
var fs = require("fs");
var request = require('request');


sendJSONresponse = function (res, status, content) {
    res.status(status)
    res.json(content)
}

module.exports.authentication = (req, res) => {
    const user = req.body.user
    const password = req.body.password

    if (!user || !password) {
        sendJSONresponse(res, 422, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options);
    maximo.resourceobject("MXAPIWODETAIL")
        // .select(["wonum", "description", "description_longdescription", "assetnum", 
        // "location", "worktype", "wopriority", "gb_abc", "status", "schedstart", "schedfinish", 
        // "supervisor", "reportdate", "estdur", "taskid", ])
        .where("status").in(["INPRG", "APPR"])
        .orderby('wonum', 'desc')
        .pagesize(1)
        .fetch()
        .then(async function (resourceset) {


            if (((resourceset || {}).resourcemboset || {}).Error) {
                sendJSONresponse(res, 401, { status: 'ERROR', message: resourceset.resourcemboset.Error.message })
                return
            }

            const expiry = new Date()
            expiry.setDate(expiry.getDate() + 7)
            const token = await jwt.sign({
                user: user,
                password: password,
                exp: parseInt(expiry.getTime() / 1000)
            }, process.env.JWT_SECRET)

            sendJSONresponse(res, 200, { status: 'OK', payload: token })
            return
        })
        .fail(function (error) {
            console.log(error)
            sendJSONresponse(res, 401, { status: 'ERROR', message: 'Ocurrió un error al intentar realizar la operación' })
            return
        })
}

module.exports.getWorkOrders = async (req, res) => {
    const user = req.user.user
    const password = req.user.password

    if (!user || !password) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Inicia sesión para realizar la operación' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options);
    let workOrders = await maximo.resourceobject("MXAPIWODETAIL")
        .select(["wonum", "description", "description_longdescription", "assetnum",
            "location", "location.description", "worktype", "wopriority", "gb_abc", "status", "schedstart", "schedfinish",
            "supervisor", "reportdate", "estdur", "taskid", "targstartdate", "jobtaskid", "jpnum",])
        .where("status").in(["INPRG", "APPR"])
        .orderby('wonum', 'desc')
        .pagesize(10)
        .fetch()

    workOrders = workOrders.thisResourceSet()

    let assetPromiseArray = []
    let jobPlanPromiseArray = []

    for (let i = 0; i < workOrders.length; i++) {
        let asset = maximo.resourceobject("MXAPIASSET")
            .select(["wonum", "description"])
            .where("assetnum").in([workOrders[i].assetnum])
            .fetch()
        assetPromiseArray.push(asset)

        // let jobPlan = maximo.resourceobject("REP_JOBPLAN")
        //     .select(['*'])
        //     .where("jpnum").in([workOrders[i].jpnum])
        //     .fetch()
        // jobPlanPromiseArray.push(jobPlan)
    }

    let assetResults = await Promise.all(assetPromiseArray)
    for (let i = 0; i < workOrders.length; i++) {
        let asset = (assetResults[i].thisResourceSet())[0]
        workOrders[i].asset = asset
    }

    // let jobPlanResults = await Promise.all(jobPlanPromiseArray)
    // for (let i = 0; i < jobPlanResults.length; i++) {
    //     let jobPlan = (jobPlanResults[i].thisResourceSet())[0]
    //     workOrders[i].jobPlan = jobPlan
    // }
    sendJSONresponse(res, 200, { status: 'OK', payload: workOrders })
    return
}

module.exports.getAsset = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const assetnum = req.params.assetnum

    if (!user || !password || !assetnum) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Inicia sesión para realizar la operación' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let jsondata = await maximo.resourceobject("MXAPIASSET")
        .select(["wonum", "description"])
        .where("assetnum").in([assetnum])
        .fetch()

    let asset
    try {
        asset = (jsondata.thisResourceSet())[0]
    }
    catch (e) {
        console.log(e)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

    sendJSONresponse(res, 200, { status: 'OK', payload: asset })
    return
}

module.exports.getJobPlan = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const jpnum = req.params.jpnum

    if (!user || !password || !jpnum) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let jsondata = await maximo.resourceobject("REP_JOBPLAN")
        .select(["*"])
        .where("jpnum").in([jpnum])
        .fetch()

    let jobPlan
    try {
        jobPlan = (jsondata.thisResourceSet())[0]
    }
    catch (e) {
        console.log(e)
        console.log(jsondata)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

    sendJSONresponse(res, 200, { status: 'OK', payload: jobPlan })
    return
}

module.exports.getWorkOrder = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const wonum = req.params.wonum

    if (!user || !password || !wonum) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    // with actual
    const maximo = new Maximo(options)

    let woActualJson = maximo.resourceobject("MXAPIWODETAIL") // MXWODETAIL
        .select(["wonum","wplabor","labtrans","wpmaterial","assetnum","location","matusetrans","supervisor"])
        .where("wonum").equal([wonum])
        .fetch()
    let woPlansJson = maximo.resourceobject("MXWODETAIL") // with plans
        .select(["*"])
        .where("wonum").equal([wonum])
        .fetch()


    let response = await Promise.all([woActualJson, woPlansJson])

    let woActual = (response[0].thisResourceSet())[0]
    let woPlans = (response[1].thisResourceSet())[0]



    try {
        // Get completed hrs
        for (let i = 0; i < woActual.wplabor.length; i++) {
            let taskid = woActual.wplabor[i].taskid
            let laborhrscompleted = 0
            for (let j = 0; j < woActual.labtrans.length; j++) {
                if (taskid != woActual.labtrans[j].taskid) continue
                laborhrscompleted += parseInt(woActual.labtrans[j].regularhrs)
            }
            woActual.wplabor[i].laborhrscompleted = laborhrscompleted
        }
    }
    catch (e) {
        console.log('Error getting completed hrs')
    }

    try {
        // Get used materials
        for (let i = 0; i < woActual.wpmaterial.length; i++) {
            let itemnum = woActual.wpmaterial[i].itemnum
            let itemqtyused = 0
            for (let j = 0; j < woActual.matusetrans.length; j++) {
                if (itemnum != woActual.matusetrans[j].itemnum) continue
                itemqtyused += parseInt(woActual.matusetrans[j].quantity) * -1
            }
            woActual.wpmaterial[i].itemqtyused = itemqtyused
        }
    }
    catch (e) {
        console.log('Error getting used materials')
    }

    let asset = maximo.resourceobject("MXAPIASSET")
        .select(["description"])
        .where("assetnum").in([woActual.assetnum])
        .fetch()
    let location = maximo.resourceobject("MXAPILOCATION")
        .select(["locations.description"])
        .where("location").in([woActual.location])
        .fetch()
    response = await Promise.all([asset, location])
    asset = (response[0].thisResourceSet())[0]
    location = (response[1].thisResourceSet())[0]

    let wo = {
        ...woActual,
        ...woPlans,
        assetDescription: asset && asset.description,
        locationDetails: location
    }
    sendJSONresponse(res, 200, { status: 'OK', payload: wo })
    return
}

module.exports.getLocation = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const location = req.params.location

    if (!user || !password || !location) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let jsondata = await maximo.resourceobject("MXAPILOCATION")
        .select(["*"])
        .where("location").in([location])
        .fetch()

    let locationResponse
    try {
        locationResponse = (jsondata.thisResourceSet())[0]
    }
    catch (e) {
        console.log(e)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

    sendJSONresponse(res, 200, { status: 'OK', payload: locationResponse })
    return
}

module.exports.getLabor = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const laborcode = req.params.laborcode

    if (!user || !password || !laborcode) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let jsondata = await maximo.resourceobject("MXAPILABOR")
        .select(["*"])
        .where("laborcode").in([laborcode])
        .fetch()
    console.log(jsondata)
    let labor
    try {
        labor = (jsondata.thisResourceSet())[0]
    }
    catch (e) {
        console.log(e)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

    sendJSONresponse(res, 200, { status: 'OK', payload: labor })
    return
}

module.exports.getWhoAmI = async (req, res) => {
    const user = req.user.user
    const password = req.user.password

    if (!user || !password) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const URL = 'https://' + process.env.MAXIMO_HOSTNAME + `/maximo/oslc/whoami?_lid=${user}&_lpwd=${password}`

    let response
    try {
        response = await rp(URL)
    } catch (e) {
        console.log(e)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
    }

    response = JSON.parse(response)

    if (!response) {
        console.log(response)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

    sendJSONresponse(res, 200, { status: 'OK', payload: response })
    return
}

module.exports.getAssets = async (req, res) => {
    const user = req.user.user
    const password = req.user.password

    if (!user || !password) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Inicia sesión para realizar la operación' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let resourceset

    try {

        resourceset = await maximo.resourceobject("MXAPIASSET")
            .select(["*"])
            .pagesize(50)
            .fetch()

        if (resourceset) {
            let assets = resourceset.thisResourceSet()
            sendJSONresponse(res, 200, { status: 'OK', payload: assets })
            return
        }
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

}

function getMBO(params) {
    const url = `https://${process.env.MAXIMO_HOSTNAME}/maxrest/rest/mbo/${params.mbo}?${params.searchParam}=${params.searchValue}&_lid=${params.user}&_lpwd=${params.password}`
    return new Promise(function (resolve, reject) {
        try {
            https.get(url, function (res) {
                let data = ''
                res.on('data', function (stream) {
                    data += stream
                });
                res.on('end', function () {
                    parser.parseString(data, function (error, result) {
                        if (error === null) {
                            resolve(result)
                        }
                        else {
                            reject(error)
                        }
                    })
                })
            })
        }
        catch (err) {
            console.log(err)
            reject(err)
        }
    })
}

module.exports.findAsset = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const method = req.body.method
    const value = req.body.value

    if (!user || !password || !method || !value) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Inicia sesión para realizar la operación' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let resourceset

    try {

        if (method == 'assetnum') {
            resourceset = await maximo.resourceobject("MXASSET") // MXAPIASSET ?
                .select(["*"])
                .where("assetnum").in([value])
                .pagesize(50)
                .fetch()
        } else if (method == 'location') {
            resourceset = await maximo.resourceobject("MXASSET") // MXAPIASSET ?
                .select(["*"])
                .where("location").in([value])
                .pagesize(50)
                .fetch()
        }

        if (resourceset) {
            let asset = resourceset.thisResourceSet()

            // Get
            //console.log(hazardId)
            sendJSONresponse(res, 200, { status: 'OK', payload: asset })
            return
        }
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

}

module.exports.getAssetSafetyData = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const assetnum = req.params.assetnum

    if (!user || !password || !assetnum) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    try {
        // Get HazardId     
        let mbo = await getMBO({ user, password, mbo: 'safetylexicon', searchParam: 'assetnum', searchValue: assetnum })
        let hazards
        try {
            hazards = mbo.SAFETYLEXICONMboSet.SAFETYLEXICON[0].HAZARDID
        }
        catch (e) {
            sendJSONresponse(res, 200, { status: 'OK', payload: [] })
            return
        }
        const hazardsArray = []
        for (let hazardId of hazards) {
            // Get Hazard Details
            mbo = await getMBO({ user, password, mbo: 'hazard', searchParam: 'hazardid', searchValue: hazardId })
            const hazard = mbo.HAZARDMboSet.HAZARD[0]


            // Get Precaution
            mbo = await getMBO({ user, password, mbo: 'hazardprec', searchParam: 'hazardid', searchValue: hazardId })
            const precaution = mbo.HAZARDPRECMboSet.HAZARDPREC[0]

            const hazardSafety = {
                hazardId,
                hazardDescription: hazard.DESCRIPTION,
                precautionId: precaution.PRECAUTIONID,
                precautionDescription: precaution.DESCRIPTION
            }

            hazardsArray.push(hazardSafety)
        }

        sendJSONresponse(res, 200, { status: 'OK', payload: hazardsArray })
        return
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un erro al intentar obtener la información' })
    }
}

module.exports.getWOSafetyData = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const wonum = req.params.wonum

    if (!user || !password || !wonum) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    try {
        // Get HazardId     
        let mbo = await getMBO({ user, password, mbo: 'safetylexicon', searchParam: 'wonum', searchValue: wonum })
        let hazards
        try {
            hazards = mbo.SAFETYLEXICONMboSet.SAFETYLEXICON

        }
        catch (e) {
            sendJSONresponse(res, 200, { status: 'OK', payload: [] })
            return
        }

        const hazardsArray = []
        const uniqueIds = []

        for (let i = 0; i < hazards.length; i++) {

            let hazardId

            try {
                // HazardId               
                hazardId = hazards[i].HAZARDID[0]
                if (uniqueIds.includes(hazardId)) {
                    continue;
                }
                uniqueIds.push(hazardId)
            }
            catch (e) {
                break;
            }

            // Get Hazard Details
            mbo = await getMBO({ user, password, mbo: 'hazard', searchParam: 'hazardid', searchValue: hazardId })
            let hazard = mbo.HAZARDMboSet.HAZARD[0]

            // Get Precaution
            mbo = await getMBO({ user, password, mbo: 'hazardprec', searchParam: 'hazardid', searchValue: hazardId })

            let hazardDescription, precautionId, precautionDescription

            try {
                hazardDescription = hazard.DESCRIPTION[0]
            } catch (e) {
                hazardDescription: ''
            }

            try {
                let precaution = mbo.HAZARDPRECMboSet.HAZARDPREC[0]
                precautionId = precaution.PRECAUTIONID[0]
            } catch (e) {
                precautionId: ''
            }

            try {
                let precaution = mbo.HAZARDPRECMboSet.HAZARDPREC[0]
                precautionDescription = precaution.DESCRIPTION[0]
            } catch (e) {
                precautionDescription: ''
            }

            const hazardSafety = {
                hazardId,
                hazardDescription,
                precautionId,
                precautionDescription
            }

            hazardsArray.push(hazardSafety)
        }


        sendJSONresponse(res, 200, { status: 'OK', payload: hazardsArray })
        return
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un erro al intentar obtener la información' })
    }
}

module.exports.getInventory = async (req, res) => {
    const user = req.user.user
    const password = req.user.password

    if (!user || !password) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Inicia sesión para realizar la operación' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let resourceset

    try {

        resourceset = await maximo.resourceobject("REP_INVENTORY") // MXITEM // MXINVENTORY 
            .select(["*"])
            .pagesize(20)
            .fetch()
        console.log(resourceset)
        if (resourceset) {
            let inventory = resourceset.thisResourceSet()
            let itemsPromiseArray = []

            for (let i = 0; i < inventory.length; i++) {
                let item = maximo.resourceobject("MXITEM")
                    .select(["*"])
                    .where("itemnum").in([inventory[i].itemnum])
                    .pagesize(1)
                    .fetch()
                itemsPromiseArray.push(item)
            }

            let items = await Promise.all(itemsPromiseArray)

            for (let i = 0; i < inventory.length; i++) {
                inventory[i].itemDetails = await (items[i].thisResourceSet())[0]
            }


            sendJSONresponse(res, 200, { status: 'OK', payload: inventory })
            return
        }
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

}

module.exports.findInventoryItem = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const method = req.body.method
    const value = req.body.value

    if (!user || !password || !method || !value) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Inicia sesión para realizar la operación' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let resourceset

    try {

        if (method == 'itemnum') {
            resourceset = await maximo.resourceobject("MXINVENTORY")
                .select(["*"])
                .pagesize(20)
                .fetch()
        } else if (method == 'location') {
            resourceset = await maximo.resourceobject("MXINVENTORY")
                .select(["*"])
                .where("location").in([value])

                .fetch()
        }
        console.log(resourceset)
        if (resourceset) {
            let inventory = resourceset.thisResourceSet()
            let itemsPromiseArray = []

            for (let i = 0; i < inventory.length; i++) {
                let item = maximo.resourceobject("MXITEM")
                    .select(["*"])
                    .where("itemnum").in([inventory[i].itemnum])
                    .pagesize(1)
                    .fetch()
                itemsPromiseArray.push(item)
            }

            let items = await Promise.all(itemsPromiseArray)

            for (let i = 0; i < inventory.length; i++) {
                inventory[i].itemDetails = await (items[i].thisResourceSet())[0]
            }


            sendJSONresponse(res, 200, { status: 'OK', payload: inventory })
            return
        }
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

}

module.exports.updateTaskStatus = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    let woHref = req.body.woHref
    const taskHref = req.body.taskHref
    const status = req.body.status

    if (!user || !password || !woHref || !taskHref || !status) {
        sendJSONresponse(res, 422, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    woHref = woHref.split('/')
    woHref = woHref[woHref.length - 1]

    // Creating and updating resoruces
    // https://developer.ibm.com/static/site-id/155/maximodev/restguide/Maximo_Nextgen_REST_API.html#_creating_and_updating_resources


    let response = await rp({
        uri: `https://${process.env.MAXIMO_HOSTNAME}/maximo/oslc/os/mxapiwodetail/${woHref}?_lid=${user}&_lpwd=${password}`,
        method: 'POST',
        body: {
            'spi:woactivity': [{
                'rdf:about': taskHref,
                'spi:status': status
            }]
        },
        headers: {
            'x-method-override': 'PATCH',
            'patchtype': 'MERGE',
            'properties': 'spi:woactivity',

        },
        json: true
    })

    sendJSONresponse(res, 200, { status: 'OK', payload: response })
    return
    // let response = await rp({
    //     uri: `https://${process.env.MAXIMO_HOSTNAME}/maximo/oslc/os/mxwo/_QkVERk9SRC8xNTMx?_lid=maximo&_lpwd=maxpass1`,
    //     method: 'POST',
    //     body: {
    //         'spi:status': 'COMP'
    //     },
    //     headers: {
    //         'Authorization': auth,
    //         'x-method-override': 'PATCH',
    //         'properties': '*',

    //     },
    //     json: true
    // })
}

module.exports.updateWOStatus = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    let woHref = req.body.woHref
    const status = req.body.status

    if (!user || !password || !woHref || !status) {
        sendJSONresponse(res, 422, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    woHref = woHref.split('/')
    woHref = woHref[woHref.length - 1]

    // Creating and updating resoruces
    // https://developer.ibm.com/static/site-id/155/maximodev/restguide/Maximo_Nextgen_REST_API.html#_creating_and_updating_resources


    let response = await rp({
        uri: `https://${process.env.MAXIMO_HOSTNAME}/maximo/oslc/os/mxapiwodetail/${woHref}?_lid=${user}&_lpwd=${password}`,
        method: 'POST',
        body: {
            'spi:status': 'COMP'
        },
        headers: {
            'x-method-override': 'PATCH',
            'properties': 'spi:status',

        },
        json: true
    })

    sendJSONresponse(res, 200, { status: 'OK', payload: response })
    return

}

module.exports.findWorkOrder = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const method = req.body.method
    const value = req.body.value

    if (!user || !password || !method || !value) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)


    try {
        let resourceset
        if (method == 'wonum') {
            resourceset = await maximo.resourceobject("MXAPIWODETAIL")
                .select(["wonum", "description", "description_longdescription", "assetnum",
                    "location", "location.description", "worktype", "wopriority", "gb_abc", "status", "schedstart", "schedfinish",
                    "supervisor", "reportdate", "estdur", "taskid", "targstartdate", "jobtaskid", "jpnum",])
                .where("wonum").in([value])
                .orderby('wonum', 'desc')
                .pagesize(20)
                .fetch()
        } else if (method == 'description') {
            resourceset = await maximo.resourceobject("MXAPIWODETAIL")
                .select(["wonum", "description", "description_longdescription", "assetnum",
                    "location", "location.description", "worktype", "wopriority", "gb_abc", "status", "schedstart", "schedfinish",
                    "supervisor", "reportdate", "estdur", "taskid", "targstartdate", "jobtaskid", "jpnum",])
                .where("description").in([value])
                .orderby('wonum', 'desc')
                .pagesize(20)
                .fetch()
        }

        let workOrders = resourceset.thisResourceSet()

        if (workOrders) {
            let assetPromiseArray = []


            for (let i = 0; i < workOrders.length; i++) {
                let asset = maximo.resourceobject("MXAPIASSET")
                    .select(["wonum", "description"])
                    .where("assetnum").in([workOrders[i].assetnum])
                    .fetch()
                assetPromiseArray.push(asset)
            }

            let assetResults = await Promise.all(assetPromiseArray)
            for (let i = 0; i < workOrders.length; i++) {
                let asset = (assetResults[i].thisResourceSet())[0]
                workOrders[i].asset = asset
            }

            sendJSONresponse(res, 200, { status: 'OK', payload: workOrders })
            return
        }
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }
}

module.exports.checkWOHazardVerification = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const wonum = req.body.wonum

    if (!user || !password || !wonum) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)


    try {

        let woRequest = maximo.resourceobject("MXAPIWODETAIL")
            .select(["worklog"])
            .where("wonum").in([wonum])
            .pagesize(20)
            .fetch()

        // Get user
        let userRequest = rp('https://' + process.env.MAXIMO_HOSTNAME + `/maximo/oslc/whoami?_lid=${user}&_lpwd=${password}`)

        let response = await Promise.all([woRequest, userRequest])
        let workOrder = (response[0].thisResourceSet())[0]
        let myUser = JSON.parse(response[1])

        let logs = []
        if ('worklog' in workOrder) {
            logs = workOrder.worklog.filter((log) => {
                if (log.createby != myUser.personid) return false
                if (log.description != 'HAZARD VERIFICATION') return false
                return log
            })
        }

        sendJSONresponse(res, 200, { status: 'OK', payload: logs })
        return
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }
}

module.exports.sendWOHazardVerification = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const wonum = req.body.wonum

    if (!user || !password || !wonum) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let resourceset = await maximo.resourceobject("MXAPIWODETAIL")
        .select(["href"])
        .where("wonum").in([wonum])
        .pagesize(20)
        .fetch()
    let workOrder = (resourceset.thisResourceSet())[0]
    let woHref = workOrder.href
    woHref = woHref.split('/')
    woHref = woHref[woHref.length - 1]

    try {

        let response = await rp({
            uri: `https://${process.env.MAXIMO_HOSTNAME}/maximo/oslc/os/mxapiwodetail/${woHref}?_lid=${user}&_lpwd=${password}`,
            method: 'POST',
            body: {
                'spi:href': workOrder.href,
                'spi:worklog': [{
                    'spi:description': 'HAZARD VERIFICATION',
                    'spi:description_longdescription': 'Tengo permiso de trabajo Aprobado para trabajos riesgosos. Cuento con el equipo y protección necesaria. Realicé LoTo antes de intervenir equipo.'
                }]
            },
            headers: {
                'x-method-override': 'PATCH',
                'patchtype': 'MERGE',
                'properties': 'spi:worklog',
            },
            json: true
        })



        sendJSONresponse(res, 200, { status: 'OK', payload: response })
        return
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }
}

module.exports.getLaborCatalog = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const totalResults = req.body.totalResults ? req.body.totalResults : 20
    const searchMethod = req.body.searchMethod
    const searchValue = req.body.searchValue

    if (!user || !password) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Inicia sesión para realizar la acción' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    try {
        const maximo = new Maximo(options)
        let resourceset

        if (!searchMethod) {
            resourceset = await maximo.resourceobject("MXLABOR")
                .select(["status_description", "laborid", "_rowstamp", "person", "personid",])
                .pagesize(totalResults)
                .fetch()

        }
        else if (searchMethod == 'personid') {
            resourceset = await maximo.resourceobject("MXLABOR")
                .select(["status_description", "laborid", "_rowstamp", "person", "personid",])
                .where("person.personid").in([searchValue])

                .pagesize(totalResults)
                .fetch()
        }
        else if (searchMethod == 'displayname') {
            resourceset = await maximo.resourceobject("MXLABOR")
                .select(["status_description", "laborid", "_rowstamp", "person", "personid",])
                .where("person.displayname").in([searchValue])
                .pagesize(totalResults)
                .fetch()
        }

        const labor = resourceset.thisResourceSet()
        sendJSONresponse(res, 200, { status: 'OK', payload: labor })
        return
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

}

module.exports.getLocations = async (req, res) => {
    const user = req.user.user
    const password = req.user.password


    if (!user || !password) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)
    let jsondata = await maximo.resourceobject("MXAPILOCATIONS")
        .select(["*"])
        .pagesize(20)
        .fetch()
    console.log(jsondata)
    let locationResponse
    try {
        locationResponse = jsondata.thisResourceSet()
    }
    catch (e) {
        console.log(e)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }
    console.log(jsondata)
    sendJSONresponse(res, 200, { status: 'OK', payload: locationResponse })
    return

}

module.exports.findLocation = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const method = req.body.method
    const value = req.body.value

    if (!user || !password || !method || !value) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)


    try {
        let resourceset
        if (method == 'location') {
            resourceset = await maximo.resourceobject("MXAPILOCATIONS")
                .select(["*"])
                .where("location").in([value])
                .pagesize(5)
                .fetch()
        } else if (method == 'siteid') {
            resourceset = await maximo.resourceobject("MXAPIWODETAIL")
                .select(["*"])
                .where("siteid").in([value])
                .pagesize(5)
                .fetch()
        }

        let locations = resourceset.thisResourceSet()
        sendJSONresponse(res, 200, { status: 'OK', payload: locations })
        return

    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }
}

module.exports.getFailureCodes = async (req, res) => {
    const user = req.user.user
    const password = req.user.password


    if (!user || !password) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    try {


        const url = `https://${process.env.MAXIMO_HOSTNAME}/maxrest/rest/mbo/FAILURECODE?_lid=${user}&_lpwd=${password}&_maxItems=20`
        console.log(url)
        const response = await new Promise(function (resolve, reject) {
            try {
                https.get(url, function (res) {
                    let data = ''
                    res.on('data', function (stream) {
                        data += stream
                    });
                    res.on('end', function () {
                        parser.parseString(data, function (error, result) {
                            if (error === null) {
                                resolve(result)
                            }
                            else {
                                reject(error)
                            }
                        })
                    })
                })
            }
            catch (err) {
                console.log(err)
                reject(err)
                sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
            }
        })

        if (!('FAILURECODE' in response.FAILURECODEMboSet)) {
            sendJSONresponse(res, 404, { status: 'ERROR', message: 'No se encontraron resultados' })
            return
        }

        let failureCodes = response.FAILURECODEMboSet.FAILURECODE.map((failureCode) => {
            return {
                failureCode: 'FAILURECODE' in failureCode && failureCode.FAILURECODE[0],
                description: 'DESCRIPTION' in failureCode && failureCode.DESCRIPTION[0],
                failureCodeId: 'FAILURECODE' in failureCode && failureCode.FAILURECODEID[0],
                _rowstamp: 'ATTR' in failureCode && failureCode.ATTR.rowstamp
            }
        })

        sendJSONresponse(res, 200, { status: 'OK', payload: failureCodes, count: failureCodes.length })
        return
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }

}

module.exports.findFailureCode = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const searchParam = req.body.searchParam
    const searchValue = req.body.searchValue

    if (!user || !password || !searchParam || !searchValue) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    try {
        const url = `https://${process.env.MAXIMO_HOSTNAME}/maxrest/rest/mbo/FAILURECODE?${searchParam}=${searchValue}&_lid=${user}&_lpwd=${password}`
        const response = await new Promise(function (resolve, reject) {
            try {
                https.get(url, function (res) {
                    let data = ''
                    res.on('data', function (stream) {
                        data += stream
                    });
                    res.on('end', function () {
                        parser.parseString(data, function (error, result) {
                            if (error === null) {
                                resolve(result)
                            }
                            else {
                                reject(error)
                            }
                        })
                    })
                })
            }
            catch (err) {
                console.log(err)
                reject(err)
                sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
            }
        })

        let failureCode = response.FAILURECODEMboSet.FAILURECODE

        if (!('FAILURECODE' in response.FAILURECODEMboSet)) {
            sendJSONresponse(res, 404, { status: 'ERROR', message: 'No se encontraron resultados' })
            return
        }

        let payload = {
            failureCode: failureCode[0].FAILURECODE[0],
            description: failureCode[0].DESCRIPTION[0],
            failureCodeId: failureCode[0].FAILURECODEID[0],
            _rowstamp: failureCode[0].ATTR.rowstamp
        }

        sendJSONresponse(res, 200, { status: 'OK', payload: [payload] })
        return
    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }
}

module.exports.createWO = async (req, res) => {
    const assetnum = req.body.assetnum
    const location = req.body.location
    const worktype = req.body.worktype
    const wopriority = req.body.wopriority
    const actlabhrs = req.body.actlabhrs
    const downtime = req.body.downtime // check format
    const comments = req.body.comments // worklog
    const failurecode = req.body.failurecode
    const matusetran = req.body.matusetran // check how to insert matusetran
    const documentdata = req.body.documentdata // check how to add multiple files
    // Handling attachments
    // https://developer.ibm.com/static/site-id/155/maximodev/restguide/Maximo_Nextgen_REST_API.html#_creating_and_updating_resources

    let response = await rp({
        uri: `https://${process.env.MAXIMO_HOSTNAME}/maximo/oslc/os/mxapiwodetail/`,
        method: 'POST',
        body: {
            'spi:woactivity': [{
                'rdf:about': taskHref,
                'spi:status': status
            }],
            'spi:worklog': [{
                'spi:description': 'HAZARD VERIFICATION',
                'spi:description_longdescription': 'Tengo permiso de trabajo Aprobado para trabajos riesgosos. Cuento con el equipo y protección necesaria. Realicé LoTo antes de intervenir equipo.'
            }]
        },

        json: true
    })

    sendJSONresponse(res, 200, { status: 'OK', payload: response })
    return
}

module.exports.getMaterials = async (req, res) => {
    const user = req.user.user
    const password = req.user.password

    if (!user || !password) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)

    try {
        let resourceset

        resourceset = await maximo.resourceobject("MXMATERIAL")
            .select(["*"])
            .pagesize(20)
            .fetch()


        let materials = resourceset.thisResourceSet()
        sendJSONresponse(res, 200, { status: 'OK', payload: materials })
        return

    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }
}

module.exports.findMaterial = async (req, res) => {
    const user = req.user.user
    const password = req.user.password
    const method = req.body.method
    const value = req.body.value

    if (!user || !password || !method || !value) {
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    const options = {
        protocol: 'https',
        hostname: process.env.MAXIMO_HOSTNAME,
        port: process.env.MAXIMO_PORT,
        user: user,
        password: password,
        auth_scheme: '/maximo',
        authtype: 'maxauth',
        islean: 1
    }

    const maximo = new Maximo(options)


    try {
        let resourceset
        if (method == 'location') {
            resourceset = await maximo.resourceobject("MXMATERIAL")
                .select(["*"])
                .where("location").in([value])
                .fetch()
        } else if (method == 'itemnum') {
            resourceset = await maximo.resourceobject("MXMATERIAL")
                .select(["*"])
                .where("itemnum").in([value])
                .fetch()
        } else if (method == 'description') {
            resourceset = await maximo.resourceobject("MXMATERIAL")
                .select(["*"])
                .where("description").in([value])
                .fetch()
        } else {
            resourceset = await maximo.resourceobject("MXMATERIAL")
                .select(["*"])
                .pagesize(20)
                .fetch()
        }
        console.log(resourceset)
        let locations = resourceset.thisResourceSet()
        sendJSONresponse(res, 200, { status: 'OK', payload: locations })
        return

    }
    catch (err) {
        console.log(err)
        sendJSONresponse(res, 404, { status: 'ERROR', message: 'Ocurrió un error al intentar obtener los datos' })
        return
    }
}

// Report of Work Done
module.exports.createReportOfWorkDone = async (req, res) => {
    const user = req.user.user
    const password = req.user.password

    // WO
    const description = req.body.description
    const assetnum = req.body.assetnum
    const siteid = req.body.siteid
    const location = req.body.location
    const worktype = req.body.worktype
    const wopriority = req.body.wopriority 
    const downtime = req.body.downtime
    const description_longdescription = req.body.description_longdescription
    const failurecode = req.body.failurecode
    const actlabhrs = req.body.actlabhrs

    if (!user || !password) {
        sendJSONresponse(res, 422, { status: 'ERROR', message: 'Ingresa todos los campos requeridos' })
        return
    }

    if(!description || !assetnum || !siteid || !location || !worktype || !wopriority || !failurecode || !actlabhrs) {
        sendJSONresponse(res, 422, { status: 'ERROR', message: 'Ingresa todos los campos requeridos'})
        return
    }


    // Creating and updating resoruces
    // https://developer.ibm.com/static/site-id/155/maximodev/restguide/Maximo_Nextgen_REST_API.html#_creating_and_updating_resources


    let resourceset = await rp({
        uri: `https://${process.env.MAXIMO_HOSTNAME}/maximo/oslc/os/mxapiwodetail?_lid=${user}&_lpwd=${password}`,
        method: 'POST',
        body: {
            //'spi:wonum': '878789',
            'spi:assetnum': assetnum,
            'spi:description': description,
            'spi:siteid': siteid,
            'spi:location': location,
            'spi:worktype': worktype,
            'spi:wopriority': parseInt(wopriority),
            'spi:downtime': downtime == false ? false : true,
            'spi:description_longdescription': description_longdescription,
            'spi:failurecode': failurecode,
            'spi:actlabhrs': parseFloat(actlabhrs),
            'spi:status': 'COMP'
            // 'spi:doclinks': [
            //     {
            //         "spi:addinfo": false,
            //         "spi:docinfoid": 430,
            //         "spi:COPYLINKTOWO": "0",
            //         "spi:DESCRIPTION": "Example Attachment via REST API",
            //         "spi:DOCUMENT": "Test via Rest API",
            //         "spi:OWNERTABLE": "WORKORDER",
            //         "spi:UPLOAD": "1",
            //         "spi:NEWURLNAME": "www.ibm.com",
            //         "spi:urltype": "FILE",
            //         "spi:documentdata": "aGV5IGhvdyBhcmUgeW91",
            //         "spi:doctype": "Attachments",
            //         "spi:urlname": "SampleREST-Upload.txt",
            //         "spi:OWNERID": "320450"
            //     },

            // ],
            // 'spi:href': 'https://gbplant-200-dev.maximo.com:443/maximo/oslc/os/mxwodetail/_MTAyNC84Nzg3ODc-'
        },

        json: true
    })
    console.log(resourceset)
    //let wo = resourceset.thisResourceSet()
    sendJSONresponse(res, 200, { status: 'OK', payload: resourceset })
    return

}


module.exports.createAttachment = function (req, res) {
    const user = req.user.user
    const password = req.user.password
    const URL = `https://${process.env.MAXIMO_HOSTNAME}/maximo/oslc/os/RESTWODOCLINKS/_MTAyNC84Nzg3ODg-?_lid=${user}&_lpwd=${password}`
    request.post(URL, {
        form: {
            "wonum": "RESTTEST",
            "siteid": "BEDFORD",
            "orgid": "EAGLENA",

            "doclinks": [
                {
                    "ADDINFO": "1",
                    "COPYLINKTOWO": "0",
                    "DESCRIPTION": "Example Attachment via REST API",
                    "DOCUMENT": "Test via Rest API",
                    "OWNERTABLE": "WORKORDER",
                    "UPLOAD": "1",
                    "NEWURLNAME": "www.ibm.com",
                    "urltype": "FILE",
                    "documentdata": "aGV5IGhvdyBhcmUgeW91",
                    "doctype": "Attachments",
                    "urlname": "SampleREST-Upload.txt",
                    "OWNERID": "320450"
                }
            ]
        }
    }, function (err, response, body) {
        if (err) {
            console.error(err)
            return
        }
        sendJSONresponse(res, 200, { status: 'OK', payload: body })

        console.log(body)
    })
}

module.exports.createAttachment2 = function (req, res) {
    const user = req.user.user
    const password = req.user.password
    const URL = `https://${process.env.MAXIMO_HOSTNAME}/maxrest/rest/os/RESTWODOCLINKS?_lid=${user}&_lpwd=${password}`
    request.post(URL, {
        form: {
            SITEID: '1024',
            ADDINFO: '1',
            DOCUMENT: 'REST FILE',
            DESCRIPTION: 'TESTING REST DOC 2',
            OWNERTABLE: 'WORKORDER',
            OWNERID: '320450',
            DOCTYPE: 'Attachments',
            NEWURLNAME: 'www.ibm.co',
            URLNAME: 'SampleREST-Upload.txt',
            URLTYPE: 'FILE',
            DOCUMENTDATA: 'PT09PT09PT09PT09PT09PT09PT09PT0NCkludGVncmF0aW9uIEZyYW1ld29yaw0KPT09PT09PT09PT09PT09PT09PT09PT0NCg0KUHVyY2hhc2UgT3JkZXIgYXR0YWNobWVudCBURVNU'
        }
    }, function (err, response, body) {
        if (err) {
            console.error(err)
            return
        }

        console.log(response)
        console.log(body)
    })
}

function getFileBytes(path) {
    var deferred = Q.defer();
    var fileSize = 0
    var buf = new Buffer(fileSize);
    // ******** Start buffering the file bytes **********************
    fs.stat(path, function (err, stats) {
        if (err) {
            return console.error(err);
        }
        console.log(stats.size);
        fileSize = stats.size;
        buf = new Buffer(fileSize);
        var actualBytes = 0;
        fs.open(path, 'r', function (err, fd) {
            if (err) {
                return console.error(err);
            }
            console.log("Reading ... ");
            fs.read(fd, buf, 0, buf.length, 0, function (err, bytes) {
                if (err) {
                    console.log(err);
                }
                console.log(bytes + " bytes read");
                console.log("Actual Buffer Size: " + buf.slice(0, bytes).length);
                deferred.resolve(buf.slice(0, bytes));
                //return buf.slice(0,bytes);
            });
            // Close the opened file.
            fs.close(fd, function (err) {
                if (err) {
                    console.log(err);
                }
                console.log("File closed successfully.");
            });
        });
        //*******  End buffering file bytes ******
    });
    return deferred.promise;
}

// var decodedImage = new Buffer(imageData, 'base64').toString('binary');
// const options = {
//     protocol: 'https',
//     hostname: process.env.MAXIMO_HOSTNAME,
//     port: process.env.MAXIMO_PORT,
//     user: user,
//     password: password,
//     auth_scheme: '/maximo',
//     authtype: 'maxauth',
//     islean: 1
// }

// module.exports.createAttachment = async (req, res) => {
//     const maximo = new Maximo(options)
//     const attch = await maximo.resourceobject("MXWODETAIL")
//         .resource('https://gbplant-200-dev.maximo.com:443/maximo/oslc/os/mxwodetail/_MTAyNC84Nzg3ODc-')
//         .attachment({
//             name: 'pmr.doc',
//             description: 'PMR Recreation Steps',
//             type: 'FILE',
//             storeas: 'Attachment',
//             contentype: 'application/msword',
//             properties: '*'
//         })
// }

//     const maximo = new Maximo(options)
//     const attch = await maximo.resourceobject("MXWODETAIL")
//         .resource('https://gbplant-200-dev.maximo.com:443/maximo/oslc/os/mxwodetail/_MTAyNC84Nzg3ODc-')
//         .attachment({
//             name: 'pmr.doc',
//             description: 'PMR Recreation Steps',
//             type: 'FILE',
//             storeas: 'Attachment',
//             contentype: 'application/msword',
//             properties: '*'
//         })

//     // console.log(resourceset)
//     const response = await attch.create(decodedImage)
//     console.log("Writing Attachment response ");
//     console.log(response)        

//     sendJSONresponse(res, 200, { status: 'OK', payload: response })
//     return