const Maximo = require('ibm-maximo-api')
const jwt = require('jsonwebtoken')


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
            "supervisor", "reportdate", "estdur", "taskid","targstartdate"])
        .where("status").in(["INPRG", "APPR"])
        .orderby('wonum', 'desc')
        .pagesize(20)
        .fetch()

    workOrders = workOrders.thisResourceSet()

    let assetPromiseArray = []
    let locationPromiseArray = []

    for (let i = 0; i < workOrders.length; i++) {
        let asset = maximo.resourceobject("MXAPIASSET")
            .select(["wonum", "description"])
            .where("assetnum").in([workOrders[i].assetnum])
            .fetch()
        assetPromiseArray.push(asset)

        // let location = maximo.resourceobject("MXAPILOCATIONS")
        //     .select(['description'])
        //     .where("location").in([workOrders[i].location])
        //     .fetch()
        // locationPromiseArray.push(location)

    }

    let assetResults = await Promise.all(assetPromiseArray)
    for (let i = 0; i < workOrders.length; i++) {
        let asset = (assetResults[i].thisResourceSet())[0]
        workOrders[i].asset = asset
    }

    // let locationResults = await Promise.all(locationPromiseArray)
    // for (let i = 0; i < workOrders.length; i++) {
    //     let location = (locationResults[i].thisResourceSet())[0]
    //     console.log(location)
    //     workOrders[i].locationDetails = location
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

    let asset = (jsondata.thisResourceSet())[0]
    sendJSONresponse(res, 200, { status: 'OK', payload: asset })
    return
}