const express = require('express')
const router = express.Router()
const axios = require('axios')

const getRoleList = async (accessToken) => {
    const { data: roles } = await axios({
        method: 'get',
        url: process.env.KEYCLOAK_AUTH_ROLES_URL,
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })
    return roles
}

router.route('/').get(async (req, res) => {
    /* 	
            #swagger.tags = ['Role']
            #swagger.description = '取得Role' 
        */
    try {
        const accessToken = req.accessToken

        const results = await getRoleList(accessToken)
        return res.status(200).json({ count: results.length, results })
    } catch (e) {
        console.log(e)
        return res.status(500).json({ message: e.message })
    }
})

module.exports = router
