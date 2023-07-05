const morgan = require('morgan')

const Logger = morgan('combined', {
    skip: function (req, res) {
        console.log(req)
    },
})

module.exports = { Logger }
