const express = require('express')
const router = express.Router()
const axios = require('axios')

const getGroups = async (accessToken) => {
    const { data: groups } = await axios({
        method: 'get',
        url: process.env.KEYCLOAK_AUTH_GROUPS_URL,
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })
    return groups
}

const getGroupRoleList = async (accessToken, groupId) => {
    const { data: roles } = await axios({
        method: 'get',
        url: `${process.env.KEYCLOAK_AUTH_GROUPS_URL}/${groupId}/role-mappings/realm`,
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
        const groups = await getGroups(accessToken)
        const roleGroup = groups.find((g) => g.name === 'roles')

        const results = await getGroupRoleList(accessToken, roleGroup.id)
        return res.status(200).json({ count: results.length, results })
    } catch (e) {
        console.log(e)
        return res.status(500).json({ message: e.message })
    }
})

module.exports = router
