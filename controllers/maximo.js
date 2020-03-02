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

module.exports.getWorkOrders = (req, res) => {
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
    maximo.resourceobject("MXAPIWODETAIL")
        // .select(["wonum", "description", "description_longdescription", "assetnum", 
        // "location", "worktype", "wopriority", "gb_abc", "status", "schedstart", "schedfinish", 
        // "supervisor", "reportdate", "estdur", "taskid", ])
        .where("status").in(["INPRG", "APPR"])
        .orderby('wonum', 'desc')
        .pagesize(20)
        .fetch()
        .then(function (resourceset) {
            jsondata = resourceset.thisResourceSet();
            
            sendJSONresponse(res, 200, jsondata)
        })
        .fail(function (error) {
            console.log('****** Error Code = ' + error);
        });
}