const https = require('https')
const xml2js = require('xml2js')
const parser = new xml2js.Parser({ attrkey: "ATTR" })

sendJSONresponse = function (res, status, content) {
    res.status(status)
    res.json(content)
}

function getXmlFromURL(params) {
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

module.exports.test = async (req, res) => {
    const user = req.user.user
    const password = req.user.password

    const mboOptions = {
        user, password,
        mbo: 'safetylexicon',
        searchParam: 'assetnum',
        searchValue: '84002'
    }

    let response = await getXmlFromURL(mboOptions)
    console.log(response)
    sendJSONresponse(res, 200, { status: 'OK', message: 'Hello World!' })
    return
}