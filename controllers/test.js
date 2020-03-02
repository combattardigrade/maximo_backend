sendJSONresponse = function (res, status, content) {
    res.status(status)
    res.json(content)
}

module.exports.test = (req, res) => {
    console.log(req.user)
    sendJSONresponse(res, 200, { status: 'OK', message: 'Hello World!' })
    return
}