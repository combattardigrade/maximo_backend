const Maximo = require('ibm-maximo-api')
const jwt = require('jsonwebtoken')
const rp = require('request-promise')
const https = require('https')
const xml2js = require('xml2js')
const parser = new xml2js.Parser({ attrkey: "ATTR" })


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
        .pagesize(20)
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
        .pagesize(20)
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
    // let jsondata = await maximo.resourceobject("MXAPIWODETAIL") // MXWODETAIL
    //     .select(["*"])
    //     .where("wonum").in([wonum])
    //     .fetch()

    // let woActual = (jsondata.thisResourceSet())[0]

    // // with plans
    // jsondata = await maximo.resourceobject("MXWODETAIL") // with plans
    //     .select(["*"])
    //     .where("wonum").in([wonum])
    //     .fetch()

    // let woPlans = (jsondata.thisResourceSet())[0]

    let woActualJson = maximo.resourceobject("MXAPIWODETAIL") // MXWODETAIL
        .select(["*"])
        .where("wonum").in([wonum])
        .fetch()
    let woPlansJson = maximo.resourceobject("MXWODETAIL") // with plans
        .select(["*"])
        .where("wonum").in([wonum])
        .fetch()



    let response = await Promise.all([woActualJson, woPlansJson])
    let woActual = (response[0].thisResourceSet())[0]
    let woPlans = (response[1].thisResourceSet())[0]

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
        assetDescription: asset.description,
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

    let response = await rp('https://' + process.env.MAXIMO_HOSTNAME + `/maximo/oslc/whoami?_lid=${user}&_lpwd=${password}`)
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
                if(uniqueIds.includes(hazardId)) {
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
            let precaution = mbo.HAZARDPRECMboSet.HAZARDPREC[0]     

            const hazardSafety = {
                hazardId,
                hazardDescription: hazard.DESCRIPTION[0],
                precautionId: precaution.PRECAUTIONID[0],
                precautionDescription: precaution.DESCRIPTION[0]
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

        resourceset = await maximo.resourceobject("MXINVENTORY") // MXITEM ?
            .select(["*"])
            .pagesize(20)
            .fetch()

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
                .where("itemnum").in([value])
                .pagesize(10)
                .fetch()
        } else if (method == 'location') {
            resourceset = await maximo.resourceobject("MXINVENTORY")
                .select(["*"])
                .where("location").in([value])
                .pagesize(10)
                .fetch()
        }

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